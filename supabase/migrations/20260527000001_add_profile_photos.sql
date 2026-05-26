-- Add a multi-photo gallery to profiles (up to 3 photos).
--
-- Design contract:
--   * `photos` is the canonical source of truth.
--   * `avatar` is kept as a derived alias of `photos[1]` (Postgres arrays are
--     1-indexed) via a BEFORE trigger. Every existing consumer that reads
--     `.avatar` (EventDetailScreen, OrgDashboardScreen, ProjectDetailScreen,
--     WebLayout header, projectData author_image, etc.) keeps working without
--     code changes.
--   * After this migration, application code should write `photos` only; the
--     trigger handles avatar. Direct avatar writes are still possible but
--     will be overwritten the next time photos changes.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}'::text[];

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_photos_max_3;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_photos_max_3
  CHECK (array_length(photos, 1) IS NULL OR array_length(photos, 1) <= 3);

-- Backfill: copy existing avatar into photos[1] for rows that have an avatar
-- but no photos yet. Re-runnable.
UPDATE public.profiles
SET photos = ARRAY[avatar]
WHERE avatar IS NOT NULL
  AND avatar <> ''
  AND (photos IS NULL OR array_length(photos, 1) IS NULL);

-- Trigger function: keep avatar in sync with photos[1].
-- Runs BEFORE INSERT/UPDATE so the new value is written, not a follow-up update.
CREATE OR REPLACE FUNCTION public.sync_avatar_from_photos()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.photos IS NOT NULL AND array_length(NEW.photos, 1) >= 1 THEN
    NEW.avatar = NEW.photos[1];
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_sync_avatar ON public.profiles;

CREATE TRIGGER profiles_sync_avatar
  BEFORE INSERT OR UPDATE OF photos ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_avatar_from_photos();

-- Re-create public_profiles view to expose `photos` to anon viewers.
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT
  id,
  first_name,
  last_name,
  username,
  avatar,
  photos,
  university
FROM public.profiles
WHERE onboarding_completed = TRUE;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
