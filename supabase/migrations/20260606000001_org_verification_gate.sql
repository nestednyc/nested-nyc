-- H1 + L1 + H4 — organization verification gate.
--
-- Product model: orgs self-sign-up but land UNVERIFIED + INACTIVE — invisible,
-- and unable to post events, to everyone but their owner — until an admin sets
-- verified = true. Orgs can NEVER self-verify. account_type is also pinned so a
-- user can't self-escalate after signup (L1).
--
-- "Admin" = any context with no end-user JWT (service role / SQL / dashboard),
-- where auth.uid() is null. To verify an org, run as service role / dashboard:
--   update public.organizations set verified = true where slug = '<slug>';
--
-- account_type is still set at signup by handle_new_user (an INSERT, unaffected
-- by these BEFORE UPDATE triggers). Idempotent (DROP IF EXISTS / CREATE OR REPLACE).

-- 1. H4 — lock organizations.verified. A logged-in user's UPDATE can never change
--    it; an admin (auth.uid() IS NULL) can.
CREATE OR REPLACE FUNCTION public.org_lock_verified()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.verified IS DISTINCT FROM OLD.verified THEN
    NEW.verified := OLD.verified;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS org_lock_verified ON public.organizations;
CREATE TRIGGER org_lock_verified BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.org_lock_verified();

-- 2. L1 — pin profiles.account_type. A user can't change their own type after
--    signup. Leaves onboarding_completed (and the rest of the row) writable.
CREATE OR REPLACE FUNCTION public.profile_lock_account_type()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.account_type IS DISTINCT FROM OLD.account_type THEN
    NEW.account_type := OLD.account_type;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS profile_lock_account_type ON public.profiles;
CREATE TRIGGER profile_lock_account_type BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profile_lock_account_type();

-- 3. Hide unverified orgs from everyone but their owner.
DROP POLICY IF EXISTS "Organizations viewable by anyone" ON public.organizations;
DROP POLICY IF EXISTS "Verified orgs viewable; owner sees own" ON public.organizations;
CREATE POLICY "Verified orgs viewable; owner sees own"
  ON public.organizations FOR SELECT TO anon, authenticated
  USING (verified = true OR owner_user_id = auth.uid());

-- 4. Hide unverified orgs' events (owner still sees own; legacy null-org events
--    remain visible).
DROP POLICY IF EXISTS "Events viewable by anyone" ON public.events;
DROP POLICY IF EXISTS "Events viewable when org verified or owned" ON public.events;
CREATE POLICY "Events viewable when org verified or owned"
  ON public.events FOR SELECT TO anon, authenticated
  USING (
    organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = events.organization_id
        AND (o.verified = true OR o.owner_user_id = auth.uid())
    )
  );

-- 5. Block event creation until the org is verified ("not active until approved").
DROP POLICY IF EXISTS "Org owner can create events" ON public.events;
DROP POLICY IF EXISTS "Verified org owner can create events" ON public.events;
CREATE POLICY "Verified org owner can create events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND organizer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organizations o
      WHERE o.id = organization_id AND o.owner_user_id = auth.uid() AND o.verified = true
    )
  );

NOTIFY pgrst, 'reload schema';
