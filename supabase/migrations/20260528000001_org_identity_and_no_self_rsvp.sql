-- Two independent fixes in one migration:
--   (a) Make org-admin accounts show up correctly in public_profiles. Until
--       now they were filtered out (onboarding_completed = false) and their
--       profile row was empty, so they rendered as "?"/"Member"/"Unnamed
--       User" everywhere. The view now LEFT JOINs organizations on
--       owner_user_id and COALESCEs name/avatar/slug — the org's data IS
--       the org admin's display profile.
--   (b) Block self-RSVP. An org account hosting an event must not be able
--       to register itself as an attendee on that event.

-- ============================================
-- (a) public_profiles surfaces org identity
-- DROP + CREATE rather than CREATE OR REPLACE — Postgres refuses to
-- change a view's column types or expressions in-place (SQLSTATE 42P16
-- "cannot drop columns from view"), even when the column names + final
-- types match. A clean recreate sidesteps that.
-- ============================================
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT
  p.id,
  COALESCE(o.name, p.first_name)                            AS first_name,
  CASE WHEN o.id IS NOT NULL THEN NULL ELSE p.last_name END AS last_name,
  COALESCE(o.slug, p.username)                              AS username,
  COALESCE(o.logo, p.avatar)                                AS avatar,
  CASE WHEN o.id IS NOT NULL THEN NULL ELSE p.university END AS university
FROM public.profiles p
LEFT JOIN public.organizations o ON o.owner_user_id = p.id
WHERE p.onboarding_completed = TRUE OR o.id IS NOT NULL;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ============================================
-- (b) event_registrations INSERT — no self-host RSVP
-- ============================================
DROP POLICY IF EXISTS "Users can register for events" ON public.event_registrations;

CREATE POLICY "Register for events (not your own host org)"
  ON public.event_registrations FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.events e
      JOIN public.organizations o ON o.id = e.organization_id
      WHERE e.id = event_id AND o.owner_user_id = auth.uid()
    )
  );

-- The DELETE policy already correctly allows self-unregister OR the
-- host org's owner to remove an attendee (set up in the previous
-- collapse-org-admins migration). No DELETE change needed here.

NOTIFY pgrst, 'reload schema';
