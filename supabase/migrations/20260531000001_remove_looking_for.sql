-- Drops looking_for. The cork-board UX removed the prose "looking for"
-- callout entirely and the column is no longer surfaced anywhere.
-- public_profiles view does NOT expose this column (confirmed in
-- 20260526000002_public_browse.sql) so no view rebuild is required.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS looking_for;
