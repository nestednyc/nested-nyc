-- Collapse the org_members junction into a direct owner column.
-- The original orgs feature modeled "many human admins behind one org brand,"
-- but the product is "one signup IS the org" — org name doubles as display
-- name, org logo doubles as pfp. The junction, both helpers, and the entire
-- Team UI were misleading dead weight.
--
-- This migration is destructive on the org_members side (table dropped, no
-- backfill). It's safe because:
--   * org_members was introduced on this branch (commit 84be2b0) — never
--     deployed to prod.
--   * The lone local test org is disposable; the user will recreate.

-- ============================================
-- 1. ADD OWNER COLUMN
-- ============================================
ALTER TABLE public.organizations
  ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_organizations_owner ON public.organizations(owner_user_id);

-- ============================================
-- 2. DROP POLICIES THAT REFERENCE THE HELPERS
-- These must come down before the helpers, or the DROP FUNCTION fails.
-- ============================================
DROP POLICY IF EXISTS "Members can update their org"            ON public.organizations;
DROP POLICY IF EXISTS "Owners can delete their org"             ON public.organizations;
DROP POLICY IF EXISTS "Org members can create events"           ON public.events;
DROP POLICY IF EXISTS "Org members can update events"           ON public.events;
DROP POLICY IF EXISTS "Org members can delete events"           ON public.events;
DROP POLICY IF EXISTS "Self unregister or org member remove"    ON public.event_registrations;

-- ============================================
-- 3. DROP THE JUNCTION TABLE THEN THE HELPERS
-- Order matters: DROP TABLE first so the policies attached to org_members
-- (which also reference the helpers) go away. Only then can we drop the
-- helper functions cleanly.
-- ============================================
DROP TABLE IF EXISTS public.org_members CASCADE;
DROP FUNCTION IF EXISTS public.is_org_member(UUID);
DROP FUNCTION IF EXISTS public.is_org_owner(UUID);

-- ============================================
-- 4. RECREATE POLICIES AGAINST owner_user_id
-- ============================================

-- organizations: only the owner can update / delete their own org.
CREATE POLICY "Owners can update their org"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owners can delete their org"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (owner_user_id = auth.uid());

-- events: only the org owner can post / mutate / remove events on its behalf.
-- The organizer_id = auth.uid() check on INSERT keeps the audit column honest.
CREATE POLICY "Org owner can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND organizer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_id AND owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Org owner can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_id AND owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_id AND owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Org owner can delete events"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = organization_id AND owner_user_id = auth.uid()
    )
  );

-- event_registrations: a user can drop their own RSVP, OR the org owner can
-- remove anyone from an event their org is hosting.
CREATE POLICY "Self unregister or org owner remove"
  ON public.event_registrations FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.organizations o ON o.id = e.organization_id
      WHERE e.id = event_id AND o.owner_user_id = auth.uid()
    )
  );

-- Make PostgREST pick up the dropped table, dropped functions, and new column.
NOTIFY pgrst, 'reload schema';
