-- ============================================================
-- Comment replies: one level under a top-level comment, never
-- deeper. `parent_id` is the ROOT comment — the client sends the
-- root even when the tap was on a reply (it @mentions the tapped
-- author instead), and the aa_ trigger re-parents any deeper
-- insert to the root as defense, so the invariant holds no
-- matter who writes the row.
-- Notifications: the parent comment's author gets a new
-- 'comment_reply' kind. Dedupe per event: when the parent author
-- IS the post author they get only the reply row (it's the more
-- specific one), and @mentions skip both of them.
-- ============================================================
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE;
-- Only the FK cascade reads by parent (the feed loads whole posts);
-- partial keeps the top-level majority out of the index.
CREATE INDEX IF NOT EXISTS idx_post_comments_parent
  ON public.post_comments (parent_id) WHERE parent_id IS NOT NULL;

-- Runs before zz_rl_post_comments (alphabetical): a rejected forgery
-- shouldn't burn a rate-limit slot.
CREATE OR REPLACE FUNCTION public.post_comment_reply_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  par RECORD;
BEGIN
  IF NEW.parent_id IS NULL THEN RETURN NEW; END IF;
  SELECT post_id, parent_id INTO par FROM public.post_comments WHERE id = NEW.parent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent comment not found' USING ERRCODE = 'PT422';
  END IF;
  IF par.post_id <> NEW.post_id THEN
    RAISE EXCEPTION 'reply must stay on its parent''s post' USING ERRCODE = 'PT422';
  END IF;
  -- Parent is itself a reply → attach to its root (one hop suffices:
  -- every existing row already obeys the one-level invariant).
  IF par.parent_id IS NOT NULL THEN NEW.parent_id := par.parent_id; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS aa_comment_reply_level ON public.post_comments;
CREATE TRIGGER aa_comment_reply_level
  BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.post_comment_reply_level();

-- ---------------- notifications ----------------
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_kind_check
  CHECK (kind IN ('post_like', 'post_comment', 'comment_reply', 'mention', 'org_follow',
                  'org_join_request', 'org_join_accepted', 'org_join_rejected'));

-- notif_mentions grows a second skip (the reply target already gets a
-- comment_reply row — a mention row on top would be noise). Signature
-- change, so drop the 5-arg version rather than leave an ambiguous
-- overload behind; both callers are recreated below in this migration.
DROP FUNCTION IF EXISTS public.notif_mentions(TEXT, UUID, UUID, UUID, UUID);
CREATE OR REPLACE FUNCTION public.notif_mentions(p_body TEXT, p_actor UUID, p_post UUID, p_comment UUID, p_skip UUID, p_skip2 UUID)
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
      AND (p_skip2 IS NULL OR p.id <> p_skip2)
      AND p.account_type = 'student';
    GET DIAGNOSTICS inserted = ROW_COUNT;
    n := n + inserted;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.notif_mentions(TEXT, UUID, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  po RECORD;
  a  RECORD;
  reply_to UUID := NULL;
BEGIN
  SELECT author_id INTO po FROM public.posts WHERE id = NEW.post_id;
  SELECT * INTO a FROM public.notif_actor(NEW.author_id);
  IF NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO reply_to FROM public.post_comments WHERE id = NEW.parent_id;
    IF reply_to IS NOT NULL AND reply_to <> NEW.author_id THEN
      INSERT INTO public.notifications (user_id, kind, actor_id, actor_name, actor_handle, actor_avatar, post_id, comment_id, snippet)
      VALUES (reply_to, 'comment_reply', NEW.author_id, COALESCE(a.name, ''), COALESCE(a.handle, ''), COALESCE(a.avatar, ''), NEW.post_id, NEW.id, left(NEW.body, 140));
    ELSE
      reply_to := NULL; -- self-reply: fall through to the post_comment row
    END IF;
  END IF;
  IF po.author_id IS NOT NULL AND po.author_id <> NEW.author_id AND (reply_to IS NULL OR po.author_id <> reply_to) THEN
    INSERT INTO public.notifications (user_id, kind, actor_id, actor_name, actor_handle, actor_avatar, post_id, comment_id, snippet)
    VALUES (po.author_id, 'post_comment', NEW.author_id, COALESCE(a.name, ''), COALESCE(a.handle, ''), COALESCE(a.avatar, ''), NEW.post_id, NEW.id, left(NEW.body, 140));
  END IF;
  PERFORM public.notif_mentions(NEW.body, NEW.author_id, NEW.post_id, NEW.id, po.author_id, reply_to);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_post_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notif_mentions(NEW.body, NEW.author_id, NEW.id, NULL, NULL, NULL);
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
