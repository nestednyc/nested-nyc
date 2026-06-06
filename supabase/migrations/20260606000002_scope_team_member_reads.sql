-- H3: scope team_members SELECT so join-request PII stops leaking.
--
-- team_members rows carry an applicant's name, school, and free-text "why I want
-- to join" message. The two prior SELECT policies (20260526000002_public_browse)
-- exposed EVERY row of any published project — pending and rejected included —
-- with no status filter. The only thing hiding non-approved rows was a
-- client-side .filter(status==='approved') in projectService.js. Since the anon
-- key ships in the JS bundle, a logged-out visitor (or any logged-in account)
-- could query the REST API directly and scrape applicants' PII + messages.
--
-- This replaces both policies so the API itself enforces visibility:
--   * anon            -> APPROVED members of PUBLISHED projects only
--   * authenticated   -> approved-on-published
--                        OR any status on a project you OWN (the join-request
--                           inbox: getPendingRequests / getMyPendingRequests)
--                        OR your OWN row (your pending/rejected status, the
--                           insert().select() round-trip, and the realtime
--                           channel filtered on user_id in NestedApp.jsx)
--
-- No bare USING(true) SELECT policy exists on this table, so these two are the
-- complete SELECT surface. Idempotent (DROP IF EXISTS / CREATE).

DROP POLICY IF EXISTS "Team members viewable for published projects (anon)" ON public.team_members;
DROP POLICY IF EXISTS "Team members viewable when signed in" ON public.team_members;

-- anon: only approved members of published projects
CREATE POLICY "Approved members viewable on published projects (anon)"
  ON public.team_members FOR SELECT
  TO anon
  USING (
    status = 'approved'
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = team_members.project_id
        AND p.publish_to_discover = TRUE
    )
  );

-- authenticated: approved-on-published OR owner-of-project OR your-own-row
CREATE POLICY "Team members viewable when signed in"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (
    (
      status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = team_members.project_id
          AND p.publish_to_discover = TRUE
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = team_members.project_id
        AND p.owner_id = auth.uid()
    )
    OR team_members.user_id = auth.uid()
  );

-- Make PostgREST aware of the policy changes immediately.
NOTIFY pgrst, 'reload schema';
