-- ============================================================
-- DM Sprint 8 — "delete conversation" (delete-for-me).
--
-- Every message is ONE shared row read by both participants (S1 schema), and
-- delete-for-everyone is out of scope (MESSAGING_PLAN.md "Out of scope"). So a
-- hard delete is impossible without destroying the peer's copy. The v1 semantic
-- is therefore a per-user CLEAR WATERMARK (the familiar "delete chat" behaviour):
-- clearing hides every message in that thread up to now() FOR THE CALLER ONLY;
-- the peer is unaffected, and the thread reappears (with just the new messages)
-- if the peer messages again later.
--
-- Implementation: a self-scoped conversation_clears(user_id, peer_id, cleared_at)
-- watermark table, a delete_conversation(p_peer) DEFINER RPC that upserts it to
-- now(), and a CREATE OR REPLACE of get_inbox / get_thread that filters out
-- messages with created_at <= the caller's cleared_at for that peer. Nothing is
-- decrypted differently and no message bytes are touched — this is purely a
-- per-caller visibility filter, so it composes cleanly with the S3 encryption.
--
-- The two replaced readers are byte-for-byte the S3 (20260623000000) versions
-- with ONLY the watermark filter added; the encryption (pgp_sym_decrypt + the
-- vault key read), DISTINCT ON, unread count, paging, ordering, error codes and
-- SET search_path = public, extensions are all unchanged. mark_thread_read /
-- send_message / block_user / unblock_user are NOT touched here.
-- ============================================================

-- ---------------- CONVERSATION_CLEARS (per-user "delete chat" watermark) ----------------
-- One row per (me, peer) the caller has cleared. cleared_at is the high-water
-- mark: messages at-or-before it are hidden from me. Re-clearing just bumps it
-- to now(). ON DELETE CASCADE off profiles so a deleted account's clears vanish.
CREATE TABLE IF NOT EXISTS public.conversation_clears (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  peer_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cleared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, peer_id),
  CHECK (user_id <> peer_id)
);

-- ---------------- RLS: CONVERSATION_CLEARS (private to the owner) ----------------
-- The watermark is written ONLY by the DEFINER RPC below (which bypasses RLS), so
-- there is no INSERT/UPDATE/DELETE policy — RLS denies direct writes by default,
-- and the REVOKE drops Supabase's default ALL grant as belt-and-suspenders so the
-- RPC stays the sole writer (mirrors the messages REVOKE INSERT in S2). A
-- self-scoped SELECT is allowed in case any future client surface wants to read
-- its own clears; "who cleared whom" is never exposed across users.
ALTER TABLE public.conversation_clears ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View own conversation clears" ON public.conversation_clears;
CREATE POLICY "View own conversation clears" ON public.conversation_clears
  FOR SELECT TO authenticated USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.conversation_clears FROM authenticated, anon;

-- ---------------- delete_conversation ----------------
-- Clear (delete-for-me) the thread with p_peer: set my watermark to now(). DEFINER
-- so it can write the locked-down table; caller-scoped to auth.uid(), so a caller
-- can only ever clear ITS OWN view. Idempotent — re-clearing bumps cleared_at.
CREATE OR REPLACE FUNCTION public.delete_conversation(p_peer UUID)
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
  IF p_peer = v_me THEN
    RAISE EXCEPTION 'self_conversation' USING ERRCODE = 'PT422';
  END IF;

  INSERT INTO public.conversation_clears (user_id, peer_id, cleared_at)
  VALUES (v_me, p_peer, now())
  ON CONFLICT (user_id, peer_id) DO UPDATE SET cleared_at = EXCLUDED.cleared_at;
END;
$$;

-- ---------------- get_inbox (decrypting + clear-aware) ----------------
-- S3 version + the per-caller clear watermark. `visible` is the caller's messages
-- with each row's peer resolved and any message at-or-before that peer's
-- cleared_at dropped; `latest` (newest per peer) and `unread` are then computed
-- over `visible`, so a cleared thread leaves the inbox AND stops counting toward
-- unread until the peer sends something newer than the watermark.
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
SET search_path = public, extensions
AS $$
DECLARE
  v_me  UUID := auth.uid();
  v_key TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dm_body_key');
BEGIN
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'dm_body_key missing from vault' USING ERRCODE = 'PT500';
  END IF;
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401';
  END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT m.body_enc, m.created_at, m.sender_id, m.recipient_id, m.read_at,
           CASE WHEN m.sender_id = v_me THEN m.recipient_id ELSE m.sender_id END AS peer
    FROM public.messages m
    LEFT JOIN public.conversation_clears cc
      ON cc.user_id = v_me
     AND cc.peer_id = CASE WHEN m.sender_id = v_me THEN m.recipient_id ELSE m.sender_id END
    WHERE (m.sender_id = v_me OR m.recipient_id = v_me)
      AND m.created_at > COALESCE(cc.cleared_at, '-infinity'::timestamptz)
  ),
  latest AS (
    SELECT DISTINCT ON (peer)
      peer,
      extensions.pgp_sym_decrypt(body_enc, v_key) AS last_body,
      created_at AS last_at,
      sender_id  AS last_sender
    FROM visible
    ORDER BY peer, created_at DESC
  ),
  unread AS (
    SELECT sender_id AS peer, COUNT(*) AS unread_count
    FROM visible
    WHERE recipient_id = v_me AND read_at IS NULL
    GROUP BY sender_id
  )
  SELECT l.peer, l.last_body, l.last_at, l.last_sender,
         COALESCE(u.unread_count, 0) AS unread_count
  FROM latest l
  LEFT JOIN unread u ON u.peer = l.peer
  ORDER BY l.last_at DESC;
END;
$$;

-- ---------------- get_thread (decrypting + clear-aware) ----------------
-- S3 version + one extra predicate: only messages newer than my cleared_at for
-- p_peer are returned. Keyset paging (p_since), direction filter, decryption,
-- ordering and LEAST(p_limit,100) cap are all unchanged.
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
SET search_path = public, extensions
AS $$
DECLARE
  v_me      UUID := auth.uid();
  v_key     TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dm_body_key');
  v_cleared TIMESTAMPTZ;
BEGIN
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'dm_body_key missing from vault' USING ERRCODE = 'PT500';
  END IF;
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401';
  END IF;

  SELECT cc.cleared_at INTO v_cleared
  FROM public.conversation_clears cc
  WHERE cc.user_id = v_me AND cc.peer_id = p_peer;

  RETURN QUERY
    SELECT m.id, m.sender_id, m.recipient_id,
           extensions.pgp_sym_decrypt(m.body_enc, v_key) AS body,
           m.created_at, m.read_at
    FROM public.messages m
    WHERE ((m.sender_id = v_me AND m.recipient_id = p_peer)
        OR (m.sender_id = p_peer AND m.recipient_id = v_me))
      AND (p_since IS NULL OR m.created_at < p_since)
      AND (v_cleared IS NULL OR m.created_at > v_cleared)
    ORDER BY m.created_at DESC
    LIMIT LEAST(p_limit, 100);
END;
$$;

-- ---------------- GRANTS (per fn; recipe from 20260614000000 / S2) ----------------
-- delete_conversation is new, so lock its default grants down to authenticated.
-- get_inbox / get_thread keep their S2/S3 EXECUTE grants (CREATE OR REPLACE
-- preserves them), so they need no re-grant.
REVOKE EXECUTE ON FUNCTION public.delete_conversation(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.delete_conversation(UUID) TO authenticated;

-- Make PostgREST aware of the new function immediately.
NOTIFY pgrst, 'reload schema';
