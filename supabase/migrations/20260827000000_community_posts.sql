-- ============================================================
-- Community board: student posts (text + images), optionally tagged
-- with one of the author's projects. Likes, comments, saves.
-- ------------------------------------------------------------
-- posts.university snapshots the author's campus at post time (the
-- "My school" feed filter — cheap, no join, and the filter shouldn't
-- rewrite history if someone's profile school ever changes).
-- images is a JSONB array of public post-images URLs, max 4.
-- like_count / comment_count are trigger-maintained (same pattern as
-- the event attendee counter) so the feed never aggregates.
-- No zz_email_notify webhook on any of these tables — posting emails nobody.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Author identity snapshots (the projects.author_name / team_members.name
  -- pattern): profile reads are relationship-scoped by RLS, so the feed can't
  -- join profiles for strangers — it renders these instead.
  author_name   TEXT NOT NULL DEFAULT '',
  author_handle TEXT NOT NULL DEFAULT '',
  author_avatar TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  project_id    UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  images        JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_array_length(images) <= 4),
  university    TEXT,
  like_count    INT NOT NULL DEFAULT 0,
  comment_count INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- a post is never fully empty: words or pictures
  CHECK (char_length(btrim(body)) > 0 OR jsonb_array_length(images) > 0)
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts (author_id);
CREATE INDEX IF NOT EXISTS idx_posts_university ON public.posts (university);

CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes (user_id);

CREATE TABLE IF NOT EXISTS public.post_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_name   TEXT NOT NULL DEFAULT '',
  author_handle TEXT NOT NULL DEFAULT '',
  author_avatar TEXT NOT NULL DEFAULT '',
  body          TEXT NOT NULL CHECK (char_length(btrim(body)) > 0 AND char_length(body) <= 1000),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS public.post_saves (
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

-- ---------------- trigger-maintained counters ----------------
CREATE OR REPLACE FUNCTION public.posts_like_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS posts_like_counter ON public.post_likes;
CREATE TRIGGER posts_like_counter
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.posts_like_counter();

CREATE OR REPLACE FUNCTION public.posts_comment_counter()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS posts_comment_counter ON public.post_comments;
CREATE TRIGGER posts_comment_counter
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.posts_comment_counter();

-- ---------------- grants + RLS ----------------
-- Explicit table grants (don't lean on default privileges — they only cover
-- objects created by the role that configured them). RLS below narrows rows;
-- these grant the verbs. No UPDATE anywhere: posts aren't editable in v1 and
-- the counter triggers run SECURITY DEFINER as the table owner.
GRANT SELECT, INSERT, DELETE ON public.posts         TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_likes    TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_saves    TO authenticated;

ALTER TABLE public.posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_saves    ENABLE ROW LEVEL SECURITY;

-- The community board is signed-in-only (no anon read — it's the students'
-- space, not the public marketing surface).
CREATE POLICY "Signed-in users read posts"
  ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users create own posts"
  ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Users delete own posts"
  ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id);
-- no UPDATE policy: posts are not editable in v1.

-- Likes: own rows only — "did I like it" comes from my rows, the total from
-- posts.like_count, so nobody can scrape who liked what.
CREATE POLICY "Users read own likes"
  ON public.post_likes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users like posts"
  ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike posts"
  ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Signed-in users read comments"
  ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users comment as themselves"
  ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
-- Commenters can delete their own; the post's author can moderate their board.
CREATE POLICY "Users delete own or on-own-post comments"
  ON public.post_comments FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id
    OR auth.uid() = (SELECT p.author_id FROM public.posts p WHERE p.id = post_id)
  );

CREATE POLICY "Users read own saves"
  ON public.post_saves FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users save posts"
  ON public.post_saves FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unsave posts"
  ON public.post_saves FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------------- rate limits (mirror 20260625000001) ----------------
CREATE OR REPLACE FUNCTION public.rl_posts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_uid IS NULL OR NEW.author_id IS DISTINCT FROM v_uid THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.posts p
  WHERE p.author_id = v_uid AND p.created_at > now() - interval '1 hour';
  IF v_count >= 10 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS zz_rl_posts ON public.posts;
CREATE TRIGGER zz_rl_posts
  BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.rl_posts();

CREATE OR REPLACE FUNCTION public.rl_post_comments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_count INT;
BEGIN
  IF v_uid IS NULL OR NEW.author_id IS DISTINCT FROM v_uid THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_count
  FROM public.post_comments c
  WHERE c.author_id = v_uid AND c.created_at > now() - interval '1 hour';
  IF v_count >= 60 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'PT429';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS zz_rl_post_comments ON public.post_comments;
CREATE TRIGGER zz_rl_post_comments
  BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.rl_post_comments();

-- ---------------- storage: post-images bucket ----------------
-- Public read (the feed renders plain public URLs, same as avatars);
-- 5MB + image-mime caps enforced by Storage itself; writes are scoped to
-- the uploader's own <uid>/ folder by the shared own-folder policies below.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('post-images', 'post-images', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Extend the shared own-folder policies (20260602000003) to the new bucket.
DROP POLICY IF EXISTS "Users manage own folder (insert)" ON storage.objects;
DROP POLICY IF EXISTS "Users manage own folder (update)" ON storage.objects;
DROP POLICY IF EXISTS "Users manage own folder (delete)" ON storage.objects;

CREATE POLICY "Users manage own folder (insert)"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['avatars', 'project-icons', 'post-images'])
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users manage own folder (update)"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['avatars', 'project-icons', 'post-images'])
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY['avatars', 'project-icons', 'post-images'])
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users manage own folder (delete)"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = ANY (ARRAY['avatars', 'project-icons', 'post-images'])
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

NOTIFY pgrst, 'reload schema';
