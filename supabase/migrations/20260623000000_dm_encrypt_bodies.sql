-- ============================================================
-- DM Sprint 3 — Option B: message-body encryption AT REST.
--
-- S2 (20260622000000) put every write behind SECURITY DEFINER RPCs and bodies
-- were PLAINTEXT bytes: convert_to(p_body,'utf8') in / convert_from(...,'utf8')
-- out. S3 swaps ONLY those two calls for pgp_sym_encrypt / pgp_sym_decrypt, keyed
-- by a random 256-bit secret stored in Vault (never in git). Everything else in
-- the three body-touching RPCs — signatures, caller-scoped idempotency, the
-- connection/block gate, the 10/10s rate limit, ordering, the PT4xx error codes —
-- is IDENTICAL to S2. The RPC seam keeps this invisible to the JS client:
-- src/services/messageService.js and src/design/messageAdapter.js are UNCHANGED.
--
-- Why `SET search_path = public, extensions`: pgcrypto lives in the `extensions`
-- schema on Supabase (extensions.pgp_sym_encrypt / pgp_sym_decrypt), NOT public.
-- CREATE OR REPLACE FUNCTION preserves the EXECUTE grants and the REVOKE INSERT on
-- messages from S2, but it FULLY redefines the SET clauses — so each replaced fn
-- must restate its search_path. mark_thread_read / block_user / unblock_user touch
-- no bodies and are left exactly as S2 defined them (NOT replaced here).
--
-- The key: read once near the top of each fn from vault.decrypted_secrets (which
-- the DEFINER owner can read), and fail loud if it's missing. vault.* is always
-- schema-qualified regardless of search_path.
-- ============================================================

-- ---------------- KEY — idempotent, random, never in git ----------------
-- 256-bit random key, hex-encoded, created only if it isn't already present.
-- gen_random_bytes lives in `extensions`; vault.create_secret's 4th arg
-- (new_key_id uuid) defaults, so the 3-arg call is correct.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'dm_body_key') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'dm_body_key',
      'DM message body encryption key (Option B, at-rest)');
  END IF;
END $$;

-- ---------------- send_message (encrypting) ----------------
-- Identical to S2 except: search_path now includes extensions; the key is read
-- once at the top; the body is stored with pgp_sym_encrypt and returned with
-- pgp_sym_decrypt. Caller-scoped idempotency, gate, and rate-limit unchanged.
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
SET search_path = public, extensions
AS $$
DECLARE
  v_sender UUID := auth.uid();
  v_count  INT;
  v_key    TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dm_body_key');
BEGIN
  -- 0. Encryption key must be present (migration seeds it). Fail loud, not silent.
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'dm_body_key missing from vault' USING ERRCODE = 'PT500';
  END IF;

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
           extensions.pgp_sym_decrypt(m.body_enc, v_key) AS body,
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

  -- 6. Insert AS the authenticated user (never trust a client sender_id), body
  --    encrypted at rest. 7. Return the new row with the body decrypted.
  RETURN QUERY
    INSERT INTO public.messages (id, sender_id, recipient_id, body_enc)
    VALUES (p_id, v_sender, p_recipient, extensions.pgp_sym_encrypt(p_body, v_key))
    RETURNING messages.id, messages.sender_id, messages.recipient_id,
              extensions.pgp_sym_decrypt(messages.body_enc, v_key) AS body,
              messages.created_at, messages.read_at;
END;
$$;

-- ---------------- get_inbox (decrypting) ----------------
-- Identical to S2 except: search_path now includes extensions; the key is read
-- once at the top; last_body is decrypted with pgp_sym_decrypt. DISTINCT ON,
-- unread count, and ordering unchanged.
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
  WITH latest AS (
    SELECT DISTINCT ON (peer)
      CASE WHEN m.sender_id = v_me THEN m.recipient_id ELSE m.sender_id END AS peer,
      extensions.pgp_sym_decrypt(m.body_enc, v_key) AS last_body,
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

-- ---------------- get_thread (decrypting) ----------------
-- Identical to S2 except: search_path now includes extensions; the key is read
-- once at the top; the body is decrypted with pgp_sym_decrypt. Keyset paging,
-- direction filter, ordering, and LEAST(p_limit,100) cap unchanged.
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
    SELECT m.id, m.sender_id, m.recipient_id,
           extensions.pgp_sym_decrypt(m.body_enc, v_key) AS body,
           m.created_at, m.read_at
    FROM public.messages m
    WHERE ((m.sender_id = v_me AND m.recipient_id = p_peer)
        OR (m.sender_id = p_peer AND m.recipient_id = v_me))
      AND (p_since IS NULL OR m.created_at < p_since)
    ORDER BY m.created_at DESC
    LIMIT LEAST(p_limit, 100);
END;
$$;

-- mark_thread_read / block_user / unblock_user are unchanged from S2 (no bodies).

-- CREATE OR REPLACE preserves the S2 EXECUTE grants and the REVOKE INSERT on
-- messages, so no re-GRANT/REVOKE is needed. Make PostgREST reload the schema.
NOTIFY pgrst, 'reload schema';
