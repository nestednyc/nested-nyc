-- ============================================================
-- Event RSVP questions — a mini form per event.
-- ------------------------------------------------------------
-- events.questions: what the host wants to know from attendees —
--   [{ id, prompt, type, options[], required }], type ∈ short /
--   long / choice / multi / date / yesno, at most 10 (same JSONB
--   pattern as projects.roles). Editable by the host like any field.
-- event_rsvp_answers: one row per attendee × event, keyed onto the
--   registration itself (FK on the composite PK, ON DELETE CASCADE —
--   un-RSVP wipes the answers). Answers can hold PII (a birthday), so
--   they get their own table with strict rows: the attendee and the
--   host org's owner can read; only the attendee writes.
-- rsvp_with_answers(): the one write path when an event has
--   questions — validates required answers server-side, whitelists
--   keys to the event's question ids, caps lengths, then inserts the
--   registration (the rl_event_registrations rate limit still fires)
--   and upserts the answers in the same transaction.
-- ============================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS questions JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_questions_check;
ALTER TABLE public.events ADD CONSTRAINT events_questions_check
  CHECK (jsonb_typeof(questions) = 'array' AND jsonb_array_length(questions) <= 10);

CREATE TABLE IF NOT EXISTS public.event_rsvp_answers (
  event_id     UUID NOT NULL,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answers      JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id),
  FOREIGN KEY (event_id, user_id)
    REFERENCES public.event_registrations(event_id, user_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_event_rsvp_answers_event ON public.event_rsvp_answers (event_id, submitted_at);

GRANT SELECT ON public.event_rsvp_answers TO authenticated;
ALTER TABLE public.event_rsvp_answers ENABLE ROW LEVEL SECURITY;

-- Host = the owner of the org that hosts the event.
CREATE OR REPLACE FUNCTION public.is_event_host(p_event UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    JOIN public.organizations o ON o.id = e.organization_id
    WHERE e.id = p_event AND o.owner_user_id = auth.uid()
  );
$$;
REVOKE ALL ON FUNCTION public.is_event_host(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_event_host(UUID) TO authenticated;

CREATE POLICY "Attendee or host reads answers"
  ON public.event_rsvp_answers FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_event_host(event_id));
-- No INSERT/UPDATE/DELETE policies: the RPC below is the only write path
-- (definer), and the registration's cascade is the only delete.

-- ---------------- the write path ----------------
CREATE OR REPLACE FUNCTION public.rsvp_with_answers(p_event UUID, p_answers JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  ev      RECORD;
  q       JSONB;
  qid     TEXT;
  qtype   TEXT;
  val     JSONB;
  clean   JSONB := '{}'::jsonb;
  missing TEXT[] := '{}';
  s       TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  SELECT e.id, e.questions, e.max_attendees, e.attendees, e.date, e.organization_id
    INTO ev FROM public.events e WHERE e.id = p_event;
  IF ev.id IS NULL THEN
    RAISE EXCEPTION 'event not found' USING ERRCODE = 'PT404';
  END IF;
  IF public.is_event_host(p_event) THEN
    RAISE EXCEPTION 'hosts cannot RSVP to their own event' USING ERRCODE = 'PT403';
  END IF;
  IF ev.max_attendees IS NOT NULL AND ev.attendees >= ev.max_attendees
     AND NOT EXISTS (SELECT 1 FROM public.event_registrations r WHERE r.event_id = p_event AND r.user_id = v_uid) THEN
    RAISE EXCEPTION 'event is full' USING ERRCODE = 'PT409';
  END IF;

  -- Keep only answers to questions the event actually asks; check required ones.
  FOR q IN SELECT * FROM jsonb_array_elements(COALESCE(ev.questions, '[]'::jsonb)) LOOP
    qid   := q->>'id';
    qtype := COALESCE(q->>'type', 'short');
    val   := COALESCE(p_answers, '{}'::jsonb) -> qid;
    IF qid IS NULL THEN CONTINUE; END IF;
    IF qtype = 'multi' THEN
      IF val IS NOT NULL AND jsonb_typeof(val) = 'array' AND jsonb_array_length(val) > 0 THEN
        clean := clean || jsonb_build_object(qid, (SELECT jsonb_agg(left(x, 200)) FROM jsonb_array_elements_text(val) AS x LIMIT 20));
      ELSIF COALESCE((q->>'required')::boolean, false) THEN
        missing := array_append(missing, COALESCE(q->>'prompt', 'a question'));
      END IF;
    ELSE
      s := CASE WHEN val IS NULL OR jsonb_typeof(val) = 'null' THEN NULL
                WHEN jsonb_typeof(val) = 'string' THEN val #>> '{}'
                ELSE val::text END;
      IF s IS NOT NULL AND btrim(s) <> '' THEN
        clean := clean || jsonb_build_object(qid, left(btrim(s), CASE WHEN qtype = 'long' THEN 1000 ELSE 300 END));
      ELSIF COALESCE((q->>'required')::boolean, false) THEN
        missing := array_append(missing, COALESCE(q->>'prompt', 'a question'));
      END IF;
    END IF;
  END LOOP;
  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'Please answer: %', array_to_string(missing, ', ') USING ERRCODE = 'PT422';
  END IF;

  -- The registration (rate-limited by zz_rl_event_registrations) …
  INSERT INTO public.event_registrations (event_id, user_id)
  VALUES (p_event, v_uid)
  ON CONFLICT DO NOTHING;
  -- … and the answers, replaced wholesale on re-submit.
  INSERT INTO public.event_rsvp_answers (event_id, user_id, answers)
  VALUES (p_event, v_uid, clean)
  ON CONFLICT (event_id, user_id) DO UPDATE
    SET answers = EXCLUDED.answers, updated_at = now();

  RETURN clean;
END;
$$;
REVOKE ALL ON FUNCTION public.rsvp_with_answers(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rsvp_with_answers(UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
