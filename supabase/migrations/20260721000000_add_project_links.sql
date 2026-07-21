-- Public "find it online" links on a project flyer: JSONB array of
-- {kind, url} rows. `kind` is detectProjectLink's platform slug
-- (src/design/data.js); the client re-derives label + icon on read, so
-- rows never go stale when the brand table evolves. Whole-row RLS
-- already covers this column (anon reads published rows; owner/co-lead
-- UPDATE) — no policy changes needed.
--
-- Deploy order: apply this BEFORE the frontend that writes `links`
-- ships — toDbProject includes the column on every create/update, which
-- PGRST204s against a schema without it. (Additive, so the old frontend
-- is unaffected once applied.)
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb;
