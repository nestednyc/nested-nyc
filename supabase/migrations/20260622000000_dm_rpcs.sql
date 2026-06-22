-- ============================================================
-- DM Sprint 2 — the RPC seam for 1:1 messages + blocks.
--
-- S1 (20260621000000) shipped the data model with plain RLS-gated DML. S2 moves
-- ALL writes behind SECURITY DEFINER RPCs and then REVOKEs direct INSERT on
-- public.messages, so the RPC is the ONLY write path. That's what makes the
-- rate-limit (10 / 10s) and the client-supplied-id idempotency unbypassable —
-- a client can't skip them by POSTing straight to /rest/v1/messages.
--
-- Bodies are PLAINTEXT here: convert_to(p_body,'utf8') in / convert_from(...,'utf8')
-- out. Sprint 3 swaps ONLY those two calls for pgp_sym_encrypt/pgp_sym_decrypt;
-- nothing else in this file changes.
--
-- Standing rule (S1 helper fix): every read inside a SECURITY DEFINER function
-- RE-SCOPES to auth.uid(). DEFINER bypasses RLS, so an unscoped lookup by a
-- guessed id would hand back another user's row. The send_message idempotency
-- check is therefore caller-scoped: WHERE id = p_id AND sender_id = v_sender.
--
-- Error signaling: RAISE EXCEPTION ... ERRCODE 'PTxxx'. PostgREST maps a 'PTxxx'
-- SQLSTATE straight to HTTP status xxx, so the service can branch on error.code
-- (PT401 / PT403 / PT429 / PT422) instead of sniffing message strings.
--
-- plpgsql RETURNS TABLE gotcha: the OUT columns (id, sender_id, ...) share names
-- with the table columns, so every reference to a real column is qualified
-- (m.created_at, m.sender_id, ...) to dodge ambiguity errors at runtime.
-- ============================================================

-- ---------------- send_message ----------------
-- p_id is the CLIENT idempotency key (messages.id has no default — see S1). A
-- retried send with the same id returns the already-stored row instead of
-- erroring or duplicating. Returns the inserted/existing row with the body as
-- plaintext.
CREATE OR REPLACE FUNCTION public.send_message(
  p_id        UUID,
  p_recipient UUID,
  p_body      TEXT
)
RETURNS TABLE (
  id           UUID,
  sender_id    UUID,
  recipient_id UUID,
  body         TEXT,
  created_at   TIMESTAMPTZ,
  read_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender UUID := auth.uid();
  v_count  INT;
BEGIN
  -- 1. Must be signed in.
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401';
  END IF;

  -- 2. No talking to yourself (also CHECK-constrained, but fail clean here).
  IF p_recipient = v_sender THEN
    RAISE EXCEPTION 'self_message' USING ERRCODE = 'PT422';
  END IF;

  -- 3. Idempotency — CALLER-SCOPED. If this exact (id, me-as-sender) row already
  --    exists, return it and stop: no gate re-check, no rate charge. Scoping to
  --    v_sender is the security-critical bit: an unscoped WHERE id = p_id would
  --    leak a stranger's message for a guessed UUID (DEFINER bypasses RLS). A
  --    foreign id finds nothing here and falls through to the INSERT, where the
  --    PK collision (if any) reveals nothing about the existing row.
  RETURN QUERY
    SELECT m.id, m.sender_id, m.recipient_id,
           convert_from(m.body_enc, 'utf8') AS body,
           m.created_at, m.read_at
    FROM public.messages m
    WHERE m.id = p_id AND m.sender_id = v_sender;
  IF FOUND THEN
    RETURN;
  END IF;

  -- 4. Gate: connected (either direction) and not blocked (either direction).
  --    Mirrors the S1 INSERT policy, via the self-scoped helpers.
  IF NOT public.is_connected_to(p_recipient) THEN
    RAISE EXCEPTION 'not_connected' USING ERRCODE = 'PT403';
  END IF;
  IF public.is_blocked_with(p_recipient) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = 'PT403';
  END IF;

  -- 5. Rate-limit: 10 sends per rolling 10 seconds, per sender.
  SELECT COUNT(*) INTO v_count
  FROM public.messages m
  WHERE m.sender_id = v_sender
    AND m.created_at > now() - interval '10 seconds';
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;

  -- 6. Insert AS the authenticated user (never trust a client sender_id).
  --    7. Return the new row with the body decoded back to plaintext.
  RETURN QUERY
    INSERT INTO public.messages (id, sender_id, recipient_id, body_enc)
    VALUES (p_id, v_sender, p_recipient, convert_to(p_body, 'utf8'))
    RETURNING messages.id, messages.sender_id, messages.recipient_id,
              convert_from(messages.body_enc, 'utf8') AS body,
              messages.created_at, messages.read_at;
END;
$$;

-- ---------------- get_inbox ----------------
-- One row per conversation peer: the latest message in that thread + the count
-- of messages the caller hasn't read yet. Peer = the OTHER party relative to
-- auth.uid(). DISTINCT ON keeps the newest per peer (ORDER BY peer, created_at
-- DESC). Unread is a left-joined per-sender count of read_at IS NULL messages
-- addressed to the caller.
CREATE OR REPLACE FUNCTION public.get_inbox()
RETURNS TABLE (
  peer_id      UUID,
  last_body    TEXT,
  last_at      TIMESTAMPTZ,
  last_sender  UUID,
  unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401';
  END IF;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (peer)
      CASE WHEN m.sender_id = v_me THEN m.recipient_id ELSE m.sender_id END AS peer,
      convert_from(m.body_enc, 'utf8') AS last_body,
      m.created_at AS last_at,
      m.sender_id  AS last_sender
    FROM public.messages m
    WHERE m.sender_id = v_me OR m.recipient_id = v_me
    ORDER BY peer, m.created_at DESC
  ),
  unread AS (
    SELECT m.sender_id AS peer, COUNT(*) AS unread_count
    FROM public.messages m
    WHERE m.recipient_id = v_me AND m.read_at IS NULL
    GROUP BY m.sender_id
  )
  SELECT l.peer, l.last_body, l.last_at, l.last_sender,
         COALESCE(u.unread_count, 0) AS unread_count
  FROM latest l
  LEFT JOIN unread u ON u.peer = l.peer
  ORDER BY l.last_at DESC;
END;
$$;

-- ---------------- get_thread ----------------
-- Both directions between the caller and p_peer, newest first, capped at
-- LEAST(p_limit, 100). p_since is a keyset on created_at for "older" paging
-- (created_at < p_since). A (created_at, id) cursor is deferred to S5.
CREATE OR REPLACE FUNCTION public.get_thread(
  p_peer  UUID,
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id           UUID,
  sender_id    UUID,
  recipient_id UUID,
  body         TEXT,
  created_at   TIMESTAMPTZ,
  read_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401';
  END IF;

  RETURN QUERY
    SELECT m.id, m.sender_id, m.recipient_id,
           convert_from(m.body_enc, 'utf8') AS body,
           m.created_at, m.read_at
    FROM public.messages m
    WHERE ((m.sender_id = v_me AND m.recipient_id = p_peer)
        OR (m.sender_id = p_peer AND m.recipient_id = v_me))
      AND (p_since IS NULL OR m.created_at < p_since)
    ORDER BY m.created_at DESC
    LIMIT LEAST(p_limit, 100);
END;
$$;

-- ---------------- mark_thread_read ----------------
-- Mark every still-unread message FROM p_peer TO the caller as read. The S1
-- column lock allows authenticated to write only read_at; this fn runs as
-- DEFINER anyway, so the lock doesn't impede it.
CREATE OR REPLACE FUNCTION public.mark_thread_read(p_peer UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401';
  END IF;

  UPDATE public.messages m
  SET read_at = now()
  WHERE m.recipient_id = v_me
    AND m.sender_id = p_peer
    AND m.read_at IS NULL;
END;
$$;

-- ---------------- block_user ----------------
-- Record (me → target) in blocks; idempotent. Does NOT sever the connection in
-- v1 — unblocking should restore the prior ability to message.
CREATE OR REPLACE FUNCTION public.block_user(p_target UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401';
  END IF;
  IF p_target = v_me THEN
    RAISE EXCEPTION 'self_block' USING ERRCODE = 'PT422';
  END IF;

  INSERT INTO public.blocks (blocker_id, blocked_id)
  VALUES (v_me, p_target)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ---------------- unblock_user ----------------
-- Remove (me → target) from blocks; idempotent.
CREATE OR REPLACE FUNCTION public.unblock_user(p_target UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401';
  END IF;

  DELETE FROM public.blocks bl
  WHERE bl.blocker_id = v_me AND bl.blocked_id = p_target;
END;
$$;

-- ---------------- LOCK THE WRITE PATH ----------------
-- With the RPC in place, direct INSERT on messages must go away so the
-- rate-limit + idempotency can't be sidestepped via /rest/v1/messages. Supabase
-- default-grants ALL on new public tables to authenticated/anon, so this REVOKE
-- is load-bearing. SELECT (read the thread) + UPDATE(read_at) (S1 grant) stay.
-- mark_thread_read still works: SECURITY DEFINER runs as owner.
REVOKE INSERT ON public.messages FROM authenticated, anon;

-- ---------------- GRANTS (per fn; recipe from 20260614000000) ----------------
-- Supabase default-grants EXECUTE on new public functions to anon/authenticated/
-- service_role, so REVOKE FROM PUBLIC alone leaves anon's explicit grant — drop
-- it too, then grant only authenticated. service_role keeps its default grant.
REVOKE EXECUTE ON FUNCTION public.send_message(UUID, UUID, TEXT)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_inbox()                              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_thread(UUID, TIMESTAMPTZ, INT)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_thread_read(UUID)                    FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.block_user(UUID)                          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.unblock_user(UUID)                        FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.send_message(UUID, UUID, TEXT)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_inbox()                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread(UUID, TIMESTAMPTZ, INT)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_thread_read(UUID)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(UUID)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(UUID)                        TO authenticated;

-- Make PostgREST aware of the new functions immediately.
NOTIFY pgrst, 'reload schema';
