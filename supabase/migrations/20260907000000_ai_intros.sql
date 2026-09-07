-- ============================================================
-- Nested AI intros — the send path for an opener written by Nested AI that goes
-- out AS student A to student B, and the two things the receiver's thread needs
-- to show for it: `origin = 'intro'` (the flame on that one bubble) and
-- `intro_note` (the card's one-line overlap sentence).
--
--  • messages.origin / messages.intro_note — nullable; null = a human message.
--  • get_thread returns both (RETURNS TABLE → DROP + CREATE, body otherwise
--    verbatim from 20260625000003). send_message and get_inbox are untouched:
--    a human send never carries an origin, and the inbox must look normal.
--  • send_intro_message(...) — SECURITY DEFINER, EXECUTE for service_role ONLY.
--    Mirrors send_message minus auth.uid(): vault key, both sides real finished
--    students, not blocked either way, body 1–4000, note ≤ 200, idempotent on
--    the id, and it REFUSES a pair that already has any message (an intro must
--    be the first word) or that was introduced before.
--  • intro_log — one row per introduced pair (unordered-pair unique): the
--    never-repeat guard, and `sender_notified_at` is the dedupe for the
--    "they wrote back" email api/notify.js sends the sender on the first reply.
--
-- The existing zz_email_notify trigger on messages fires for the intro row like
-- any other INSERT → the receiver gets the normal "X messaged you" email.
-- ============================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS origin     TEXT CHECK (origin IN ('intro')),
  ADD COLUMN IF NOT EXISTS intro_note TEXT CHECK (char_length(intro_note) <= 200);

-- ---------------- intro_log ----------------
CREATE TABLE IF NOT EXISTS public.intro_log (
  sender_id          UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id         UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  batch              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sender_notified_at TIMESTAMPTZ,
  PRIMARY KEY (sender_id, recipient_id),
  CHECK (sender_id <> recipient_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS intro_log_pair_uniq
  ON public.intro_log (LEAST(sender_id, recipient_id), GREATEST(sender_id, recipient_id));
ALTER TABLE public.intro_log ENABLE ROW LEVEL SECURITY;   -- no policies: service role only
REVOKE ALL ON public.intro_log FROM PUBLIC, anon, authenticated;

-- ---------------- get_thread: + origin, intro_note ----------------
DROP FUNCTION IF EXISTS public.get_thread(UUID, TIMESTAMPTZ, INT);
CREATE FUNCTION public.get_thread(
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
  attachments  JSONB,
  origin       TEXT,
  intro_note   TEXT
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
           m.created_at, m.read_at, public._dm_attachments_json(m.id) AS attachments,
           m.origin, m.intro_note
    FROM public.messages m
    WHERE ((m.sender_id = v_me AND m.recipient_id = p_peer)
        OR (m.sender_id = p_peer AND m.recipient_id = v_me))
      AND (p_since IS NULL OR m.created_at <= p_since)
      AND (v_cleared IS NULL OR m.created_at > v_cleared)
    ORDER BY m.created_at DESC
    LIMIT LEAST(p_limit, 100);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_thread(UUID, TIMESTAMPTZ, INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_thread(UUID, TIMESTAMPTZ, INT) TO authenticated;

-- ---------------- send_intro_message (service role only) ----------------
CREATE OR REPLACE FUNCTION public.send_intro_message(
  p_id        UUID,
  p_sender    UUID,
  p_recipient UUID,
  p_body      TEXT,
  p_note      TEXT DEFAULT NULL,
  p_batch     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'dm_body_key');
BEGIN
  IF v_key IS NULL THEN RAISE EXCEPTION 'dm_body_key missing from vault' USING ERRCODE = 'PT500'; END IF;
  IF p_id IS NULL OR p_sender IS NULL OR p_recipient IS NULL THEN RAISE EXCEPTION 'missing_ids' USING ERRCODE = 'PT422'; END IF;
  IF p_sender = p_recipient THEN RAISE EXCEPTION 'self_message' USING ERRCODE = 'PT422'; END IF;
  IF char_length(COALESCE(p_body, '')) = 0 THEN RAISE EXCEPTION 'empty_message' USING ERRCODE = 'PT422'; END IF;
  IF char_length(p_body) > 4000 THEN RAISE EXCEPTION 'message_too_long' USING ERRCODE = 'PT422'; END IF;
  IF char_length(COALESCE(p_note, '')) > 200 THEN RAISE EXCEPTION 'note_too_long' USING ERRCODE = 'PT422'; END IF;

  -- Idempotent on the id: a retried run returns the same message.
  IF EXISTS (SELECT 1 FROM public.messages m WHERE m.id = p_id) THEN RETURN p_id; END IF;

  -- Both sides must be real, finished student accounts.
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = p_sender AND p.account_type = 'student' AND p.onboarding_completed) THEN
    RAISE EXCEPTION 'no_such_sender' USING ERRCODE = 'PT422';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = p_recipient AND p.account_type = 'student' AND p.onboarding_completed) THEN
    RAISE EXCEPTION 'no_such_recipient' USING ERRCODE = 'PT422';
  END IF;

  -- A block in either direction ends it (is_blocked_with is caller-scoped, so look directly).
  IF EXISTS (SELECT 1 FROM public.blocks b
             WHERE (b.blocker_id = p_sender AND b.blocked_id = p_recipient)
                OR (b.blocker_id = p_recipient AND b.blocked_id = p_sender)) THEN
    RAISE EXCEPTION 'blocked' USING ERRCODE = 'PT403';
  END IF;

  -- An intro must be the first word between two people, and it only happens once.
  IF EXISTS (SELECT 1 FROM public.messages m
             WHERE (m.sender_id = p_sender AND m.recipient_id = p_recipient)
                OR (m.sender_id = p_recipient AND m.recipient_id = p_sender)) THEN
    RAISE EXCEPTION 'pair_has_history' USING ERRCODE = 'PT409';
  END IF;
  IF EXISTS (SELECT 1 FROM public.intro_log l
             WHERE LEAST(l.sender_id, l.recipient_id) = LEAST(p_sender, p_recipient)
               AND GREATEST(l.sender_id, l.recipient_id) = GREATEST(p_sender, p_recipient)) THEN
    RAISE EXCEPTION 'pair_already_introduced' USING ERRCODE = 'PT409';
  END IF;

  INSERT INTO public.messages (id, sender_id, recipient_id, body_enc, origin, intro_note)
  VALUES (p_id, p_sender, p_recipient, extensions.pgp_sym_encrypt(p_body, v_key), 'intro', NULLIF(p_note, ''));
  INSERT INTO public.intro_log (sender_id, recipient_id, message_id, batch)
  VALUES (p_sender, p_recipient, p_id, p_batch);
  RETURN p_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_intro_message(UUID, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.send_intro_message(UUID, UUID, UUID, TEXT, TEXT, TEXT) TO service_role;
