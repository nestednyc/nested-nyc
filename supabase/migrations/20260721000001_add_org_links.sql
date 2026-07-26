-- Public links on an org page: JSONB array of {kind, url} rows, same shape
-- as projects.links (20260721000000). The client re-derives label + icon on
-- read (detectProjectLink), so stored kinds are advisory and rows never go
-- stale. Whole-row RLS already covers the column (anon reads verified rows;
-- owner-only UPDATE via owner_user_id; org_lock_verified guards only
-- `verified`) — no policy work.
--
-- The legacy website/instagram TEXT columns are KEPT but no longer written:
-- the deployed frontend still sends them until the links frontend ships.
-- (A drop migration comes later, after that deploy settles.)
--
-- Deploy order: apply BEFORE the frontend that writes `links` ships —
-- orgService.createOrg includes the column on every insert, which PGRST204s
-- against a schema without it. Additive, so the old frontend is unaffected.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb;

-- House rule (CLAUDE.md): no bulk organizations UPDATE with the email webhook
-- live. notify.js only emails on the verified false->true flip, so this
-- backfill cannot email even unguarded — the disable is rule compliance plus
-- not spraying one pg_net POST per row. The trigger is dashboard-created
-- (prod only) under EITHER of its two documented names (CLAUDE.md says
-- zz_email_notify, EMAIL_NOTIFICATIONS.md creates notify_organizations);
-- cover both, no-op locally.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.organizations'::regclass
      AND NOT tgisinternal
      AND tgname IN ('zz_email_notify', 'notify_organizations')
  LOOP
    EXECUTE format('ALTER TABLE public.organizations DISABLE TRIGGER %I', t);
  END LOOP;
END $$;

-- Backfill: fold the legacy pair into links for rows that have either.
-- Idempotent (only rows still at the empty default). website keeps its value
-- https-normalized; instagram is a bare handle -> canonical profile URL (the
-- ltrim '@' defends against pre-strip-era handles saved out-of-band).
UPDATE public.organizations
SET links =
  CASE WHEN btrim(COALESCE(website, '')) <> '' THEN
    jsonb_build_array(jsonb_build_object(
      'kind', 'site',
      'url',  CASE WHEN btrim(website) ~* '^https?://'
                   THEN btrim(website)
                   ELSE 'https://' || btrim(website) END))
  ELSE '[]'::jsonb END
  ||
  CASE WHEN ltrim(btrim(COALESCE(instagram, '')), '@') <> '' THEN
    jsonb_build_array(jsonb_build_object(
      'kind', 'instagram',
      'url',  'https://instagram.com/' || ltrim(btrim(instagram), '@')))
  ELSE '[]'::jsonb END
WHERE links = '[]'::jsonb
  AND (btrim(COALESCE(website, '')) <> ''
       OR ltrim(btrim(COALESCE(instagram, '')), '@') <> '');

DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT tgname FROM pg_trigger
    WHERE tgrelid = 'public.organizations'::regclass
      AND NOT tgisinternal
      AND tgname IN ('zz_email_notify', 'notify_organizations')
  LOOP
    EXECUTE format('ALTER TABLE public.organizations ENABLE TRIGGER %I', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
