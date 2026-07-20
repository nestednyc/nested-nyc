-- Org-account guard — DB backstop to the client's blockOrgAccount (student
-- signup wizard). Student onboarding must never write student fields onto an
-- org_admin profiles row; the client now fails closed before upserting, and
-- this trigger makes the DB the authority if that guard ever regresses or is
-- bypassed (RLS lets a user UPDATE their own profiles row straight through
-- the REST API).
--
-- NO legitimate end-user flow writes profiles rows for org accounts (org
-- screens touch only organizations; the student editor is unreachable for an
-- org session), so an end-user write of student-onboarding fields on an
-- org_admin row is always the wizard bug — RAISE loudly ('PT403' maps to
-- HTTP 403 via PostgREST; precedent: 20260622000000_dm_rpcs.sql) rather than
-- silently revert (contrast profile_lock_account_type). Admin contexts
-- (service role / SQL editor / dashboard: auth.uid() IS NULL) stay fully
-- writable — e.g. api/unsubscribe's email_opt_out flip and manual fixes.
--
-- Prospective-only by design: prod audited 2026-07-19 — the sole org_admin
-- profiles row carries NO ghost-student fields (onboarding_completed/username/
-- university/major all clean), so there is nothing to backfill.
--
-- UPDATE-only: profiles rows are created by handle_new_user with
-- (id, account_type) alone, and the client upsert always resolves to
-- ON CONFLICT DO UPDATE because that row already exists. Tests
-- OLD.account_type so it is independent of same-event trigger order vs
-- profile_lock_account_type. Row-value IS DISTINCT FROM compares mean a
-- no-op assignment can never fire it. Idempotent.

CREATE OR REPLACE FUNCTION public.profile_block_org_student_writes()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND OLD.account_type = 'org_admin'
     AND (
          (NEW.onboarding_completed IS TRUE AND OLD.onboarding_completed IS DISTINCT FROM TRUE)
       OR NEW.username   IS DISTINCT FROM OLD.username
       OR NEW.university IS DISTINCT FROM OLD.university
       OR NEW.major      IS DISTINCT FROM OLD.major
     ) THEN
    RAISE EXCEPTION 'org_account' USING ERRCODE = 'PT403';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profile_block_org_student_writes ON public.profiles;
CREATE TRIGGER profile_block_org_student_writes BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profile_block_org_student_writes();
