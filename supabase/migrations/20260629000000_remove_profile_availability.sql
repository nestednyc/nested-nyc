-- ============================================================
-- Remove profiles.availability ("10 hrs / week" self-description).
-- The field was dropped from the profile UI in the same change; this
-- drops it at rest. The sibling `building` ("what you're working on")
-- stays — only availability is removed.
--
-- ORDER MATTERS: the student_cards view (20260607000000) lists
-- `availability` in its SELECT, so the column can't be dropped while the
-- view still references it. Recreate the view WITHOUT the column first.
-- CREATE OR REPLACE VIEW can't remove a column, so this DROPs + CREATEs;
-- DROP discards the grant, so the GRANT is re-applied.
--
-- DEPLOY ORDER: ship the frontend that no longer sends `availability` in
-- the profile upsert BEFORE applying this — otherwise an in-flight old
-- client's upsert errors on the now-missing column. All reads use
-- select('*') and are unaffected either way.
-- ============================================================

DROP VIEW IF EXISTS public.student_cards;

-- Column-scoped directory view. A default (non-security_invoker) view runs
-- with the definer's rights and bypasses base-table RLS, so the directory
-- still lists everyone — only the column set is narrowed. Identical to
-- 20260607000000 minus `availability`.
CREATE VIEW public.student_cards AS
SELECT
  id, first_name, last_name, username, avatar, photos,
  university, major, year, bio, fields, skills, tech_stack,
  building, links, account_type, created_at
FROM public.profiles
WHERE onboarding_completed = TRUE;

GRANT SELECT ON public.student_cards TO authenticated;

-- Drop the column itself (irreversible; stored values are discarded).
ALTER TABLE public.profiles DROP COLUMN IF EXISTS availability;

NOTIFY pgrst, 'reload schema';
