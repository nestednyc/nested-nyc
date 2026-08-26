-- Relaunch category vocabulary → startup / brand / film / music / personal / research.
-- The school-flavored ids (class, hack, side) fold into 'personal'; the client
-- mirrors this remap in normalizeCat (src/design/data.js) so un-migrated rows
-- and stale clients agree. `projects` has no zz_email_notify trigger, so the
-- backfill UPDATE emails nobody.

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_category_check;

-- Freeze updated_at across the backfill: this is a vocabulary remap, not an
-- edit — projects_updated_at would overwrite real last-edit dates and churn
-- the sitemap's <lastmod>.
ALTER TABLE public.projects DISABLE TRIGGER projects_updated_at;

-- Fold EVERY out-of-vocabulary value — not just the known trio — into
-- 'personal', so a drifted row (out-of-band writes while constraints were
-- down, 001-era 'class-project'/'side-project', …) can't abort the
-- ADD CONSTRAINT below.
UPDATE public.projects
   SET category = 'personal'
 WHERE category IS NOT NULL
   AND category NOT IN ('startup', 'brand', 'film', 'music', 'personal', 'research');

ALTER TABLE public.projects ENABLE TRIGGER projects_updated_at;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_category_check
  CHECK (category IN ('startup', 'brand', 'film', 'music', 'personal', 'research'));
