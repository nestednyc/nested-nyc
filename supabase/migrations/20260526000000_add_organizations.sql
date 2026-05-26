-- Organizations as first-class entities. Universities and student orgs sign up,
-- get a public profile at /orgs/:slug, and post events under the org's brand.
-- One or more human admins per org via the org_members junction.

-- ============================================
-- ORGANIZATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  type            TEXT NOT NULL CHECK (type IN ('university', 'club', 'other')),
  university_id   UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  logo            TEXT,
  banner          TEXT,
  bio             TEXT,
  website         TEXT,
  instagram       TEXT,
  location        TEXT,
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])$'),
  CONSTRAINT organizations_university_self CHECK (type <> 'university' OR university_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_organizations_type ON public.organizations(type);
CREATE INDEX IF NOT EXISTS idx_organizations_university ON public.organizations(university_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

DROP TRIGGER IF EXISTS organizations_updated_at ON public.organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ORG MEMBERS (junction: humans who can act on behalf of an org)
-- Uses `user_id` for consistency with other junctions (team_members,
-- nest_members, event_registrations, saved_projects).
-- ============================================
CREATE TABLE IF NOT EXISTS public.org_members (
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.org_members(user_id);

-- ============================================
-- PROFILES: account_type discriminator (routes onboarding/UI only)
-- Real event-posting permission lives in org_members, not here.
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'student'
    CHECK (account_type IN ('student', 'org_admin'));

-- Update the auto-create-profile trigger to honor account_type passed in signup metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, account_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'account_type', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- EVENTS: link to the org they belong to
-- ============================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_events_organization ON public.events(organization_id);

-- ============================================
-- HELPERS for RLS (avoid recursive policy evaluation)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_org_member(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = target_org AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner(target_org UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = target_org AND user_id = auth.uid() AND role = 'owner'
  );
$$;

-- ============================================
-- RLS: ORGANIZATIONS
-- ============================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizations viewable by authenticated"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Members can update their org"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.is_org_member(id))
  WITH CHECK (public.is_org_member(id));

CREATE POLICY "Owners can delete their org"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (public.is_org_owner(id));

-- ============================================
-- RLS: ORG MEMBERS
-- ============================================
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members viewable by authenticated"
  ON public.org_members FOR SELECT
  TO authenticated
  USING (true);

-- Self-bootstrap (first member during org creation) OR owner adding admins
CREATE POLICY "Owners add members or self-bootstrap"
  ON public.org_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_org_owner(org_id));

CREATE POLICY "Owners update member roles"
  ON public.org_members FOR UPDATE
  TO authenticated
  USING (public.is_org_owner(org_id))
  WITH CHECK (public.is_org_owner(org_id));

CREATE POLICY "Self-leave or owner removes"
  ON public.org_members FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR public.is_org_owner(org_id));

-- ============================================
-- EVENTS: replace organizer-based RLS with org-based RLS
-- ============================================
DROP POLICY IF EXISTS "Users can create events" ON public.events;
DROP POLICY IF EXISTS "Organizers can update events" ON public.events;
DROP POLICY IF EXISTS "Organizers can delete events" ON public.events;

CREATE POLICY "Org members can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND organizer_id = auth.uid()
    AND public.is_org_member(organization_id)
  );

CREATE POLICY "Org members can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id))
  WITH CHECK (organization_id IS NOT NULL AND public.is_org_member(organization_id));

CREATE POLICY "Org members can delete events"
  ON public.events FOR DELETE
  TO authenticated
  USING (organization_id IS NOT NULL AND public.is_org_member(organization_id));

-- Event registration removals: allow any org member, not just the original organizer
DROP POLICY IF EXISTS "Users can unregister or organizers remove" ON public.event_registrations;

CREATE POLICY "Self unregister or org member remove"
  ON public.event_registrations FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_id
        AND e.organization_id IS NOT NULL
        AND public.is_org_member(e.organization_id)
    )
  );

-- Make PostgREST aware of the new tables/columns/FKs immediately.
NOTIFY pgrst, 'reload schema';
