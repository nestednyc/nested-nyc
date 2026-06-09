-- Per-project view tracking: append-only project_views log + trigger-maintained
-- projects.view_count, surfaced as a retro hit counter on the flyer.
-- Writes ONLY via the SECURITY DEFINER RPC below — the table has no INSERT policy.
-- Rules (server-enforced): owner never counts; signed-in once/project/UTC-day;
-- anon per call (client dedupes per browser session).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- BIGINT identity, not uuid like entity tables: append-only log, never
-- referenced or addressed by id — narrow insert-ordered key is the better fit.
-- viewer_id FK mirrors saved_projects (profiles(id), CASCADE): deleted accounts
-- take their log rows; view_count intentionally keeps those views (no decrement).
CREATE TABLE IF NOT EXISTS public.project_views (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  viewer_id   UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL = anon
  viewed_on   DATE NOT NULL DEFAULT CURRENT_DATE,  -- UTC day, for per-day dedupe
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.project_views IS
  'Append-only project view log. Writes only via record_project_view(); projects.view_count is the trigger-maintained total.';

-- Signed-in dedupe: one row per (project, viewer, day); anon rows stay out.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_project_views_viewer_day
  ON public.project_views (project_id, viewer_id, viewed_on)
  WHERE viewer_id IS NOT NULL;

-- Future "views this week" reads.
CREATE INDEX IF NOT EXISTS idx_project_views_project_time
  ON public.project_views (project_id, viewed_at DESC);

ALTER TABLE public.project_views ENABLE ROW LEVEL SECURITY;

-- Owners may read their own projects' logs (future owner analytics).
-- No INSERT/UPDATE/DELETE policies on purpose.
CREATE POLICY "Owners read own project views"
  ON public.project_views FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects pr
    WHERE pr.id = project_views.project_id AND pr.owner_id = auth.uid()
  ));

-- Count trigger — mirrors the hardened update_event_attendee_count convention
-- (20260606000003): SECURITY DEFINER + pinned search_path.
-- INSERT-only: nothing deletes individual log rows via the API; project delete
-- cascades the log but removes the project row itself, and account deletion
-- must not shrink historical totals — so no decrement branch.
CREATE OR REPLACE FUNCTION public.update_project_view_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.projects SET view_count = view_count + 1 WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_project_view_insert ON public.project_views;
CREATE TRIGGER on_project_view_insert
  AFTER INSERT ON public.project_views
  FOR EACH ROW EXECUTE FUNCTION public.update_project_view_count();

-- Single write path. Returns the post-op total; NULL for missing/unpublished
-- (indistinguishable to non-owners — no existence leak). The owner gets the
-- current count back, unrecorded.
CREATE OR REPLACE FUNCTION public.record_project_view(p_project_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner     UUID;
  v_published BOOLEAN;
  v_count     INTEGER;
  v_uid       UUID := auth.uid();
BEGIN
  SELECT owner_id, publish_to_discover, view_count
    INTO v_owner, v_published, v_count
    FROM public.projects WHERE id = p_project_id;

  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_uid IS NOT NULL AND v_uid = v_owner THEN RETURN v_count; END IF;  -- owner: report, never record
  IF v_published IS DISTINCT FROM TRUE THEN RETURN NULL; END IF;

  IF v_uid IS NOT NULL THEN
    -- Race-safe once/day: concurrent calls → exactly one insert → trigger fires once.
    INSERT INTO public.project_views (project_id, viewer_id)
    VALUES (p_project_id, v_uid)
    ON CONFLICT (project_id, viewer_id, viewed_on) WHERE viewer_id IS NOT NULL
    DO NOTHING;
  ELSE
    INSERT INTO public.project_views (project_id) VALUES (p_project_id);
  END IF;

  SELECT view_count INTO v_count FROM public.projects WHERE id = p_project_id;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.record_project_view(UUID) IS
  'Record a project detail view. Owner: never recorded (returns count). Authed: once/UTC-day. Anon: per call. NULL for missing/unpublished projects.';

-- Postgres default-grants EXECUTE to PUBLIC on new functions — revoke, then
-- grant exactly the roles that may call it.
REVOKE ALL ON FUNCTION public.record_project_view(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_project_view(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.record_project_view(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
