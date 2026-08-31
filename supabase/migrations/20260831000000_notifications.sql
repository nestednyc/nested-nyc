-- ============================================================
-- Notifications: the first persisted, read/unread notification
-- feed. Rows are written ONLY by SECURITY DEFINER triggers —
-- users never insert; they read their own, flip read_at, delete.
-- ------------------------------------------------------------
-- Kinds:
--   post_like     someone liked my post          (dedup: one per actor × post)
--   post_comment  someone commented on my post
--   mention       someone @mentioned me in a post or comment
--   org_follow    a student followed my org      (recipient = the org owner)
-- The actor is snapshotted (name/handle/avatar) like posts.author_* — an
-- org owner acting as the org shows the org's name and logo.
-- Realtime: the table joins the supabase_realtime publication so the bell
-- updates live (the client subscribes to user_id=eq.<me>; RLS filters).
-- The two legacy notification kinds (incoming connections, join requests)
-- stay derived from their source tables — nothing here duplicates them.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('post_like', 'post_comment', 'mention', 'org_follow')),
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_name   TEXT NOT NULL DEFAULT '',
  actor_handle TEXT NOT NULL DEFAULT '',
  actor_avatar TEXT NOT NULL DEFAULT '',
  post_id      UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id   UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  org_id       UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  snippet      TEXT NOT NULL DEFAULT '',
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (user_id) WHERE read_at IS NULL;
-- One like-notification per actor × post (unlike/re-like doesn't re-ping).
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_like
  ON public.notifications (user_id, actor_id, post_id) WHERE kind = 'post_like';

GRANT SELECT, DELETE ON public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users mark own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- no INSERT policy: only the definer triggers below write rows.

-- ---------------- actor snapshot ----------------
-- An org owner acting (liking / commenting as the org) shows as the org.
CREATE OR REPLACE FUNCTION public.notif_actor(p_uid UUID)
RETURNS TABLE (name TEXT, handle TEXT, avatar TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(o.name, btrim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, ''))) AS name,
         CASE WHEN o.id IS NULL THEN COALESCE(p.username, '') ELSE '' END AS handle,
         COALESCE(o.logo, p.avatar, '') AS avatar
  FROM public.profiles p
  LEFT JOIN public.organizations o ON o.owner_user_id = p.id
  WHERE p.id = p_uid
  ORDER BY o.created_at NULLS LAST
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.notif_actor(UUID) FROM PUBLIC, anon, authenticated;

-- @mentions in a body → one 'mention' row per distinct mentioned student
-- (never the actor, never the post author when they're already getting a
-- post_comment for the same event). Capped at 5 per body.
CREATE OR REPLACE FUNCTION public.notif_mentions(p_body TEXT, p_actor UUID, p_post UUID, p_comment UUID, p_skip UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a RECORD;
  m RECORD;
  n INT := 0;
  inserted INT;
BEGIN
  IF p_body IS NULL OR position('@' in p_body) = 0 THEN RETURN; END IF;
  SELECT * INTO a FROM public.notif_actor(p_actor);
  -- A handle starts a token: "@maya" or "hey @maya", never the "@" inside
  -- jane@nyu.edu or a URL path. The cap counts rows written, not tokens tried.
  FOR m IN
    SELECT DISTINCT lower(x[2]) AS handle
    FROM regexp_matches(p_body, '(^|[^A-Za-z0-9_.@/])@([A-Za-z0-9_]{3,30})', 'g') AS x
  LOOP
    EXIT WHEN n >= 5;
    INSERT INTO public.notifications (user_id, kind, actor_id, actor_name, actor_handle, actor_avatar, post_id, comment_id, snippet)
    SELECT p.id, 'mention', p_actor, COALESCE(a.name, ''), COALESCE(a.handle, ''), COALESCE(a.avatar, ''), p_post, p_comment, left(p_body, 140)
    FROM public.profiles p
    WHERE lower(p.username) = m.handle
      AND p.id <> p_actor
      AND (p_skip IS NULL OR p.id <> p_skip)
      AND p.account_type = 'student';
    GET DIAGNOSTICS inserted = ROW_COUNT;
    n := n + inserted;
  END LOOP;
END;
$$;

-- ---------------- triggers ----------------
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po RECORD;
  a  RECORD;
BEGIN
  SELECT author_id, body INTO po FROM public.posts WHERE id = NEW.post_id;
  IF po.author_id IS NULL OR po.author_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT * INTO a FROM public.notif_actor(NEW.user_id);
  INSERT INTO public.notifications (user_id, kind, actor_id, actor_name, actor_handle, actor_avatar, post_id, snippet)
  VALUES (po.author_id, 'post_like', NEW.user_id, COALESCE(a.name, ''), COALESCE(a.handle, ''), COALESCE(a.avatar, ''), NEW.post_id, left(COALESCE(po.body, ''), 140))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_post_like ON public.post_likes;
CREATE TRIGGER notify_post_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_like();

CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po RECORD;
  a  RECORD;
BEGIN
  SELECT author_id INTO po FROM public.posts WHERE id = NEW.post_id;
  SELECT * INTO a FROM public.notif_actor(NEW.author_id);
  IF po.author_id IS NOT NULL AND po.author_id <> NEW.author_id THEN
    INSERT INTO public.notifications (user_id, kind, actor_id, actor_name, actor_handle, actor_avatar, post_id, comment_id, snippet)
    VALUES (po.author_id, 'post_comment', NEW.author_id, COALESCE(a.name, ''), COALESCE(a.handle, ''), COALESCE(a.avatar, ''), NEW.post_id, NEW.id, left(NEW.body, 140));
  END IF;
  PERFORM public.notif_mentions(NEW.body, NEW.author_id, NEW.post_id, NEW.id, po.author_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_post_comment ON public.post_comments;
CREATE TRIGGER notify_post_comment
  AFTER INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_comment();

CREATE OR REPLACE FUNCTION public.notify_post_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notif_mentions(NEW.body, NEW.author_id, NEW.id, NULL, NULL);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_post_mentions ON public.posts;
CREATE TRIGGER notify_post_mentions
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_mentions();

CREATE OR REPLACE FUNCTION public.notify_org_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  a RECORD;
BEGIN
  SELECT owner_user_id, name INTO o FROM public.organizations WHERE id = NEW.org_id;
  IF o.owner_user_id IS NULL OR o.owner_user_id = NEW.user_id THEN RETURN NEW; END IF;
  SELECT * INTO a FROM public.notif_actor(NEW.user_id);
  INSERT INTO public.notifications (user_id, kind, actor_id, actor_name, actor_handle, actor_avatar, org_id, snippet)
  VALUES (o.owner_user_id, 'org_follow', NEW.user_id, COALESCE(a.name, ''), COALESCE(a.handle, ''), COALESCE(a.avatar, ''), NEW.org_id, COALESCE(o.name, ''));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS notify_org_follow ON public.org_follows;
CREATE TRIGGER notify_org_follow
  AFTER INSERT ON public.org_follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_org_follow();

-- ---------------- realtime ----------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications')
  THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; END IF;
END $$;
-- DELETE payloads must carry user_id for the client's user_id=eq.<me> filter
-- (a removed post cascades its notifications away — the bell drops them live).
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

NOTIFY pgrst, 'reload schema';
