-- ============================================================
-- Co-leads can remove regular crew.
--
-- ⚠ DEPLOY ORDER: apply this migration to prod BEFORE merging the frontend
-- change to main (Vercel auto-deploys from main). Until it is applied, a
-- co-lead's kick is RLS-filtered to a 0-row DELETE — the client's
-- removeTeamMember detects the 0-row result and shows a failure toast, so it
-- degrades loudly, not silently. Prod's schema_migrations can drift from this
-- folder (see CLAUDE.md): verify prod's actual team_members DELETE policy
-- before trusting `supabase db push`; the DROP IF EXISTS list below covers
-- the 002 / 20260611 / this migration's policy names either way.
--
-- Until now, deleting a team_members row (a "kick") was owner-only — the
-- 20260611000000 DELETE policy checked owner_id, and its header flagged that
-- as load-bearing ("do NOT re-widen without revisiting
-- projects_guard_ownership_cols"). A promoted co-lead could edit the flyer,
-- post updates, and approve/decline join requests, but not remove a member.
-- This migration widens DELETE to co-leads — for REGULAR crew only — and
-- gives projects_guard_ownership_cols the revisit that warning asked for.
--
-- Product rule: the owner removes anyone; a co-lead removes regular crew but
-- never the owner and never another co-lead. Removing/demoting a co-lead
-- stays owner-only (the same rule that keeps projects.admins owner-managed).
--
-- Two layers keep the grant bookkeeping safe now that non-owners can delete
-- other people's team rows:
--
--   1. The DELETE policy restricts co-lead kicks to non-admins targets, so
--      in the common case the departing member holds no grant and
--      team_members_revoke_admin's UPDATE on projects never fires.
--   2. That restriction is snapshot-scoped, not absolute: under READ
--      COMMITTED a co-lead's kick can race an owner's promote of the same
--      member, and the revoke UPDATE then fires under the CO-LEAD's JWT
--      against a token granted after the kick's snapshot. The old guard had
--      no passing branch for that writer — its pin branch would silently
--      restore OLD.admins, minting a ghost grant (a token with no approved
--      team row: invisible in the UI, irrevocable by product). So the guard
--      below gains a CONVERGENT-REVOCATION branch: ANY writer may shrink
--      admins by tokens that are already invalid (no approved team row, not
--      the owner's). Removing an invalid token can never mint or keep
--      privilege, so it is safe from any JWT — whenever the revoke fires, it
--      now sticks. When it no-ops instead (the grant not yet visible to its
--      snapshot), the promote's own added-token validation almost always
--      fails loudly — it re-queries team_members on a fresh READ COMMITTED
--      snapshot and sees the kicked member's row gone. Only a true
--      sub-millisecond overlap (the kick commits between the promote's
--      validation query and the promote's commit) can still mint a ghost;
--      that window predates this migration — owner-kick vs owner-promote
--      races it identically — and the backfill below prunes any that ever
--      appear the next time this file's pattern is re-run.
--
-- The 009 "Users can leave projects" policy (user_id = auth.uid()) is a
-- separate permissive DELETE policy and is untouched — self-leave (including
-- a co-lead leaving) still works via the guard's self-removal branch.
--
-- Idempotent + convergent: DROP IF EXISTS covers the 002/20260611 owner-only
-- names and this migration's own name, and CREATE OR REPLACE redefines the
-- guard in place (the trigger keeps pointing at it), so a fresh DB and one
-- that ran an earlier draft converge. Reuses the is_project_admin(uuid)
-- SECURITY DEFINER helper from 20260611000000.
-- ============================================================

-- ── Ownership guard: add the convergent-revocation branch ───────────────
-- Byte-identical to the 20260611000000 version except for the new branch
-- between the self-removal branch and the pin (header, layer 2).
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

  -- Convergent revocation: ANY writer may shrink admins by tokens that are
  -- already invalid — no approved team row backing them, and not the
  -- owner's. Removing an invalid token can never mint or keep privilege, so
  -- it is safe from any JWT. This is what lets team_members_revoke_admin's
  -- UPDATE stick when it fires under a co-lead's JWT: their kick can race an
  -- owner promote of the same member (READ COMMITTED), and pinning the
  -- revoke would mint a ghost grant. The cardinality check also blocks
  -- smuggling duplicate tokens through the set-based "nothing added" test.
  IF NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id
     AND cardinality(COALESCE(NEW.admins, '{}')) < cardinality(COALESCE(OLD.admins, '{}'))
     AND NOT EXISTS (              -- nothing added…
       SELECT 1 FROM (
         SELECT unnest(COALESCE(NEW.admins, '{}')) AS token
         EXCEPT
         SELECT unnest(COALESCE(OLD.admins, '{}'))
       ) AS added
     )
     AND NOT EXISTS (              -- …and every removed token is already invalid
       SELECT 1 FROM (
         SELECT unnest(COALESCE(OLD.admins, '{}')) AS token
         EXCEPT
         SELECT unnest(COALESCE(NEW.admins, '{}'))
       ) AS removed
       WHERE removed.token IS NOT DISTINCT FROM OLD.owner_id::text
          OR EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.project_id = OLD.id
              AND tm.user_id::text = removed.token
              AND tm.status = 'approved'
          )
     )
  THEN
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

-- ── team_members DELETE: owner OR co-lead (regular crew only) ────────────
DROP POLICY IF EXISTS "Project leads can remove team members" ON public.team_members;
DROP POLICY IF EXISTS "Project owners can remove team members" ON public.team_members;
DROP POLICY IF EXISTS "Owners and co-leads can remove team members" ON public.team_members;
CREATE POLICY "Owners and co-leads can remove team members"
  ON public.team_members FOR DELETE
  TO authenticated
  USING (
    -- Owner: removes anyone (unchanged 002/20260611 shape).
    EXISTS (SELECT 1 FROM public.projects
            WHERE id = project_id AND owner_id = auth.uid())
    OR
    -- Co-lead: regular crew only — never the owner, never another co-lead.
    -- admins holds the owner's token too, so the NOT EXISTS excludes both in
    -- one predicate. Product rule + first line of defense; the guard's
    -- convergent-revocation branch covers the racing case (see header).
    (
      public.is_project_admin(project_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = team_members.project_id
          AND (p.owner_id = team_members.user_id
               OR p.admins @> ARRAY[team_members.user_id::text])
      )
    )
  );

-- ── Backfill: prune ghost grants (and dupes), same shape as 20260611 ─────
-- Re-establishes admins := {owner} ∪ approved members at apply time. Any
-- ghost minted by the pre-fix race (or the residual sub-millisecond overlap
-- above) holds invisible, UI-irrevocable edit rights — clear them here.
-- Service context: the guard's NULL-uid branch passes this. projects has no
-- zz_email_notify trigger, so a bulk UPDATE here sends nothing.
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

-- Make PostgREST aware of the policy change immediately.
NOTIFY pgrst, 'reload schema';
