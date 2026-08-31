-- ============================================================
-- Club membership — "Join" with a reviewed application.
-- ------------------------------------------------------------
-- organizations.join_questions: what the club asks applicants —
--   same JSONB shape as events.questions ([{ id, prompt, type,
--   options[], required }], ≤ 10). organizations.join_url: an
--   optional external sign-up link (Engage / a form) shown beside Join.
-- org_memberships: one row per student × org. The application IS
--   the membership row: status pending → accepted | rejected, the
--   answers ride on it (can hold PII, so reads are: the applicant,
--   the org owner, and — for accepted rows only — everyone, which is
--   the public roster). UNIQUE (org_id, user_id).
-- apply_to_org(): the one write path — validates required answers,
--   whitelists keys to the org's question ids, caps lengths, rate
--   limits (20 pending applications / hour, PT429), and inserts the
--   pending row (or re-opens a rejected one).
-- decide_org_membership(): owner-only accept / reject; accepting also
--   follows the club for the student (their posts should reach them).
-- Notifications: org_join_request → the owner; org_join_accepted /
--   org_join_rejected → the student (definer triggers, like org_follow).
-- Realtime: the table is published so the student's page flips live.
-- ============================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS join_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS join_url TEXT;
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_join_questions_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_join_questions_check
  CHECK (jsonb_typeof(join_questions) = 'array' AND jsonb_array_length(join_questions) <= 10);
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_join_url_len;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_join_url_len
  CHECK (join_url IS NULL OR char_length(join_url) <= 500);

CREATE TABLE IF NOT EXISTS public.org_memberships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  answers      JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at   TIMESTAMPTZ,
  UNIQUE (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org_status ON public.org_memberships (org_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON public.org_memberships (user_id);

GRANT SELECT ON public.org_memberships TO anon, authenticated;
GRANT DELETE ON public.org_memberships TO authenticated;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;

-- Accepted rows are the public roster (the profile data behind them comes
-- from public_profiles, which is already public). Pending / rejected rows
-- are visible only to the applicant and the club's owner.
CREATE POLICY "Roster is public"
  ON public.org_memberships FOR SELECT TO anon, authenticated
  USING (status = 'accepted');
CREATE POLICY "Applicant or owner reads the application"
  ON public.org_memberships FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.owner_user_id = auth.uid())
  );
-- Withdraw an application / leave the club.
CREATE POLICY "Users leave orgs"
  ON public.org_memberships FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
-- No INSERT/UPDATE policies: the definer RPCs below are the only write path.

-- ---------------- apply ----------------
CREATE OR REPLACE FUNCTION public.apply_to_org(p_org UUID, p_answers JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  org      RECORD;
  existing RECORD;
  q        JSONB;
  qid      TEXT;
  qtype    TEXT;
  val      JSONB;
  clean    JSONB := '{}'::jsonb;
  missing  TEXT[] := '{}';
  s        TEXT;
  recent   INT;
  row_out  RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  SELECT o.id, o.type, o.owner_user_id, o.verified, o.join_questions
    INTO org FROM public.organizations o WHERE o.id = p_org;
  IF org.id IS NULL THEN
    RAISE EXCEPTION 'org not found' USING ERRCODE = 'PT404';
  END IF;
  IF org.type = 'university' OR NOT org.verified THEN
    RAISE EXCEPTION 'this org does not take members' USING ERRCODE = 'PT403';
  END IF;
  IF org.owner_user_id = v_uid THEN
    RAISE EXCEPTION 'you run this org' USING ERRCODE = 'PT403';
  END IF;
  -- Only students apply (org accounts follow, they don't join).
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.account_type <> 'student') THEN
    RAISE EXCEPTION 'only students can join clubs' USING ERRCODE = 'PT403';
  END IF;

  -- An open or accepted application is returned as-is (idempotent tap).
  SELECT m.id, m.status, m.answers INTO existing
    FROM public.org_memberships m WHERE m.org_id = p_org AND m.user_id = v_uid;
  IF existing.id IS NOT NULL AND existing.status <> 'rejected' THEN
    RETURN jsonb_build_object('id', existing.id, 'status', existing.status, 'answers', existing.answers);
  END IF;

  -- Rolling cap: 20 applications an hour per student.
  SELECT count(*) INTO recent FROM public.org_memberships m
    WHERE m.user_id = v_uid AND m.status = 'pending' AND m.requested_at > now() - interval '1 hour';
  IF recent >= 20 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;

  -- Keep only answers to questions the club actually asks; check required ones.
  FOR q IN SELECT * FROM jsonb_array_elements(COALESCE(org.join_questions, '[]'::jsonb)) LOOP
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

  -- New application, or a rejected one re-opened with fresh answers.
  INSERT INTO public.org_memberships (org_id, user_id, status, answers)
  VALUES (p_org, v_uid, 'pending', clean)
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET status = 'pending', answers = EXCLUDED.answers, requested_at = now(), decided_at = NULL
    WHERE public.org_memberships.status = 'rejected'
  RETURNING id, status, answers INTO row_out;

  RETURN jsonb_build_object('id', row_out.id, 'status', row_out.status, 'answers', row_out.answers);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_to_org(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_to_org(UUID, JSONB) TO authenticated;

-- ---------------- decide ----------------
CREATE OR REPLACE FUNCTION public.decide_org_membership(p_id UUID, p_accept BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  m     RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = 'PT401';
  END IF;
  SELECT ms.id, ms.org_id, ms.user_id, ms.status INTO m FROM public.org_memberships ms WHERE ms.id = p_id;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'application not found' USING ERRCODE = 'PT404';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = m.org_id AND o.owner_user_id = v_uid) THEN
    RAISE EXCEPTION 'only the org owner can review applications' USING ERRCODE = 'PT403';
  END IF;
  IF m.status <> 'pending' THEN
    RAISE EXCEPTION 'already decided' USING ERRCODE = 'PT409';
  END IF;

  UPDATE public.org_memberships
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END, decided_at = now()
    WHERE id = p_id;
  -- A new member follows the club so its posts and events reach them.
  IF p_accept THEN
    INSERT INTO public.org_follows (user_id, org_id) VALUES (m.user_id, m.org_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('id', m.id, 'org_id', m.org_id, 'user_id', m.user_id,
                            'status', CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END);
END;
$$;
REVOKE ALL ON FUNCTION public.decide_org_membership(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_org_membership(UUID, BOOLEAN) TO authenticated;

-- Public "N members" without exposing the roster query shape to scrapers.
CREATE OR REPLACE FUNCTION public.org_member_count(p_org UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::int FROM public.org_memberships WHERE org_id = p_org AND status = 'accepted';
$$;
GRANT EXECUTE ON FUNCTION public.org_member_count(UUID) TO anon, authenticated;

-- ---------------- notifications ----------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('post_like', 'post_comment', 'mention', 'org_follow',
                  'org_join_request', 'org_join_accepted', 'org_join_rejected'));

-- Applicant → owner: on a new application, and when a rejected one is re-opened.
CREATE OR REPLACE FUNCTION public.notify_org_join_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  a RECORD;
BEGIN
  IF NEW.status <> 'pending' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' THEN RETURN NEW; END IF;
  SELECT owner_user_id, name INTO o FROM public.organizations WHERE id = NEW.org_id;
  IF o.owner_user_id IS NULL OR o.owner_user_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT * INTO a FROM public.notif_actor(NEW.user_id);
  INSERT INTO public.notifications (user_id, kind, actor_id, actor_name, actor_handle, actor_avatar, org_id, snippet)
  VALUES (o.owner_user_id, 'org_join_request', NEW.user_id, COALESCE(a.name, ''), COALESCE(a.handle, ''), COALESCE(a.avatar, ''), NEW.org_id, COALESCE(o.name, ''));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_org_join_request ON public.org_memberships;
CREATE TRIGGER notify_org_join_request
  AFTER INSERT OR UPDATE OF status ON public.org_memberships
  FOR EACH ROW EXECUTE FUNCTION public.notify_org_join_request();

-- Owner → applicant: the decision. The actor is the org (name + logo).
CREATE OR REPLACE FUNCTION public.notify_org_join_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
BEGIN
  IF OLD.status <> 'pending' OR NEW.status NOT IN ('accepted', 'rejected') THEN RETURN NEW; END IF;
  SELECT owner_user_id, name, logo INTO o FROM public.organizations WHERE id = NEW.org_id;
  INSERT INTO public.notifications (user_id, kind, actor_id, actor_name, actor_handle, actor_avatar, org_id, snippet)
  VALUES (NEW.user_id,
          CASE WHEN NEW.status = 'accepted' THEN 'org_join_accepted' ELSE 'org_join_rejected' END,
          o.owner_user_id, COALESCE(o.name, ''), '', COALESCE(o.logo, ''), NEW.org_id, COALESCE(o.name, ''));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_org_join_decision ON public.org_memberships;
CREATE TRIGGER notify_org_join_decision
  AFTER UPDATE OF status ON public.org_memberships
  FOR EACH ROW EXECUTE FUNCTION public.notify_org_join_decision();

-- ---------------- realtime ----------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'org_memberships')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.org_memberships; END IF;
END $$;
-- UPDATE/DELETE payloads must carry user_id for the client's user_id=eq.<me> filter.
ALTER TABLE public.org_memberships REPLICA IDENTITY FULL;

NOTIFY pgrst, 'reload schema';
