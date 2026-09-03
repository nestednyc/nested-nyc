-- ============================================================
-- Student-run clubs: students found and own clubs, live on day one.
-- ------------------------------------------------------------
-- Until now only org-email accounts (profiles.account_type =
-- 'org_admin') created organizations, and every org started
-- UNVERIFIED + INVISIBLE until an admin flipped `verified`. Students
-- (account_type = 'student') can now found clubs — several per student
-- — and those go LIVE immediately, labeled "student-run" in the client,
-- with NO verified tick. The org-email flow is unchanged: still
-- unverified + invisible until an admin verifies it.
--
-- organizations.student_run — the one new column. Trigger-stamped from
--   the inserting account's type (never client-set), pinned on UPDATE
--   like `verified` / `spotlight_until`. An admin context (auth.uid()
--   IS NULL: SQL editor / Management API / service role) can still set
--   or clear it by hand.
-- org_student_run_guard (BEFORE INSERT) — for an end-user insert:
--   clears verified / spotlight_until whatever the client sent, stamps
--   student_run, and for a student insists on: a finished profile
--   (PT403), type = 'club' (PT422), a real campus in university_id
--   (PT422), and at most 5 student-run clubs per founder (PT422).
--   Named so it fires BEFORE zz_rl_organizations (BEFORE triggers on
--   one event run in name order).
-- rl_organizations / zz_rl_organizations (BEFORE INSERT) — 3 org
--   inserts per owner per rolling hour, then PT429 'rate_limited'
--   (mirrors rl_events / 20260625000001).
-- org_lock_verified — now also pins student_run, and for a student-run
--   club pins `type` and keeps university_id pointing at a university.
-- RLS widened from "verified" to "live" (verified OR student_run):
--   organizations SELECT, events SELECT + INSERT, posts INSERT (the org
--   branch), org_follows INSERT (which now also refuses an owner
--   following their own org). apply_to_org() takes members for a
--   student-run club too.
-- Identity: public_profiles and notif_actor() resolved "the org this
--   user owns" for EVERY owner. A student who founds a club must keep
--   rendering as themselves (and appear ONCE in public_profiles even
--   with several clubs), so both now join organizations only for
--   org_admin accounts, oldest org first.
--
-- Error codes (PostgREST maps SQLSTATE PTxxx → HTTP xxx; services
-- branch on error.code):
--   PT403 'finish your profile before founding a club'
--   PT422 'students found clubs — pick "Student club"'
--   PT422 'a student-run club needs a campus'
--   PT422 'you already run 5 clubs — that is the limit'
--   PT429 'rate_limited'
--   PT403 'this org does not take members' (apply_to_org, unchanged text)
--
-- Prod audit (run BEFORE applying). student_run is stamped only on
-- INSERT, so any org a student already owns stays student_run = false
-- (unverified, invisible) — decide by hand per row:
--   select o.slug, o.type, o.verified, o.created_at, p.account_type
--     from public.organizations o
--     join public.profiles p on p.id = o.owner_user_id
--    where p.account_type = 'student';            -- expect 0 rows
--   -- to flip one: update public.organizations set student_run = true where slug = '<slug>';
-- Owners with several orgs (public_profiles / notif_actor now pick the
-- OLDEST org of an org_admin; students never resolve to an org):
--   select owner_user_id, count(*) from public.organizations
--    where owner_user_id is not null group by 1 having count(*) > 1;
--
-- Email: the notify_organizations webhook (Insert + Update) already
-- fires on INSERT; api/notify.js planNewOrg reads record.student_run
-- and sends the "student-run club is live" internal mail instead of
-- "waiting for review". No bulk UPDATE here, so nothing to disable.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, DROP … IF
-- EXISTS before every CREATE. Old policy names are dropped alongside
-- the new ones so a re-run converges.
-- ============================================================

-- ---------------- 1. the flag ----------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS student_run BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN public.organizations.student_run IS
  'Founded by a student account. Live without verification, labeled "student-run" (no tick). Trigger-stamped on INSERT, pinned on UPDATE — never client-set.';
CREATE INDEX IF NOT EXISTS idx_organizations_student_run
  ON public.organizations (owner_user_id) WHERE student_run;

-- ---------------- 2. BEFORE INSERT guard ----------------
-- Runs before zz_rl_organizations (name order). Admin / service-role /
-- seed inserts (auth.uid() IS NULL) pass through untouched.
CREATE OR REPLACE FUNCTION public.org_student_run_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_acct TEXT;
  v_done BOOLEAN;
  v_n    INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- End users never self-assign privilege fields, whatever the client sent.
  -- created_at is pinned too so the hourly cap below counts real time.
  NEW.verified        := FALSE;
  NEW.spotlight_until := NULL;
  NEW.created_at      := now();

  SELECT p.account_type, p.onboarding_completed
    INTO v_acct, v_done
    FROM public.profiles p
   WHERE p.id = v_uid;

  NEW.student_run := COALESCE(v_acct = 'student', FALSE);
  IF NOT NEW.student_run THEN
    RETURN NEW;                       -- org_admin flow unchanged
  END IF;

  IF NOT COALESCE(v_done, FALSE) THEN
    RAISE EXCEPTION 'finish your profile before founding a club' USING ERRCODE = 'PT403';
  END IF;
  IF NEW.type IS DISTINCT FROM 'club' THEN
    RAISE EXCEPTION 'students found clubs — pick "Student club"' USING ERRCODE = 'PT422';
  END IF;
  IF NEW.university_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.organizations u
                     WHERE u.id = NEW.university_id AND u.type = 'university') THEN
    RAISE EXCEPTION 'a student-run club needs a campus' USING ERRCODE = 'PT422';
  END IF;

  SELECT COUNT(*) INTO v_n
    FROM public.organizations o
   WHERE o.owner_user_id = v_uid AND o.student_run;
  IF v_n >= 5 THEN
    RAISE EXCEPTION 'you already run 5 clubs — that is the limit' USING ERRCODE = 'PT422';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS org_student_run_guard ON public.organizations;
CREATE TRIGGER org_student_run_guard
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.org_student_run_guard();

-- ---------------- 3. rate limit (mirror rl_events) ----------------
-- Org creation was a once-per-account event; now a student can found
-- several. 3 per owner per rolling hour is far above any real founder
-- and bounds the "new org" admin email + the campus feed.
CREATE OR REPLACE FUNCTION public.rl_organizations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_uid IS NULL OR NEW.owner_user_id IS DISTINCT FROM v_uid THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count
    FROM public.organizations o
   WHERE o.owner_user_id = v_uid
     AND o.created_at > now() - interval '1 hour';

  IF v_count >= 3 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS zz_rl_organizations ON public.organizations;
CREATE TRIGGER zz_rl_organizations
  BEFORE INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.rl_organizations();

-- ---------------- 4. the UPDATE lock ----------------
-- Same trigger as 20260606000001 / 20260830000001 (org_lock_verified,
-- BEFORE UPDATE): a logged-in UPDATE can't change verified,
-- spotlight_until or student_run; a student-run club also keeps its
-- type and its campus (the client can still move it to another
-- university).
CREATE OR REPLACE FUNCTION public.org_lock_verified()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF NEW.verified IS DISTINCT FROM OLD.verified THEN
      NEW.verified := OLD.verified;
    END IF;
    IF NEW.spotlight_until IS DISTINCT FROM OLD.spotlight_until THEN
      NEW.spotlight_until := OLD.spotlight_until;
    END IF;
    IF NEW.student_run IS DISTINCT FROM OLD.student_run THEN
      NEW.student_run := OLD.student_run;
    END IF;
    IF OLD.student_run THEN
      NEW.type := OLD.type;
      IF NEW.university_id IS NULL
         OR NOT EXISTS (SELECT 1 FROM public.organizations u
                         WHERE u.id = NEW.university_id AND u.type = 'university') THEN
        NEW.university_id := OLD.university_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS org_lock_verified ON public.organizations;
CREATE TRIGGER org_lock_verified BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.org_lock_verified();

-- ---------------- 5. RLS: "verified" → "live" ----------------
-- organizations: live orgs are public; an owner always sees their own.
DROP POLICY IF EXISTS "Verified orgs viewable; owner sees own" ON public.organizations;
DROP POLICY IF EXISTS "Live orgs viewable; owner sees own" ON public.organizations;
CREATE POLICY "Live orgs viewable; owner sees own"
  ON public.organizations FOR SELECT TO anon, authenticated
  USING (verified = true OR student_run = true OR owner_user_id = auth.uid());

-- events: visible when the host org is live or owned (legacy null-org
-- events stay visible).
DROP POLICY IF EXISTS "Events viewable when org verified or owned" ON public.events;
DROP POLICY IF EXISTS "Events viewable when org live or owned" ON public.events;
CREATE POLICY "Events viewable when org live or owned"
  ON public.events FOR SELECT TO anon, authenticated
  USING (
    organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = events.organization_id
        AND (o.verified = true OR o.student_run = true OR o.owner_user_id = auth.uid())
    )
  );

-- events: a live org's owner creates them.
DROP POLICY IF EXISTS "Verified org owner can create events" ON public.events;
DROP POLICY IF EXISTS "Live org owner can create events" ON public.events;
CREATE POLICY "Live org owner can create events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND organizer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id
        AND o.owner_user_id = auth.uid()
        AND (o.verified = true OR o.student_run = true)
    )
  );

-- posts: the 20260901000001 text with the org branch widened.
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
        WHERE o.id = org_id
          AND o.owner_user_id = auth.uid()
          AND (o.verified = TRUE OR o.student_run = TRUE)
      )
    )
  );

-- org_follows: follow any live org, never your own. IS DISTINCT FROM (not
-- <>) so universities — seeded, owner_user_id NULL — stay followable.
DROP POLICY IF EXISTS "Users follow verified orgs" ON public.org_follows;
DROP POLICY IF EXISTS "Users follow live orgs" ON public.org_follows;
CREATE POLICY "Users follow live orgs"
  ON public.org_follows FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = org_id
        AND (o.verified = TRUE OR o.student_run = TRUE)
        AND o.owner_user_id IS DISTINCT FROM auth.uid()
    )
  );

-- ---------------- 6. apply_to_org: student-run clubs take members ----------------
-- Body copied from 20260902000000; only the SELECT list (+ o.student_run)
-- and the "takes members" gate change.
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
  SELECT o.id, o.type, o.owner_user_id, o.verified, o.student_run, o.join_questions
    INTO org FROM public.organizations o WHERE o.id = p_org;
  IF org.id IS NULL THEN
    RAISE EXCEPTION 'org not found' USING ERRCODE = 'PT404';
  END IF;
  IF org.type = 'university' OR NOT (org.verified OR org.student_run) THEN
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

-- ---------------- 7. identity: a founder is still a student ----------------
-- public_profiles (20260528000001) COALESCEd an owner's org over their own
-- profile for every owner, and a multi-org owner produced one row per org.
-- Same column list; the org join is now LATERAL, org_admin-only, oldest
-- org first — a student founder renders as themselves, exactly once.
-- DROP + CREATE (not OR REPLACE) for the same reason as 20260528000001.
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT
  p.id,
  COALESCE(o.name, p.first_name)                            AS first_name,
  CASE WHEN o.id IS NOT NULL THEN NULL ELSE p.last_name END AS last_name,
  COALESCE(o.slug, p.username)                              AS username,
  COALESCE(o.logo, p.avatar)                                AS avatar,
  CASE WHEN o.id IS NOT NULL THEN NULL ELSE p.university END AS university
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT x.id, x.name, x.slug, x.logo
    FROM public.organizations x
   WHERE x.owner_user_id = p.id AND p.account_type = 'org_admin'
   ORDER BY x.created_at
   LIMIT 1
) o ON TRUE
WHERE p.onboarding_completed = TRUE OR o.id IS NOT NULL;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- notif_actor (20260831000000): same COALESCEs, org join org_admin-only.
CREATE OR REPLACE FUNCTION public.notif_actor(p_uid UUID)
RETURNS TABLE (name TEXT, handle TEXT, avatar TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(o.name, btrim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))) AS name,
         CASE WHEN o.id IS NULL THEN COALESCE(p.username, '') ELSE '' END AS handle,
         COALESCE(o.logo, p.avatar, '') AS avatar
  FROM public.profiles p
  LEFT JOIN public.organizations o
         ON o.owner_user_id = p.id AND p.account_type = 'org_admin'
  WHERE p.id = p_uid
  ORDER BY o.created_at NULLS LAST
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.notif_actor(UUID) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
