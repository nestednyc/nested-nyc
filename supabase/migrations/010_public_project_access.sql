-- Allow anonymous/public users to view published projects
-- This enables sharing project links with non-logged-in users

-- Drop existing policy first (if it exists)
DROP POLICY IF EXISTS "Projects viewable if published or owned" ON public.projects;

-- Create new policy that allows:
-- 1. Anyone (including anon) to view published projects
-- 2. Authenticated owners to view their own unpublished projects
CREATE POLICY "Published projects are public"
  ON public.projects FOR SELECT
  USING (
    publish_to_discover = TRUE
    OR (auth.uid() IS NOT NULL AND owner_id = auth.uid())
  );

-- Also allow anon users to view team members of published projects
DROP POLICY IF EXISTS "Team members viewable with project" ON public.team_members;

CREATE POLICY "Team members viewable with project"
  ON public.team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE id = project_id
      AND (
        publish_to_discover = TRUE
        OR (auth.uid() IS NOT NULL AND owner_id = auth.uid())
      )
    )
  );
