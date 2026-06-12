-- ============================================================
-- Project co-leads: enforce `projects.admins` at the RLS layer.
--
-- The cork-board UI has carried co-admin support since 20260602000000
-- (`admins TEXT[]` + isProjectAdmin in src/design/data.jsx): anyone in
-- `admins` gets the Edit CTA, the inline status picker, and the "latest
-- update" note composer. But every policy still checked owner_id only,
-- so a promoted co-lead's writes would bounce off RLS. This migration
-- makes the array real:
--   * projects UPDATE       -> owner OR co-lead (edit flyer, status, alert)
--   * projects SELECT/auth  -> co-leads also see their unpublished flyers
--   * team_members          -> co-leads manage join requests too
--   * owner_id + admins     -> still owner-only, via a BEFORE UPDATE
--     trigger (otherwise the widened UPDATE policy would let a co-lead
--     rewrite `admins`/`owner_id` and hijack the flyer)
--
-- Tokens in `admins` are profile UUIDs as text (the client's ownerToken
-- falls back to usernames only in local/mock mode, which never reaches
-- the DB). Idempotent: DROP IF EXISTS / CREATE OR REPLACE throughout.
-- ============================================================

-- ── Backfill: every flyer's owner belongs in its admins array ──────────
-- The client has defaulted admins to [ownerId] on create/update since the
-- cork-board launch, but rows created before that (or via SQL) may still
-- carry '{}'. Run BEFORE the ownership trigger exists so nothing blocks it.
UPDATE public.projects
SET admins = array_append(COALESCE(admins, '{}'), owner_id::text)
WHERE owner_id IS NOT NULL
  AND NOT (owner_id::text = ANY (COALESCE(admins, '{}')));

-- Membership lookups now happen inside policies — index the array.
CREATE INDEX IF NOT EXISTS idx_projects_admins
  ON public.projects USING GIN (admins);

-- ── Helper: is the caller the owner or a co-lead of this project? ──────
-- SECURITY DEFINER so team_members policies can consult projects without
-- re-entering projects' own SELECT policies (same pattern as is_org_member).
CREATE OR REPLACE FUNCTION public.is_project_admin(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = p_project_id
      AND (p.owner_id = auth.uid()
           OR auth.uid()::text = ANY (COALESCE(p.admins, '{}')))
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_project_admin(UUID) TO authenticated;

-- ── Trigger: ownership columns stay owner-only ─────────────────────────
-- The widened UPDATE policy below lets co-leads write the projects row, so
-- the columns that DEFINE the privilege must be pinned: only the current
-- owner may change owner_id or admins. auth.uid() IS NULL (SQL editor /
-- service role maintenance) is deliberately let through — end-user requests
-- always carry a uid.
CREATE OR REPLACE FUNCTION public.projects_guard_ownership_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.owner_id IS DISTINCT FROM OLD.owner_id
      OR NEW.admins IS DISTINCT FROM OLD.admins)
     AND auth.uid() IS NOT NULL
     AND auth.uid() IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Only the project owner can change ownership or co-leads'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_guard_ownership ON public.projects;
CREATE TRIGGER projects_guard_ownership
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.projects_guard_ownership_cols();

-- ── projects: SELECT (authenticated) includes co-led flyers ────────────
DROP POLICY IF EXISTS "Published or owned projects viewable when signed in" ON public.projects;
CREATE POLICY "Published, owned, or co-led projects viewable when signed in"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    publish_to_discover = TRUE
    OR owner_id = auth.uid()
    OR auth.uid()::text = ANY (COALESCE(admins, '{}'))
  );

-- ── projects: UPDATE opens to co-leads ─────────────────────────────────
-- (DELETE stays owner-only — "Owners can delete projects" is untouched.)
DROP POLICY IF EXISTS "Owners can update projects" ON public.projects;
CREATE POLICY "Owners and co-leads can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR auth.uid()::text = ANY (COALESCE(admins, '{}'))
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR auth.uid()::text = ANY (COALESCE(admins, '{}'))
  );

-- ── team_members: co-leads run the join-request inbox too ──────────────
-- The self-service policies ("Users can request to join projects",
-- "Users can leave projects") are untouched.
DROP POLICY IF EXISTS "Project owners can add team members" ON public.team_members;
CREATE POLICY "Project leads can add team members"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_project_admin(project_id));

DROP POLICY IF EXISTS "Project owners can update team members" ON public.team_members;
CREATE POLICY "Project leads can update team members"
  ON public.team_members FOR UPDATE
  TO authenticated
  USING (public.is_project_admin(project_id))
  WITH CHECK (public.is_project_admin(project_id));

DROP POLICY IF EXISTS "Project owners can remove team members" ON public.team_members;
CREATE POLICY "Project leads can remove team members"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (public.is_project_admin(project_id));

-- SELECT: the owner-of-project branch (the pending-request inbox carved out
-- in 20260606000002) widens to co-leads; the approved-on-published and
-- own-row branches are unchanged, as is the anon policy.
DROP POLICY IF EXISTS "Team members viewable when signed in" ON public.team_members;
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
    OR public.is_project_admin(team_members.project_id)
    OR team_members.user_id = auth.uid()
  );

-- Make PostgREST aware of the policy changes immediately.
NOTIFY pgrst, 'reload schema';
