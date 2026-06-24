-- ============================================================
-- DM chat features — message length cap + attachments (docs/images).
--
-- Two additions, kept as self-contained as the seam allows:
--   1. LENGTH CAP: send_message now rejects bodies over 4000 chars (PT422) and
--      empty sends that carry no attachment. Cheap abuse/cost guard.
--   2. ATTACHMENTS (modular): a `message_attachments` child table, a private
--      `dm-attachments` Storage bucket (10 MB/file + mime allowlist) with
--      own-folder-write / participant-read RLS, send_message gains an optional
--      p_attachments jsonb, and get_thread/get_inbox surface attachment info.
--
--   To REMOVE attachments later: drop message_attachments (+ the bucket/policies),
--   restore the 3-arg send_message, and drop the attachments column from the two
--   readers — the rest of the DM feature is untouched.
--
-- RETURN-TYPE CHANGE: adding columns to a RETURNS TABLE is not allowed via
-- CREATE OR REPLACE, so send_message / get_thread / get_inbox are DROPped and
-- recreated (with grants re-applied). The recreated readers carry forward the S8
-- clear-conversation watermark verbatim and the S3 at-rest encryption.
-- Depends on: 20260621/22/23/24 (schema, RPCs, encryption, delete-conversation).
-- ============================================================

-- ---------------- message_attachments (child of messages) ----------------
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id   UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  size_bytes   BIGINT NOT NULL DEFAULT 0,
  file_name    TEXT NOT NULL DEFAULT 'file',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON public.message_attachments (message_id);

-- RLS: a participant of the parent message may read its attachment rows; writes
-- happen ONLY inside send_message (SECURITY DEFINER) so the REVOKE locks out any
-- direct DML (mirrors the messages write-path lock). Reads in-app go through
-- get_thread (DEFINER), so authenticated needs no direct grant — the policy is a
-- backstop for any direct PostgREST access.
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attachments visible to the two participants" ON public.message_attachments;
CREATE POLICY "Attachments visible to the two participants"
  ON public.message_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND auth.uid() IN (m.sender_id, m.recipient_id)
  ));

REVOKE INSERT, UPDATE, DELETE ON public.message_attachments FROM authenticated, anon;

-- Internal helper: a message's attachments as a jsonb array (client UI shape).
-- Called only from the DEFINER readers below (which run as owner and bypass RLS),
-- so EXECUTE is revoked from clients.
CREATE OR REPLACE FUNCTION public._dm_attachments_json(p_message UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object(
      'storage_path', a.storage_path,
      'mime_type',    a.mime_type,
      'size_bytes',   a.size_bytes,
      'file_name',    a.file_name
    ) ORDER BY a.created_at), '[]'::jsonb)
  FROM public.message_attachments a
  WHERE a.message_id = p_message;
$$;
REVOKE EXECUTE ON FUNCTION public._dm_attachments_json(UUID) FROM PUBLIC, anon, authenticated;

-- ---------------- send_message (v2: length cap + attachments) ----------------
-- Replaces the 3-arg version. The 4th arg defaults to '[]' so existing 3-arg
-- callers (and the dm_s2 suite) keep working. Body cap 4000; an empty body is
-- only allowed when at least one attachment is present; ≤5 attachments.
DROP FUNCTION IF EXISTS public.send_message(UUID, UUID, TEXT);
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
    FOR v_att IN SELECT * FROM jsonb_array_elements(p_attachments) LOOP
      IF COALESCE(v_att->>'storage_path', '') = '' THEN CONTINUE; END IF;
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

-- ---------------- get_thread (v3: + attachments, keeps S8 watermark) ----------------
DROP FUNCTION IF EXISTS public.get_thread(UUID, TIMESTAMPTZ, INT);
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
      AND (p_since IS NULL OR m.created_at < p_since)
      AND (v_cleared IS NULL OR m.created_at > v_cleared)
    ORDER BY m.created_at DESC
    LIMIT LEAST(p_limit, 100);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_thread(UUID, TIMESTAMPTZ, INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_thread(UUID, TIMESTAMPTZ, INT) TO authenticated;

-- ---------------- get_inbox (v3: + last_has_attachment, keeps S8 watermark) ----------------
DROP FUNCTION IF EXISTS public.get_inbox();
CREATE OR REPLACE FUNCTION public.get_inbox()
RETURNS TABLE (
  peer_id            UUID,
  last_body          TEXT,
  last_at            TIMESTAMPTZ,
  last_sender        UUID,
  unread_count       BIGINT,
  last_has_attachment BOOLEAN
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
  IF v_key IS NULL THEN RAISE EXCEPTION 'dm_body_key missing from vault' USING ERRCODE = 'PT500'; END IF;
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'PT401'; END IF;

  RETURN QUERY
  WITH visible AS (
    SELECT m.id, m.body_enc, m.created_at, m.sender_id, m.recipient_id, m.read_at,
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
      peer, id AS msg_id,
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
         COALESCE(u.unread_count, 0) AS unread_count,
         EXISTS (SELECT 1 FROM public.message_attachments a WHERE a.message_id = l.msg_id) AS last_has_attachment
  FROM latest l
  LEFT JOIN unread u ON u.peer = l.peer
  ORDER BY l.last_at DESC;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_inbox() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_inbox() TO authenticated;

-- ---------------- Storage bucket: dm-attachments (private) ----------------
-- 10 MB/file + a mime allowlist enforced by Storage itself (defense beyond the
-- client + the size_bytes recorded in the row).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dm-attachments', 'dm-attachments', false, 10485760, ARRAY[
  'image/jpeg','image/png','image/gif','image/webp','image/heic',
  'application/pdf',
  'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain','text/csv'
])
ON CONFLICT (id) DO UPDATE
  SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS (on storage.objects). Path shape: <sender_uid>/<message_id>/<file>.
--  • upload/delete only inside your OWN <uid>/ folder (foldername[1] = auth.uid())
--  • read only if you're a participant of the message in folder[2] (text compare,
--    so a malformed path can never raise a uuid cast error mid-policy)
DROP POLICY IF EXISTS "DM attach: own-folder upload" ON storage.objects;
CREATE POLICY "DM attach: own-folder upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dm-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "DM attach: own-folder delete" ON storage.objects;
CREATE POLICY "DM attach: own-folder delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dm-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "DM attach: participant read" ON storage.objects;
CREATE POLICY "DM attach: participant read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dm-attachments'
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id::text = (storage.foldername(name))[2]
        AND auth.uid() IN (m.sender_id, m.recipient_id)
    )
  );

-- Make PostgREST aware of the new/changed functions immediately.
NOTIFY pgrst, 'reload schema';
