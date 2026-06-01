-- ============================================================
-- Cork-board project fields
-- Align `projects` with exactly what the new cork-board UI persists.
-- The flyer (create.jsx / projectForm.jsx / detail.jsx) carries richer
-- state than the original schema. UI is the source of truth here.
-- Existing rows are backfilled to the new category vocabulary before the
-- CHECK is re-added (below); the roles retype discards any prior roles data.
-- ============================================================

-- 1) Category vocabulary → the UI's category ids.
--    Old: ('startup','class-project','side-project','research')
--    New: ('startup','class','hack','side','research')  (adds 'hack')
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_category_check;
-- Backfill legacy ids so existing rows satisfy the new CHECK.
UPDATE public.projects SET category = 'class' WHERE category = 'class-project';
UPDATE public.projects SET category = 'side'  WHERE category = 'side-project';
ALTER TABLE public.projects
  ADD CONSTRAINT projects_category_check
  CHECK (category IN ('startup', 'class', 'hack', 'side', 'research'));

-- 2) Flyer fields the UI collects on create/edit (none existed before).
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS stage    TEXT,            -- idea | mvp | recruiting | active-sprint
  ADD COLUMN IF NOT EXISTS timeline TEXT,            -- free text ("Spring 2026, ongoing…")
  ADD COLUMN IF NOT EXISTS place    TEXT,            -- "Based at" location
  ADD COLUMN IF NOT EXISTS pin_type TEXT DEFAULT 'tape',   -- tape | pin
  ADD COLUMN IF NOT EXISTS rot      TEXT,            -- CSS rotation, e.g. "-2.34deg"
  ADD COLUMN IF NOT EXISTS status   TEXT DEFAULT 'idea',   -- live owner-updatable pulse
  ADD COLUMN IF NOT EXISTS alert    TEXT DEFAULT '',       -- "latest update" note (<=140)
  ADD COLUMN IF NOT EXISTS tags     TEXT[] DEFAULT '{}',   -- interest tags
  ADD COLUMN IF NOT EXISTS admins   TEXT[] DEFAULT '{}';   -- owner + promoted co-admins (tokens)

-- 3) Roles become structured open-role slots: [{title, note, open}].
--    The original `roles TEXT[]` can't hold the per-role open/filled flag.
ALTER TABLE public.projects DROP COLUMN IF EXISTS roles;
ALTER TABLE public.projects ADD COLUMN roles JSONB DEFAULT '[]'::jsonb;

-- 4) Integrity checks matching the UI enums (CHECK passes on NULL).
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('idea','in-progress','looking','need-help','mvp','live','paused','completed'));

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_stage_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_stage_check
  CHECK (stage IS NULL OR stage IN ('idea','mvp','recruiting','active-sprint'));

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_pin_type_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_pin_type_check
  CHECK (pin_type IS NULL OR pin_type IN ('tape','pin'));
