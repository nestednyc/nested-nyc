-- Required username — DB backstop to the wizard's core-recovery fix.
-- A student could previously finish onboarding with NULL username (and
-- university/major): when the core signup save never landed — the email was
-- confirmed on a different device/tab, so the original tab's in-memory wizard
-- state was lost — both resume paths went straight to enrichment, which never
-- re-asks those fields, and finishEnrichment flipped onboarding_completed
-- true on the bare handle_new_user row. Fallout: /u/student link collisions
-- (the adapter's handle fallback) and a phantom NYU badge (uni fallback).
-- The client now re-walks the core steps (enterCoreRecovery, onboarding.jsx);
-- this trigger makes the DB the authority if that flow is bypassed (RLS lets
-- a user UPDATE their own profiles row straight through the REST API).
--
-- Scope — same construction as 20260804000000_require_photo_on_onboarding:
--   * Fires solely on the false→true onboarding_completed transition, so
--     every already-onboarded row is grandfathered (including the two
--     backfilled victims of the original bug) and later edits stay
--     unaffected.
--   * org_admin rows are exempt: orgs have no student identity fields, and
--     profile_block_org_student_writes already polices the flag there.
--   * Admin contexts (service role / SQL editor / dashboard: auth.uid() IS
--     NULL) stay fully writable — seed scripts and manual fixes keep working.
--
-- UPDATE-only for the same reason as the photo trigger: the row always
-- pre-exists via handle_new_user, so the client upsert resolves to ON
-- CONFLICT DO UPDATE. Message is end-user-facing (PostgREST forwards it and
-- the wizard's error line prints it verbatim); ERRCODE PT422 maps to HTTP
-- 422. Idempotent.

CREATE OR REPLACE FUNCTION public.profile_require_username_to_complete()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.account_type IS DISTINCT FROM 'org_admin'
     AND NEW.onboarding_completed IS TRUE
     AND OLD.onboarding_completed IS DISTINCT FROM TRUE
     AND (NEW.username IS NULL OR btrim(NEW.username) = '') THEN
    RAISE EXCEPTION 'A username is required to finish onboarding.'
      USING ERRCODE = 'PT422';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profile_require_username_to_complete ON public.profiles;
CREATE TRIGGER profile_require_username_to_complete BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profile_require_username_to_complete();
