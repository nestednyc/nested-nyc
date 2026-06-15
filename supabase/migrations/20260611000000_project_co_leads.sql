-- ============================================================
-- Project co-leads: enforce `projects.admins` at the RLS layer.
--
-- The cork-board UI has carried co-admin support since 20260602000000
-- (`admins TEXT[]` + isProjectAdmin in src/design/data.jsx): anyone in
-- `admins` gets the Edit CTA, the inline status picker, and the "latest
-- update" note composer. But every policy still checked owner_id only,
-- so a promoted co-lead's writes would bounce off RLS. This migration
-- makes the array real, with `admins ⊆ {owner} ∪ approved members` as a
-- DB-enforced invariant:
--   * projects UPDATE        -> owner OR co-lead (edit flyer, status, alert)
--   * projects SELECT/auth   -> co-leads also see their unpublished flyers
--   * team_members UPDATE    -> co-leads run the join inbox (PENDING rows)
--   * team_members INS/DEL   -> owner-only (kick is an owner-only product
--     rule; reject is an UPDATE, so co-leads never need DELETE)
--   * owner_id + admins      -> owner-only via a BEFORE UPDATE pin trigger
--     (org_lock_verified house style); grants revoke automatically when
--     the member's team row goes away (AFTER DELETE/UPDATE sync trigger)
--
-- Tokens in `admins` are profile UUIDs as text (the client's ownerToken
-- falls back to usernames only in local/mock mode, which never reaches
-- the DB). The client writes admins ONLY through setProjectAdmins;
-- updateProject strips it (same split as orgService.updateOrg).
-- Idempotent + convergent: DROP IF EXISTS covers both the 002-era policy
-- names and this migration's earlier draft names, so a DB that ran the
-- draft and a fresh DB end up identical.
-- ============================================================

-- ── Backfill 1: every flyer's owner belongs in its admins array ────────
-- The client has defaulted admins to [ownerId] on create/update since the
-- cork-board launch, but rows created before that (or via SQL) may still
-- carry '{}'. Run BEFORE the ownership trigger exists so nothing blocks it.
UPDATE public.projects
SET admins = array_append(COALESCE(admins, '{}'), owner_id::text)
WHERE owner_id IS NOT NULL
  AND NOT (owner_id::text = ANY (COALESCE(admins, '{}')));

-- ── Backfill 2: prune ghost grants (and dupes) ──────────────────────────
-- Establishes the invariant before the triggers start enforcing it:
-- admins := {owner} ∪ approved members. A ghost token (no approved team
-- row) would otherwise hold invisible, UI-irrevocable edit rights.
UPDATE public.projects p
SET admins = (
  SELECT COALESCE(array_agg(DISTINCT t.token), '{}')
  FROM unnest(p.admins) AS t(token)
  WHERE t.token = p.owner_id::text
     OR EXISTS (SELECT 1 FROM public.team_members tm
                WHERE tm.project_id = p.id
                  AND tm.user_id::text = t.token
                  AND tm.status = 'approved')
)
WHERE EXISTS (
  SELECT 1 FROM unnest(p.admins) AS t(token)
  WHERE t.token IS DISTINCT FROM p.owner_id::text
    AND NOT EXISTS (SELECT 1 FROM public.team_members tm
                    WHERE tm.project_id = p.id
                      AND tm.user_id::text = t.token
                      AND tm.status = 'approved')
);

-- Both backfills leave no NULLs (DEFAULT '{}' since 20260602000000) — pin
-- the column so the @> predicates below never hit the NULL corner.
ALTER TABLE public.projects ALTER COLUMN admins SET NOT NULL;

-- The client's lead-inbox query filters `admins.cs.{uid}` (= @>), which a
-- GIN index serves (BitmapOr with the owner btree). The policies below
-- also use @>, though on PK-targeted statements they evaluate per-row.
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
           OR p.admins @> ARRAY[auth.uid()::text])
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_project_admin(UUID) TO authenticated;

-- ── Trigger: ownership columns stay owner-only (pin, don't raise) ───────
-- The widened UPDATE policy below lets co-leads write the projects row, so
-- the columns that DEFINE the privilege must be guarded. House style is to
-- PIN (org_lock_verified / profile_lock_account_type): a stale client that
-- round-trips admins gets it silently reset to the DB value and the rest of
-- the edit succeeds. The owner's own changes are validated instead: a NEW
-- grant may only go to the (new) owner or an approved member.
CREATE OR REPLACE FUNCTION public.projects_guard_ownership_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fast path: nothing privileged changed (flyer edits, status/alert,
  -- spots counters, the view-count trigger chain).
  IF NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id
     AND NEW.admins IS NOT DISTINCT FROM OLD.admins THEN
    RETURN NEW;
  END IF;

  -- No end-user JWT: service role / SQL editor / auth cascades.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.owner_id THEN
    -- Validate ADDED tokens only. Removals can't mint privilege, and
    -- validating survivors would let one pre-existing ghost grant wedge
    -- every later kick/demote (including the revoke-sync UPDATE fired
    -- from team_members deletes, which would abort the kick itself).
    IF EXISTS (
      SELECT 1 FROM (
        SELECT unnest(COALESCE(NEW.admins, '{}')) AS token
        EXCEPT
        SELECT unnest(COALESCE(OLD.admins, '{}'))
      ) AS added
      WHERE added.token IS DISTINCT FROM NEW.owner_id::text
        AND NOT EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.project_id = OLD.id
            AND tm.user_id::text = added.token
            AND tm.status = 'approved'
        )
    ) THEN
      RAISE EXCEPTION 'Co-leads must be approved team members of this project'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- Non-owner shrinking the array by exactly their own token, owner
  -- unchanged: the shape the revoke-sync trigger produces on self-leave.
  -- (It runs as table owner — bypasses RLS, NOT triggers — so the pin
  -- below would otherwise silently undo the revoke.)
  IF NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id
     AND NEW.admins IS NOT DISTINCT FROM array_remove(OLD.admins, auth.uid()::text) THEN
    RETURN NEW;
  END IF;

  -- Everyone else (e.g. a stale co-lead edit round-tripping admins): pin.
  -- Runs BEFORE the UPDATE policy's WITH CHECK, so restoring OLD.admins is
  -- also what keeps that co-lead passing the policy.
  NEW.owner_id := OLD.owner_id;
  NEW.admins   := OLD.admins;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_guard_ownership ON public.projects;
CREATE TRIGGER projects_guard_ownership
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.projects_guard_ownership_cols();

-- ── Trigger: grants revoke when the membership goes away ────────────────
-- Keeps admins ⊆ {owner} ∪ approved members from the team_members side:
-- self-leave, owner kick, account deletion (user_id is ON DELETE SET NULL,
-- hence the UPDATE OF user_id leg), or a service-side status flip all strip
-- the departing member's token at the source of truth. SECURITY DEFINER is
-- required: as table owner it bypasses projects RLS, whose WITH CHECK would
-- reject the post-revoke row for a self-leaver. It does NOT bypass the
-- guard trigger above — self-leave passes via its self-removal branch,
-- owner-kick via the owner branch (pure removal), cascades via uid NULL.
CREATE OR REPLACE FUNCTION public.team_members_revoke_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- UPDATE firings: act only when the member identity is detached
  -- (account-deletion SET NULL) or approved-ness ends.
  IF TG_OP = 'UPDATE'
     AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND NOT (OLD.status = 'approved' AND NEW.status IS DISTINCT FROM 'approved') THEN
    RETURN NULL;
  END IF;
  IF OLD.user_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.projects p
  SET admins = array_remove(p.admins, OLD.user_id::text)
  WHERE p.id = OLD.project_id
    AND p.admins @> ARRAY[OLD.user_id::text]      -- skip no-ops: no guard trip, no updated_at bump
    AND p.owner_id IS DISTINCT FROM OLD.user_id;  -- never strip the owner's token
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS team_members_revoke_admin ON public.team_members;
CREATE TRIGGER team_members_revoke_admin
  AFTER DELETE OR UPDATE OF user_id, status ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.team_members_revoke_admin();

-- ── projects: SELECT (authenticated) includes co-led flyers ────────────
DROP POLICY IF EXISTS "Published or owned projects viewable when signed in" ON public.projects;
DROP POLICY IF EXISTS "Published, owned, or co-led projects viewable when signed in" ON public.projects;
CREATE POLICY "Published, owned, or co-led projects viewable when signed in"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    publish_to_discover = TRUE
    OR owner_id = auth.uid()
    OR admins @> ARRAY[auth.uid()::text]
  );

-- ── projects: UPDATE opens to co-leads ─────────────────────────────────
-- (DELETE stays owner-only — "Owners can delete projects" is untouched.)
DROP POLICY IF EXISTS "Owners can update projects" ON public.projects;
DROP POLICY IF EXISTS "Owners and co-leads can update projects" ON public.projects;
CREATE POLICY "Owners and co-leads can update projects"
  ON public.projects FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR admins @> ARRAY[auth.uid()::text]
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR admins @> ARRAY[auth.uid()::text]
  );

-- ── team_members: co-leads run the join inbox; kick stays owner-only ────
-- The self-service policies ("Users can request to join projects",
-- "Users can leave projects") are untouched.

-- INSERT: owner-only (002 shape). The only client INSERT-for-the-project
-- path is the creator stamping their own row, which the 009 self-insert
-- policy covers anyway.
DROP POLICY IF EXISTS "Project leads can add team members" ON public.team_members;
DROP POLICY IF EXISTS "Project owners can add team members" ON public.team_members;
CREATE POLICY "Project owners can add team members"
  ON public.team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects
            WHERE id = project_id AND owner_id = auth.uid())
  );

-- UPDATE: leads run the join inbox — over PENDING rows only (approve /
-- reject). Approved rows are immutable to leads: kick is owner-only and a
-- DELETE, so an admin-wide UPDATE would be a stealth kick (flip approved →
-- rejected).
DROP POLICY IF EXISTS "Project owners can update team members" ON public.team_members;
DROP POLICY IF EXISTS "Project leads can update team members" ON public.team_members;
CREATE POLICY "Project leads can update pending team members"
  ON public.team_members FOR UPDATE
  TO authenticated
  USING (public.is_project_admin(project_id) AND status = 'pending')
  WITH CHECK (public.is_project_admin(project_id));

-- DELETE: owner-only (002 shape). Load-bearing beyond the product rule: the
-- ownership guard's branch coverage assumes only the owner (or the member
-- themselves, via 009 self-leave) can delete rows — do NOT re-widen without
-- revisiting projects_guard_ownership_cols.
DROP POLICY IF EXISTS "Project leads can remove team members" ON public.team_members;
DROP POLICY IF EXISTS "Project owners can remove team members" ON public.team_members;
CREATE POLICY "Project owners can remove team members"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects
            WHERE id = project_id AND owner_id = auth.uid())
  );

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
