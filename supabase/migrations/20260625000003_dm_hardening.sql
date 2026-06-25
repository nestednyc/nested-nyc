-- ============================================================
-- DM hardening — three surgical audit fixes (#23, #25, #26).
--
-- Each RPC below is a CREATE OR REPLACE of its CURRENT authoritative definition
-- (last redefined in 20260625000000_dm_chat_features.sql; nothing in
-- 20260625000001/02 touches them). Everything except the one change called out
-- per fix is preserved byte-for-byte: Vault-keyed pgp_sym_encrypt/decrypt at rest,
-- attachments, the conversation_clears (S8) watermark, ORDER BY / LIMIT, the
-- 10-per-10s rate limit, caller-scoped idempotency, and the connected+not-blocked
-- gate. No RETURNS TABLE columns change, so plain CREATE OR REPLACE is legal (no
-- DROP needed) and the existing grants stay intact.
--
-- (A) #23 — get_thread keyset boundary. The paging predicate used
--     `m.created_at < p_since`, which EXCLUDES rows at exactly the cursor
--     timestamp. When the page-boundary message shares a created_at with an
--     unloaded sibling, that sibling is silently dropped on the next page.
--     Fix: `< p_since` -> `<= p_since` (one character). The client's mergeThread
--     dedups by id, so re-fetching the cursor row is harmless, and the
--     same-timestamp sibling is no longer lost. Signature / ORDER BY / LIMIT
--     unchanged.
--
-- (B) #25 — send_message attachment path ownership. The attachment loop inserted
--     whatever client-supplied storage_path it was handed. A caller could record
--     a row pointing at SOMEONE ELSE'S object path. Fix: reject any attachment
--     whose storage_path does not begin with the sender's own folder for THIS
--     message — `auth.uid()::text || '/' || p_id::text || '/'` — matching the
--     Storage RLS path contract (<uid>/<message_id>/<file>). Raised PT422, the
--     same class/style send_message already uses for its other input rejections
--     (message_too_long / empty_message / too_many_attachments). Nothing else in
--     send_message changes.
--
-- (C) #26 — grant tightening (defense-in-depth). messages has no client delete
--     path; blocks is read via an RLS-scoped SELECT and written ONLY through the
--     SECURITY DEFINER block_user/unblock_user RPCs. Revoke the unused client DML
--     so a future RLS slip can't be exploited directly.
--
-- *** NEVER add FORCE ROW LEVEL SECURITY to these tables. ***
--     messages and blocks are written by SECURITY DEFINER RPCs that run AS THE
--     TABLE OWNER. FORCE RLS would subject the owner to the row policies too,
--     which can break those RPCs (the owner is normally exempt). RLS is already
--     ENABLED as the backstop; the REVOKEs below are the client-side lock. Leave
--     RLS exactly as-is — enabled, not forced.
--
-- Depends on: 20260621..20260625000000 (schema, RPC seam, encryption,
--             delete-conversation, chat-features/attachments).
-- ============================================================

-- ---------------- (A) get_thread — keyset boundary `<` -> `<=` ----------------
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
  read_at      TIMESTAMPTZ,
  attachments  JSONB
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
  IF v_key IS NULL THEN RAISE EXCEPTION 'dm_body_key missing from vault' USING ERRCODE = 'PT500'; END IF;
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401'; END IF;

  SELECT cc.cleared_at INTO v_cleared
  FROM public.conversation_clears cc
  WHERE cc.user_id = v_me AND cc.peer_id = p_peer;

  RETURN QUERY
    SELECT m.id, m.sender_id, m.recipient_id,
           extensions.pgp_sym_decrypt(m.body_enc, v_key) AS body,
           m.created_at, m.read_at, public._dm_attachments_json(m.id) AS attachments
    FROM public.messages m
    WHERE ((m.sender_id = v_me AND m.recipient_id = p_peer)
        OR (m.sender_id = p_peer AND m.recipient_id = v_me))
      AND (p_since IS NULL OR m.created_at <= p_since)   -- #23: was `< p_since` (boundary sibling no longer dropped)
      AND (v_cleared IS NULL OR m.created_at > v_cleared)
    ORDER BY m.created_at DESC
    LIMIT LEAST(p_limit, 100);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_thread(UUID, TIMESTAMPTZ, INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_thread(UUID, TIMESTAMPTZ, INT) TO authenticated;

-- ---------------- (B) send_message — attachment path ownership guard ----------------
CREATE OR REPLACE FUNCTION public.send_message(
  p_id          UUID,
  p_recipient   UUID,
  p_body        TEXT,
  p_attachments JSONB DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  id           UUID,
  sender_id    UUID,
  recipient_id UUID,
  body         TEXT,
  created_at   TIMESTAMPTZ,
  read_at      TIMESTAMPTZ,
  attachments  JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sender UUID := auth.uid();
  v_count  INT;
  v_key    TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dm_body_key');
  v_natt   INT  := COALESCE(jsonb_array_length(p_attachments), 0);
  v_att    JSONB;
  v_prefix TEXT;   -- #25: required own-folder prefix for THIS message's attachments
BEGIN
  IF v_key IS NULL THEN RAISE EXCEPTION 'dm_body_key missing from vault' USING ERRCODE = 'PT500'; END IF;
  IF v_sender IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401'; END IF;
  IF p_recipient = v_sender THEN RAISE EXCEPTION 'self_message' USING ERRCODE = 'PT422'; END IF;

  -- Length cap + non-empty rule (empty body allowed only with an attachment) + count cap.
  IF char_length(COALESCE(p_body, '')) > 4000 THEN RAISE EXCEPTION 'message_too_long' USING ERRCODE = 'PT422'; END IF;
  IF COALESCE(p_body, '') = '' AND v_natt = 0 THEN RAISE EXCEPTION 'empty_message' USING ERRCODE = 'PT422'; END IF;
  IF v_natt > 5 THEN RAISE EXCEPTION 'too_many_attachments' USING ERRCODE = 'PT422'; END IF;

  -- Idempotency — CALLER-SCOPED (S2 rule). Return the existing row + its attachments.
  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.id = p_id AND m.sender_id = v_sender) THEN
    RETURN QUERY
      SELECT m.id, m.sender_id, m.recipient_id,
             extensions.pgp_sym_decrypt(m.body_enc, v_key) AS body,
             m.created_at, m.read_at, public._dm_attachments_json(m.id) AS attachments
      FROM public.messages m
      WHERE m.id = p_id AND m.sender_id = v_sender;
    RETURN;
  END IF;

  -- Gate (connected + not blocked) then rate-limit (10 / 10s).
  IF NOT public.is_connected_to(p_recipient) THEN RAISE EXCEPTION 'not_connected' USING ERRCODE = 'PT403'; END IF;
  IF public.is_blocked_with(p_recipient) THEN RAISE EXCEPTION 'blocked' USING ERRCODE = 'PT403'; END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.messages m
  WHERE m.sender_id = v_sender AND m.created_at > now() - interval '10 seconds';
  IF v_count >= 10 THEN RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429'; END IF;

  -- Insert the message (body encrypted at rest), then its attachment rows.
  INSERT INTO public.messages (id, sender_id, recipient_id, body_enc)
  VALUES (p_id, v_sender, p_recipient, extensions.pgp_sym_encrypt(COALESCE(p_body, ''), v_key));

  IF v_natt > 0 THEN
    -- #25: every attachment path MUST live under the sender's own folder for THIS
    -- message (<uid>/<message_id>/…) — mirrors the Storage RLS path contract so a
    -- client cannot record a row pointing at another user's / another message's path.
    v_prefix := v_sender::text || '/' || p_id::text || '/';
    FOR v_att IN SELECT * FROM jsonb_array_elements(p_attachments) LOOP
      IF COALESCE(v_att->>'storage_path', '') = '' THEN CONTINUE; END IF;
      IF left(v_att->>'storage_path', length(v_prefix)) <> v_prefix THEN
        RAISE EXCEPTION 'attachment_path_forbidden' USING ERRCODE = 'PT422';
      END IF;
      INSERT INTO public.message_attachments (message_id, storage_path, mime_type, size_bytes, file_name)
      VALUES (p_id,
              v_att->>'storage_path',
              COALESCE(v_att->>'mime_type', 'application/octet-stream'),
              COALESCE((v_att->>'size_bytes')::bigint, 0),
              COALESCE(v_att->>'file_name', 'file'));
    END LOOP;
  END IF;

  RETURN QUERY
    SELECT m.id, m.sender_id, m.recipient_id,
           extensions.pgp_sym_decrypt(m.body_enc, v_key) AS body,
           m.created_at, m.read_at, public._dm_attachments_json(m.id) AS attachments
    FROM public.messages m
    WHERE m.id = p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_message(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.send_message(UUID, UUID, TEXT, JSONB) TO authenticated;

-- ---------------- (C) grant tightening (defense-in-depth) ----------------
-- messages: no client delete path (sends go through send_message; reads through
-- get_thread/get_inbox). blocks: read via RLS SELECT, written ONLY by the DEFINER
-- block_user/unblock_user RPCs (owner-run → unaffected by these client revokes).
REVOKE DELETE ON public.messages FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.blocks FROM anon, authenticated;

-- Make PostgREST aware of the replaced functions immediately.
NOTIFY pgrst, 'reload schema';
