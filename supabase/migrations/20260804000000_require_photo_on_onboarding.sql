-- Required profile photo — DB backstop to the wizard's mandatory snap step.
-- New signups can no longer complete onboarding faceless: the client's core
-- save now writes onboarding_completed:false and only finishEnrichment (photo
-- aboard) flips it true, and this trigger makes the DB the authority if that
-- flow is bypassed (RLS lets a user UPDATE their own profiles row straight
-- through the REST API).
--
-- Scope — new signups only, by construction:
--   * Fires solely on the false→true onboarding_completed transition, so every
--     already-onboarded row (all pre-feature students) is grandfathered — no
--     transition left to make, no backfill, and later edits (including photo
--     removal) stay unaffected.
--   * org_admin rows are exempt: orgs have no photo gallery, and
--     profile_block_org_student_writes already polices the flag there.
--   * Admin contexts (service role / SQL editor / dashboard: auth.uid() IS
--     NULL) stay fully writable — the e2e seed scripts and manual fixes keep
--     working (precedent: 20260719000000_profiles_org_guard.sql).
--
-- UPDATE-only: profiles rows are created by handle_new_user with
-- (id, account_type) alone — onboarding_completed defaults false — and the
-- client upsert always resolves to ON CONFLICT DO UPDATE because that row
-- already exists. The message is end-user-facing: PostgREST forwards it, and
-- the wizard's error line prints it verbatim. ERRCODE PT422 maps to HTTP 422
-- (precedent: 20260622000000_dm_rpcs.sql). Idempotent.

CREATE OR REPLACE FUNCTION public.profile_require_photo_to_complete()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.account_type IS DISTINCT FROM 'org_admin'
     AND NEW.onboarding_completed IS TRUE
     AND OLD.onboarding_completed IS DISTINCT FROM TRUE
     AND (NEW.photos IS NULL OR array_length(NEW.photos, 1) IS NULL) THEN
    RAISE EXCEPTION 'A profile photo is required to finish onboarding.'
      USING ERRCODE = 'PT422';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profile_require_photo_to_complete ON public.profiles;
CREATE TRIGGER profile_require_photo_to_complete BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profile_require_photo_to_complete();
