-- ============================================================
-- Flyer head-color personalization + persisted connections
-- ============================================================

-- 1) Per-project flyer head color. Free hex; NULL = fall back to category color.
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS flyer_color TEXT;

-- 2) Connections: a one-directional "you connected to them" edge between students.
CREATE TABLE IF NOT EXISTS public.connections (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, target_id),
  CHECK (user_id <> target_id)
);
CREATE INDEX IF NOT EXISTS idx_connections_user ON public.connections(user_id);

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- You can only see / make / remove your OWN connections.
CREATE POLICY "View own connections" ON public.connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Add own connections" ON public.connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Remove own connections" ON public.connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
