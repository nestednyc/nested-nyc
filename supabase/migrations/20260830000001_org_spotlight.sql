-- ============================================================
-- Club spotlight: one hand-picked org pinned to the top of the
-- community board while organizations.spotlight_until > now().
-- ------------------------------------------------------------
-- Curated, never self-set: the column is pinned by the same lock as
-- `verified` — a logged-in UPDATE can't change it; only an admin
-- context (auth.uid() IS NULL: SQL editor / Management API / service
-- role) can. To spotlight a club for a week:
--   update public.organizations
--      set spotlight_until = now() + interval '7 days'
--    where slug = '<slug>';
-- (That UPDATE pings the organizations notify webhook; harmless for a
-- single row — planOrgVerified only emails on a verified false→true
-- flip — but never bulk-set it.)
-- ============================================================
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS spotlight_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_organizations_spotlight
  ON public.organizations (spotlight_until)
  WHERE spotlight_until IS NOT NULL;

-- Extend the H4 lock (20260606000001) to the new column. Same trigger
-- (org_lock_verified, BEFORE UPDATE) — only the function body changes.
CREATE OR REPLACE FUNCTION public.org_lock_verified()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NEW.verified IS DISTINCT FROM OLD.verified THEN
    NEW.verified := OLD.verified;
  END IF;
  IF auth.uid() IS NOT NULL AND NEW.spotlight_until IS DISTINCT FROM OLD.spotlight_until THEN
    NEW.spotlight_until := OLD.spotlight_until;
  END IF;
  RETURN NEW;
END $$;

NOTIFY pgrst, 'reload schema';
