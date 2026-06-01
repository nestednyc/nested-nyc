-- ============================================================
-- Incoming connections: let the TARGET of a connection see it.
--
-- Connections are one-directional (user_id → target_id). The base
-- policy (20260602000001) only lets the owner (user_id) read their own
-- rows, so a target can't tell who connected with them. This adds a
-- second SELECT policy for the target. RLS policies are OR'd, so the
-- owner's read is unchanged. No new PII is exposed — profiles are
-- already readable by any authenticated user; this only reveals the
-- existence of the directed edge.
-- ============================================================

-- target_id lookups need their own index: idx_connections_user and the
-- PRIMARY KEY (user_id, target_id) both lead with user_id.
CREATE INDEX IF NOT EXISTS idx_connections_target ON public.connections(target_id);

DROP POLICY IF EXISTS "View connections to me" ON public.connections;
CREATE POLICY "View connections to me" ON public.connections
  FOR SELECT TO authenticated USING (auth.uid() = target_id);

NOTIFY pgrst, 'reload schema';
