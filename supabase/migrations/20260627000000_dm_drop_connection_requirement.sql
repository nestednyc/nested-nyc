-- ─────────────────────────────────────────────────────────────────────────────
-- Drop the "must be connected" requirement from direct messages.
--
-- Before: send_message rejected with PT403 'not_connected' unless a `connections`
-- edge existed in either direction. Because connecting is UNILATERAL (a follow,
-- no approval), that gate was already self-satisfiable — anyone could click
-- Connect, then DM. This removes the gate so any authenticated student may DM any
-- other student directly, dropping the friction Connect step.
--
-- KEPT: auth (PT401), no self-DM (PT422), body/length/attachment-count validation
-- (PT422), block in either direction (PT403 'blocked'), rate-limit 10/10s
-- (PT429), at-rest body encryption, the attachment own-folder path contract.
--
-- ADDED: an explicit recipient-is-a-real-student check (PT422 'no_such_recipient').
-- The connection check previously guaranteed the recipient existed AND was a
-- student; without it we validate that directly so a crafted RPC call can't target
-- a bogus UUID or an org account. DMs remain student↔student.
--
-- Note: the (dead) INSERT RLS policy on public.messages in
-- 20260621000000_add_messages_and_blocks.sql still references is_connected_to, but
-- direct INSERT is revoked from `authenticated` (all writes go through this
-- SECURITY DEFINER RPC), so that policy is inert and left untouched.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_prefix TEXT;   -- required own-folder prefix for THIS message's attachments
BEGIN
  IF v_key IS NULL THEN RAISE EXCEPTION 'dm_body_key missing from vault' USING ERRCODE = 'PT500'; END IF;
  IF v_sender IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401'; END IF;
  IF p_recipient = v_sender THEN RAISE EXCEPTION 'self_message' USING ERRCODE = 'PT422'; END IF;

  -- Length cap + non-empty rule (empty body allowed only with an attachment) + count cap.
  IF char_length(COALESCE(p_body, '')) > 4000 THEN RAISE EXCEPTION 'message_too_long' USING ERRCODE = 'PT422'; END IF;
  IF COALESCE(p_body, '') = '' AND v_natt = 0 THEN RAISE EXCEPTION 'empty_message' USING ERRCODE = 'PT422'; END IF;
  IF v_natt > 5 THEN RAISE EXCEPTION 'too_many_attachments' USING ERRCODE = 'PT422'; END IF;

  -- Idempotency — CALLER-SCOPED. Return the existing row + its attachments.
  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.id = p_id AND m.sender_id = v_sender) THEN
    RETURN QUERY
      SELECT m.id, m.sender_id, m.recipient_id,
             extensions.pgp_sym_decrypt(m.body_enc, v_key) AS body,
             m.created_at, m.read_at, public._dm_attachments_json(m.id) AS attachments
      FROM public.messages m
      WHERE m.id = p_id AND m.sender_id = v_sender;
    RETURN;
  END IF;

  -- Gate: recipient must be a real student; not blocked (either way). Connection is
  -- NO LONGER required (removed 2026-06-27). Then rate-limit (10 / 10s).
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_recipient AND p.account_type = 'student') THEN
    RAISE EXCEPTION 'no_such_recipient' USING ERRCODE = 'PT422';
  END IF;
  IF public.is_blocked_with(p_recipient) THEN RAISE EXCEPTION 'blocked' USING ERRCODE = 'PT403'; END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.messages m
  WHERE m.sender_id = v_sender AND m.created_at > now() - interval '10 seconds';
  IF v_count >= 10 THEN RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429'; END IF;

  -- Insert the message (body encrypted at rest), then its attachment rows.
  INSERT INTO public.messages (id, sender_id, recipient_id, body_enc)
  VALUES (p_id, v_sender, p_recipient, extensions.pgp_sym_encrypt(COALESCE(p_body, ''), v_key));

  IF v_natt > 0 THEN
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
