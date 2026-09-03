-- ============================================================
-- Verification retired: every org is live the moment it exists.
-- ------------------------------------------------------------
-- Product decision 2026-09-03 (Hamza): the admin "verify" gate — and
-- the .edu stamp / verified tick that came with it — is no longer a
-- thing. Until now an org-email account's page, events and posts stayed
-- invisible until someone ran `update organizations set verified = true`
-- (20260606000001); student-run clubs had just been made live on day one
-- (20260903000000). This levels it: ANY org is public, can host events,
-- post as the org, be followed and take members, from creation.
--
-- The `verified` column stays (nothing reads it any more; the
-- org_lock_verified trigger still pins it so nobody self-flips it) — a
-- future "featured" or "official" marker can reuse it without a schema
-- change. `student_run` keeps meaning "founded by a student account"
-- (the client labels those "student-run"); it no longer gates anything.
--
-- RLS: the (verified OR student_run) predicates from 20260903000000
-- become ownership-only:
--   organizations SELECT — everyone (was: live OR owner)
--   events SELECT        — everyone (was: null-org OR live OR owner)
--   events INSERT        — the host org's owner (was: + live)
--   posts INSERT         — org branch: the org's owner (was: + live)
--   org_follows INSERT   — any org except your own (was: + live)
--   apply_to_org()       — only universities refuse members (was: + live)
-- No data changes, so no email trigger fires (zz_email_notify reacts to
-- UPDATEs on organizations, and there are none here).
--
-- Idempotent: DROP POLICY IF EXISTS (old + new names) before CREATE,
-- CREATE OR REPLACE for the function.
-- ============================================================

-- ---------------- organizations: public ----------------
DROP POLICY IF EXISTS "Verified orgs viewable; owner sees own" ON public.organizations;
DROP POLICY IF EXISTS "Live orgs viewable; owner sees own"     ON public.organizations;
DROP POLICY IF EXISTS "Organizations viewable by anyone"       ON public.organizations;
CREATE POLICY "Organizations viewable by anyone"
  ON public.organizations FOR SELECT TO anon, authenticated
  USING (true);

-- ---------------- events: public; hosted by the org's owner ----------------
DROP POLICY IF EXISTS "Events viewable when org verified or owned" ON public.events;
DROP POLICY IF EXISTS "Events viewable when org live or owned"     ON public.events;
DROP POLICY IF EXISTS "Events viewable by anyone"                  ON public.events;
CREATE POLICY "Events viewable by anyone"
  ON public.events FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Verified org owner can create events" ON public.events;
DROP POLICY IF EXISTS "Live org owner can create events"     ON public.events;
DROP POLICY IF EXISTS "Org owner can create events"          ON public.events;
CREATE POLICY "Org owner can create events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND organizer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.owner_user_id = auth.uid()
    )
  );

-- ---------------- posts: the org branch is ownership only ----------------
-- (20260901000001 text, minus the live condition; can_tag_project kept.)
DROP POLICY IF EXISTS "Users create own posts" ON public.posts;
CREATE POLICY "Users create own posts"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (project_id IS NULL OR public.can_tag_project(project_id))
    AND (
      org_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = org_id AND o.owner_user_id = auth.uid()
      )
    )
  );

-- ---------------- org_follows: any org but your own ----------------
DROP POLICY IF EXISTS "Users follow verified orgs" ON public.org_follows;
DROP POLICY IF EXISTS "Users follow live orgs"     ON public.org_follows;
DROP POLICY IF EXISTS "Users follow orgs"          ON public.org_follows;
CREATE POLICY "Users follow orgs"
  ON public.org_follows FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id
        AND o.owner_user_id IS DISTINCT FROM auth.uid()
    )
  );

-- ---------------- apply_to_org: only universities refuse members ----------------
-- Body identical to 20260903000000 except the "takes members" gate.
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
  SELECT o.id, o.type, o.owner_user_id, o.join_questions
    INTO org FROM public.organizations o WHERE o.id = p_org;
  IF org.id IS NULL THEN
    RAISE EXCEPTION 'org not found' USING ERRCODE = 'PT404';
  END IF;
  IF org.type = 'university' THEN
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

NOTIFY pgrst, 'reload schema';
