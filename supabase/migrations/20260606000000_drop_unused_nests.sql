-- Remove the abandoned "Nests" feature.
--
-- These two tables are unreachable from the live cork-board app (src/design/).
-- The only code that queried them, src/services/nestService.js, was imported
-- solely by the src/services/index.js barrel, which nothing imports. (org_members
-- was already removed in 20260528000000.)

-- Drop the child table first (FK nest_members.nest_id -> nests). CASCADE also
-- clears each table's indexes, updated_at/member-count triggers, and RLS policies.
DROP TABLE IF EXISTS public.nest_members CASCADE;
DROP TABLE IF EXISTS public.nests CASCADE;

-- The member-count trigger function is now orphaned (only nest_members used it).
-- NOTE: do NOT drop update_updated_at_column -- it is shared by profiles, projects, etc.
DROP FUNCTION IF EXISTS public.update_nest_member_count() CASCADE;
