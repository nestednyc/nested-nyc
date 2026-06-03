-- Enable Supabase Realtime for team_members so join-request approvals push to
-- the requester live: when an owner flips a row pending -> approved, the
-- requester's board moves that project from "Requests" into "My projects"
-- without a manual reload. Additive + reversible — the existing pull-based
-- hydration still works if realtime is unavailable.

-- Publish the table on the realtime publication (idempotent: skip if already a
-- member, so re-running this migration never errors).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'team_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.team_members;
  END IF;
END $$;

-- FULL replica identity so UPDATE/DELETE events carry the whole old row. The
-- requester channel filters on user_id, and DELETE only exposes that column for
-- the filter (and for detecting a withdrawn request) when replica identity is
-- FULL — the default (primary key only) would drop those events.
ALTER TABLE public.team_members REPLICA IDENTITY FULL;
