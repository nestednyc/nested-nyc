-- ============================================================
-- M1 — Scope profile reads (stop full-userbase, full-row scrape)
--
-- Problem: the profiles SELECT policy is `USING (true)` for the
-- `authenticated` role, so any logged-in account can run
-- `select * from profiles` and pull every column of every row.
--
-- Severity note: there is NO email/phone/password in profiles (those live
-- in auth.users, which PostgREST does not expose), so this is a directory
-- scrape + a standing blast-radius for any *future* sensitive column —
-- not an immediate PII leak. Hence "Medium, partly by-design".
--
-- Fix = the tiered model real social networks use:
--   1) Directory surface  -> a column-scoped `student_cards` view (definer),
--      carrying only the fields the People grid renders. getAllProfiles reads
--      this instead of profiles.*  =>  future columns are NOT auto-exposed,
--      and the denormalized `projects` blob + `updated_at` leave the surface.
--   2) Full-row base table -> readable only for rows you have a relationship
--      with: yourself, connections (either direction), and teammates on
--      projects you can already see.
--
-- Why BOTH relationship arms are required (verified against the consumers):
--   * connections arm  — connectionService.js:19,40 embed `profiles(*)` with
--     NO fallback (`.filter(Boolean)` drops null rows), so without this arm
--     your connection / incoming cards vanish entirely. HARD dependency.
--   * teammates arm    — projectService embeds team_members→profiles in 7
--     reads. Only getDiscoverProjects/getProject hydrate from public_profiles
--     on a null embed; the other 5 (getMyProjects, getProjectsByCategory,
--     searchProjects, getJoinedProjects, getRequestedProjects) do NOT — so
--     without this arm their team facepiles regress to initials. Indexes
--     already cover it (idx_team_members_project, idx_projects_owner).
--   Note: team_members has its own RLS (20260606000002), so effective
--   visibility is the intersection — pending applicants stay hidden from
--   non-owners. That's the intended behavior.
--
-- APPLY ORDER (zero-downtime; the SQL API and the Vercel deploy are NOT
-- atomic, so the narrowing must be a single, reversible final step):
--   STEP 1 — create the view (safe, additive).
--   STEP 2 — apply the new policy ALONGSIDE the old USING(true) one. Because
--            permissive SELECT policies are OR'd, effective access stays
--            `true OR relationships` = `true`: ZERO behavior change. Safe now.
--   STEP 3 — deploy the frontend so getAllProfiles reads `student_cards`.
--   STEP 4 — the ONLY narrowing step: drop the old USING(true) policy. Apply
--            ONLY after STEP 3 is live. Instant rollback = re-create it (one
--            statement, no redeploy, no view dependency).
-- ============================================================

-- ---------- STEP 1: directory view (safe, additive) ----------
CREATE OR REPLACE VIEW public.student_cards AS
SELECT
  id, first_name, last_name, username, avatar, photos,
  university, major, year, bio, fields, skills, tech_stack,
  building, availability, links, account_type, created_at
FROM public.profiles
WHERE onboarding_completed = TRUE;
-- A default (non-security_invoker) view runs with the definer's rights and
-- bypasses the base-table RLS below, so the directory still lists everyone
-- — only the column set is narrowed. Intentional.

GRANT SELECT ON public.student_cards TO authenticated;

-- ---------- STEP 2: add the relationship policy (safe, additive — no-op while the old policy exists) ----------
CREATE POLICY "Profiles readable for self + relationships"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (                                   -- a connection, either direction
      SELECT 1 FROM public.connections c
      WHERE (c.user_id = auth.uid() AND c.target_id = profiles.id)
         OR (c.target_id = auth.uid() AND c.user_id = profiles.id)
    )
    OR EXISTS (                                   -- a teammate on a project you can see
      SELECT 1 FROM public.team_members tm
      JOIN public.projects p ON p.id = tm.project_id
      WHERE tm.user_id = profiles.id
        AND (p.publish_to_discover = TRUE OR p.owner_id = auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';

-- ---------- STEP 4: the narrowing step — APPLY ONLY AFTER the student_cards frontend deploy is LIVE ----------
-- Left commented so this migration is safe to run as-is (view + additive policy only).
--
-- DROP POLICY "Profiles viewable by authenticated users" ON public.profiles;
-- NOTIFY pgrst, 'reload schema';
--
-- Rollback (instant, if anything misbehaves):
-- CREATE POLICY "Profiles viewable by authenticated users"
--   ON public.profiles FOR SELECT TO authenticated USING (true);
