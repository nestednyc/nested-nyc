-- ============================================================
-- Community board: post kinds.
-- ------------------------------------------------------------
-- posts.kind says WHY a note is on the board so the feed scans:
--   update — a plain note / work-in-progress (default)
--   win    — a milestone ("closed our first 100 users")
--   ask    — "looking for": a role, a collaborator, a hand
-- The board renders a colored kicker per kind; ask-posts get an
-- "I'm interested" CTA that opens the join-request flow when a
-- project is tagged. Events are NOT a post kind — orgs' events are
-- merged into the board at read time from the events table.
-- ============================================================
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'update';
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_kind_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_kind_check CHECK (kind IN ('update', 'win', 'ask'));
-- The rail's "Looking for help" reads the newest asks.
CREATE INDEX IF NOT EXISTS idx_posts_ask ON public.posts (created_at DESC) WHERE kind = 'ask';

NOTIFY pgrst, 'reload schema';
