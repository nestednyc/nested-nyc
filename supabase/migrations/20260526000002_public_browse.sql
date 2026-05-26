-- Public browse: let unauthenticated visitors see the marketing surfaces
-- (events feed, event detail with attendees, org profiles, project discover)
-- so they can share/link without forcing a signup wall first.
--
-- Strategy:
--   * Relax SELECT to `anon` on the discovery tables.
--   * Keep `profiles` auth-only; expose a column-restricted view
--     (public_profiles) for the bits we actually need to show
--     (name, avatar, university). Bio / skills / looking_for stay private.
--
-- Mutations (INSERT/UPDATE/DELETE) are unchanged — still auth-gated by the
-- existing policies. Actions in the UI funnel anon users to /auth.

-- ============================================
-- public_profiles VIEW
-- Postgres views run with the definer's privileges by default, so this view
-- bypasses the auth-only RLS on profiles and exposes only the safe columns.
-- ============================================
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  first_name,
  last_name,
  username,
  avatar,
  university
FROM public.profiles
WHERE onboarding_completed = TRUE;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ============================================
-- EVENTS — readable by everyone
-- ============================================
DROP POLICY IF EXISTS "Events viewable by authenticated" ON public.events;
CREATE POLICY "Events viewable by anyone"
  ON public.events FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================
-- EVENT REGISTRATIONS — readable by everyone (powers "who's coming")
-- ============================================
DROP POLICY IF EXISTS "Event registrations viewable" ON public.event_registrations;
CREATE POLICY "Event registrations viewable by anyone"
  ON public.event_registrations FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================
-- ORGANIZATIONS — readable by everyone
-- ============================================
DROP POLICY IF EXISTS "Organizations viewable by authenticated" ON public.organizations;
CREATE POLICY "Organizations viewable by anyone"
  ON public.organizations FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================
-- ORG MEMBERS — readable by everyone (powers org team list)
-- ============================================
DROP POLICY IF EXISTS "Org members viewable by authenticated" ON public.org_members;
CREATE POLICY "Org members viewable by anyone"
  ON public.org_members FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================
-- PROJECTS — anon sees published only; owners still see their drafts
-- ============================================
DROP POLICY IF EXISTS "Projects viewable if published or owned" ON public.projects;

CREATE POLICY "Published projects viewable by anyone"
  ON public.projects FOR SELECT
  TO anon
  USING (publish_to_discover = TRUE);

CREATE POLICY "Published or owned projects viewable when signed in"
  ON public.projects FOR SELECT
  TO authenticated
  USING (publish_to_discover = TRUE OR owner_id = auth.uid());

-- ============================================
-- TEAM MEMBERS — visible when their parent project is visible
-- ============================================
DROP POLICY IF EXISTS "Team members viewable with project" ON public.team_members;

CREATE POLICY "Team members viewable for published projects (anon)"
  ON public.team_members FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id AND publish_to_discover = TRUE
    )
  );

CREATE POLICY "Team members viewable when signed in"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
        AND (publish_to_discover = TRUE OR owner_id = auth.uid())
    )
  );

-- Make PostgREST aware of the new view + policy changes immediately.
NOTIFY pgrst, 'reload schema';
