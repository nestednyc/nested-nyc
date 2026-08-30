-- ============================================================
-- Community board, round 2: orgs post to the board + students
-- follow orgs.
-- ------------------------------------------------------------
-- posts.org_id — a post pinned BY an org. The org owner's uid stays
--   author_id (RLS, delete rights and the per-user rate limit keep
--   working unchanged); org_id says who the post is *from*, and the
--   author_* snapshot columns carry the org's name/logo. Only the
--   owner of a VERIFIED org can post as it (same gate as events).
-- org_follows — directed student → org subscriptions. Drives the
--   "Following" feed filter and the follower count on the org page.
--   Follower counts come from a SECURITY DEFINER function instead of a
--   counter column on organizations, so a follow never UPDATEs
--   organizations (prod runs the notify_organizations webhook on that
--   table — no reason to wake it for every follow).
-- No zz_email_notify on any of this — following/posting emails nobody.
-- ============================================================

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_posts_org ON public.posts (org_id, created_at DESC);

-- Re-state the insert policy with the org gate.
DROP POLICY IF EXISTS "Users create own posts" ON public.posts;
CREATE POLICY "Users create own posts"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      org_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = org_id
          AND o.owner_user_id = auth.uid()
          AND o.verified = TRUE
      )
    )
  );

-- ---------------- org_follows ----------------
CREATE TABLE IF NOT EXISTS public.org_follows (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_org_follows_org ON public.org_follows (org_id);

GRANT SELECT, INSERT, DELETE ON public.org_follows TO authenticated;
ALTER TABLE public.org_follows ENABLE ROW LEVEL SECURITY;

-- Own rows only: "do I follow it" comes from my rows, the total from
-- org_follower_count(), so nobody can scrape who follows what.
CREATE POLICY "Users read own follows"
  ON public.org_follows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users follow verified orgs"
  ON public.org_follows FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = org_id AND o.verified = TRUE)
  );
CREATE POLICY "Users unfollow"
  ON public.org_follows FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Follower total without exposing the followers.
CREATE OR REPLACE FUNCTION public.org_follower_count(p_org UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.org_follows WHERE org_id = p_org;
$$;
REVOKE ALL ON FUNCTION public.org_follower_count(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_follower_count(UUID) TO anon, authenticated;

-- Rate limit follows like the other social writes (mirror rl_connections).
CREATE OR REPLACE FUNCTION public.rl_org_follows()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_uid IS NULL OR NEW.user_id IS DISTINCT FROM v_uid THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.org_follows f
  WHERE f.user_id = v_uid AND f.created_at > now() - interval '1 hour';
  IF v_count >= 60 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS zz_rl_org_follows ON public.org_follows;
CREATE TRIGGER zz_rl_org_follows
  BEFORE INSERT ON public.org_follows
  FOR EACH ROW EXECUTE FUNCTION public.rl_org_follows();

NOTIFY pgrst, 'reload schema';
