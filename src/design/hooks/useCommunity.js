/* ============================================================
   useCommunity — the community board domain: the post feed with
   its All / My school / Saved filters, the composer submit path
   (image uploads → insert → prepend), optimistic like/save marks,
   and lazily-loaded per-post comments.

   Domain-hook pattern: NestedApp stays the composition root. The
   feed loads lazily on first visit (ensureFeed — NestedApp calls it
   from a route effect, NOT the signed-in boot barrier, so opening
   the app stays light); resetCommunity() is this domain's slice of
   signOut's wipe.
   ============================================================ */
import React from 'react'
import { isSupabaseConfigured } from '../../lib/supabase'
import { communityService, communityErrorMessage, POST_IMAGES_MAX } from '../../services/communityService'
import { storageService } from '../../services/storageService'
import { fromDbPost, fromDbComment, toDbPost, toDbComment } from '../postAdapter'

const { useState, useRef } = React;

export function useCommunity({ profile, toast, requireAuth }) {
  const [feed, setFeed] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedFilter, setFeedFilter] = useState("all"); // all | school | saved
  const [postLikes, setPostLikes] = useState(new Set());
  const [postSaves, setPostSaves] = useState(new Set());
  const [posting, setPosting] = useState(false);
  // postId → { list, loading } — comments load on first expand only.
  const [postComments, setPostComments] = useState({});
  // The Saved filter is its own fetch (saved posts can be older than the
  // loaded feed window), cached until something changes it.
  const [savedPosts, setSavedPosts] = useState(null); // null = not loaded
  const [savedLoading, setSavedLoading] = useState(false);
  const loadedRef = useRef(false);

  // First visit to the Community screen loads the feed + my marks; later
  // visits reuse state (posting/liking keeps it fresh enough for v1).
  async function ensureFeed() {
    if (loadedRef.current || !profile || !isSupabaseConfigured()) return;
    loadedRef.current = true;
    setFeedLoading(true);
    const [{ data: rows, error }, { data: marks }] = await Promise.all([
      communityService.getFeed({}),
      communityService.getMyMarks(),
    ]);
    setFeedLoading(false);
    if (error) { toast("Couldn't load the board — " + (error.message || "try again"), "x"); loadedRef.current = false; return; }
    setFeed(rows.map(fromDbPost).filter(Boolean));
    if (marks) {
      setPostLikes(new Set(marks.likes));
      setPostSaves(new Set(marks.saves));
    }
  }

  async function refreshFeed() {
    loadedRef.current = false;
    await ensureFeed();
  }

  // Filter selection; entering Saved fetches that list once.
  async function selectFeedFilter(f) {
    setFeedFilter(f);
    if (f !== "saved" || savedPosts !== null || savedLoading) return;
    setSavedLoading(true);
    const { data, error } = await communityService.getSavedFeed();
    setSavedLoading(false);
    if (error) { toast("Couldn't load saved posts — try again", "x"); return; }
    setSavedPosts(data.map(fromDbPost).filter(Boolean));
  }

  // The composer's submit: upload images (sequential — order = slot order),
  // insert the post, prepend the returned row. Files arrive raw from the
  // screen; body/projectId already validated there.
  async function createCommunityPost({ body, files, projectId }) {
    if (!profile) return requireAuth("Sign in to post");
    const text = (body || "").trim();
    if (!text && !(files && files.length)) return { ok: false };
    setPosting(true);

    const images = [];
    for (let i = 0; i < Math.min((files || []).length, POST_IMAGES_MAX); i++) {
      const { url, error } = await storageService.uploadPostImage(files[i], i);
      if (error) {
        setPosting(false);
        toast("Image didn't upload — " + (error.message || "try again"), "x");
        return { ok: false };
      }
      images.push(url);
    }

    const { data, error } = await communityService.createPost(
      toDbPost({ body: text, images, projectId }, profile)
    );
    setPosting(false);
    if (error) {
      toast(communityErrorMessage(error, "Post didn't pin — try again"), "x");
      return { ok: false };
    }
    setFeed((f) => [fromDbPost(data), ...f]);
    toast("Pinned to the board", "check");
    return { ok: true };
  }

  async function deleteCommunityPost(id) {
    const prev = feed;
    setFeed((f) => f.filter((p) => p.id !== id));
    setSavedPosts((sp) => (sp === null ? sp : sp.filter((p) => p.id !== id)));
    const { error } = await communityService.deletePost(id);
    if (error) {
      setFeed(prev);
      setSavedPosts(null);
      toast("Couldn't take that down — " + (error.message || "try again"), "x");
    } else {
      toast("Post taken down", "check");
    }
  }

  function bumpLikeCount(id, delta) {
    setFeed((f) => f.map((p) => p.id === id ? { ...p, likes: Math.max(0, p.likes + delta) } : p));
  }

  async function togglePostLike(id) {
    if (!profile) return requireAuth("Sign in to like posts");
    const wasOn = postLikes.has(id);
    setPostLikes((s) => { const n = new Set(s); wasOn ? n.delete(id) : n.add(id); return n; });
    bumpLikeCount(id, wasOn ? -1 : 1);
    if (!isSupabaseConfigured()) return;
    const { error } = wasOn
      ? await communityService.unlikePost(id, profile.id)
      : await communityService.likePost(id, profile.id);
    if (error) {
      setPostLikes((s) => { const n = new Set(s); wasOn ? n.add(id) : n.delete(id); return n; });
      bumpLikeCount(id, wasOn ? 1 : -1);
      toast("That didn't save — try again", "x");
    }
  }

  async function togglePostSave(id) {
    if (!profile) return requireAuth("Sign in to save posts");
    const wasOn = postSaves.has(id);
    setPostSaves((s) => { const n = new Set(s); wasOn ? n.delete(id) : n.add(id); return n; });
    // Keep the cached Saved list coherent: unsave drops the card; save adds
    // it from whichever list currently holds the post.
    setSavedPosts((sp) => {
      if (sp === null) return sp;
      if (wasOn) return sp.filter((p) => p.id !== id);
      const post = feed.find((p) => p.id === id);
      return post && !sp.some((p) => p.id === id) ? [post, ...sp] : sp;
    });
    toast(wasOn ? "Removed from saved" : "Saved", wasOn ? "x" : "bookmark");
    if (!isSupabaseConfigured()) return;
    const { error } = wasOn
      ? await communityService.unsavePost(id, profile.id)
      : await communityService.savePost(id, profile.id);
    if (error) {
      setPostSaves((s) => { const n = new Set(s); wasOn ? n.add(id) : n.delete(id); return n; });
      setSavedPosts(null); // cache is now unknown — refetch on next visit
      toast("That didn't save — try again", "x");
    }
  }

  // First expand fetches; afterwards the cached list stays (new comments
  // land in it via addCommunityComment).
  async function loadPostComments(postId) {
    if (postComments[postId] && (postComments[postId].loading || postComments[postId].list)) return;
    setPostComments((c) => ({ ...c, [postId]: { list: null, loading: true } }));
    const { data, error } = await communityService.getComments(postId);
    if (error) {
      setPostComments((c) => ({ ...c, [postId]: undefined }));
      toast("Couldn't load comments — try again", "x");
      return;
    }
    setPostComments((c) => ({ ...c, [postId]: { list: data.map(fromDbComment).filter(Boolean), loading: false } }));
  }

  async function addCommunityComment(postId, body) {
    if (!profile) return requireAuth("Sign in to comment");
    const text = (body || "").trim();
    if (!text) return { ok: false };
    const { data, error } = await communityService.addComment(toDbComment(postId, text, profile));
    if (error) {
      toast(communityErrorMessage(error, "Comment didn't send — try again"), "x");
      return { ok: false };
    }
    const row = fromDbComment(data);
    setPostComments((c) => {
      const cur = c[postId];
      return { ...c, [postId]: { list: [...((cur && cur.list) || []), row], loading: false } };
    });
    setFeed((f) => f.map((p) => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
    return { ok: true };
  }

  async function deleteCommunityComment(postId, commentId) {
    const cur = postComments[postId];
    if (!cur || !cur.list) return;
    const prev = cur.list;
    setPostComments((c) => ({ ...c, [postId]: { list: prev.filter((x) => x.id !== commentId), loading: false } }));
    setFeed((f) => f.map((p) => p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
    const { error } = await communityService.deleteComment(commentId);
    if (error) {
      setPostComments((c) => ({ ...c, [postId]: { list: prev, loading: false } }));
      setFeed((f) => f.map((p) => p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p));
      toast("Couldn't delete that — try again", "x");
    }
  }

  // signOut's wipe of this domain.
  function resetCommunity() {
    setFeed([]);
    setFeedLoading(false);
    setFeedFilter("all");
    setPostLikes(new Set());
    setPostSaves(new Set());
    setPostComments({});
    setSavedPosts(null);
    setSavedLoading(false);
    setPosting(false);
    loadedRef.current = false;
  }

  return {
    feed, feedLoading, feedFilter, selectFeedFilter,
    savedPosts, savedLoading,
    postLikes, postSaves, postComments, posting,
    ensureFeed, refreshFeed,
    createCommunityPost, deleteCommunityPost,
    togglePostLike, togglePostSave,
    loadPostComments, addCommunityComment, deleteCommunityComment,
    resetCommunity,
  };
}
