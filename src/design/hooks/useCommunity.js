/* ============================================================
   useCommunity — the community board domain: the single post feed
   (newest first, no filters — the board is one list), the composer
   submit path (image uploads → insert → prepend), optimistic
   like/save/follow marks, lazily-loaded per-post comments, the
   read-time merge of orgs' upcoming events, the club spotlight,
   "Load older" paging, and report/flag.

   Two kinds of poster share the board: students (their profile is
   the identity) and ORG accounts (the owner's uid is the author,
   the org supplies the name/logo — see toDbOrgPost). Students can
   follow orgs (follows drive the bell + the spotlight, not a feed
   filter) and bookmark posts; saved posts are their own fetch
   (ensureSavedPosts) and render on the /saved page, not the board.

   Domain-hook pattern: NestedApp stays the composition root. The
   feed loads lazily on first visit (ensureFeed — NestedApp calls it
   from a route effect, NOT the signed-in boot barrier, so opening
   the app stays light); resetCommunity() is this domain's slice of
   signOut's wipe.
   ============================================================ */
import React from 'react'
import { isSupabaseConfigured } from '../../lib/supabase'
import { communityService, communityErrorMessage, POST_IMAGES_MAX, FEED_PAGE } from '../../services/communityService'
import { storageService } from '../../services/storageService'
import { eventService } from '../../services/eventService'
import { orgService } from '../../services/orgService'
import { fromDbPost, fromDbComment, toDbPost, toDbOrgPost, toDbComment, toBoardEvent, localDateISO } from '../postAdapter'
import { resolveOrgUniSlug } from '../data'

const { useState, useRef, useEffect } = React;

// An org account has no student profile; the board still needs "who am I"
// for marks, comments and delete rights. Mirrors the profile fields the
// adapters read, so the same code paths serve both kinds of poster.
function boardIdentity(profile, orgAccount) {
  if (profile) return profile;
  if (orgAccount) {
    return {
      id: orgAccount.owner_user_id,
      firstName: orgAccount.name || "",
      lastName: "",
      username: "",
      photos: orgAccount.logo ? [orgAccount.logo] : [],
      uni: orgAccount.uni || "",
      isOrg: true,
    };
  }
  return null;
}

// Append a page without ever duplicating an id (a post pinned between two
// page loads can't slip in twice).
function appendUnique(list, rows) {
  const seen = new Set((list || []).map((p) => p.id));
  return [...(list || []), ...rows.filter((p) => !seen.has(p.id))];
}

export function useCommunity({ profile, orgAccount, toast, requireAuth }) {
  const me = boardIdentity(profile, orgAccount);

  const [feed, setFeed] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [postLikes, setPostLikes] = useState(new Set());
  const [postSaves, setPostSaves] = useState(new Set());
  const [posting, setPosting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // postId → { list, loading } — comments load on first expand only.
  const [postComments, setPostComments] = useState({});
  // Saved posts (the /saved page) are their own fetch — a saved post can be
  // older than the loaded feed window — cached until something changes it.
  const [savedPosts, setSavedPosts] = useState(null); // null = not loaded
  const [savedLoading, setSavedLoading] = useState(false);
  // Orgs I follow (ids).
  const [follows, setFollows] = useState(new Set());
  const [followsLoaded, setFollowsLoaded] = useState(false);
  // The orgs behind those ids — name/slug/logo for "Your corner".
  const [followedOrgs, setFollowedOrgs] = useState([]);
  const followsRef = useRef(new Set());        // latest follows, for post-await reads
  const followsLoadRef = useRef(false);        // getMyFollows in flight / done
  // Upcoming events of verified orgs, merged into the board at read time.
  const [boardEvents, setBoardEvents] = useState([]);
  // The club in the spotlight: { org, post } or null.
  const [spotlight, setSpotlight] = useState(null);
  // "type:id" keys I've reported this session (reports are write-only).
  const [reported, setReported] = useState(new Set());
  // The /community/:id permalink: the post on screen, or why there isn't one.
  const [postDetail, setPostDetail] = useState({ id: null, post: null, loading: false, missing: false });
  // "Post to the board" from a flyer: the composer opens with that project tagged.
  const [composerPreset, setComposerPreset] = useState(null); // { projectId, kind, nonce }
  // The flyer page's "On the board": projectId → { posts, loading }.
  const [projectPosts, setProjectPosts] = useState({});
  // Org dashboard numbers (org accounts only).
  const [orgFollowerCount, setOrgFollowerCount] = useState(null);
  const [orgPostCount, setOrgPostCount] = useState(null);
  const loadedRef = useRef(false);
  const statsRef = useRef(null);

  function applyFollows(next) {
    followsRef.current = next;
    setFollows(next);
  }
  // A club accepted me: the DB auto-followed, mirror it here (useClubs → NestedApp → here).
  function markFollowed(orgId) {
    if (!orgId || followsRef.current.has(orgId)) return;
    applyFollows(new Set(followsRef.current).add(orgId));
  }

  // The orgs I follow — needed by the board AND by /org/:slug (Follow state,
  // follower-count nudge), so it hydrates on its own, once, for students.
  async function ensureFollows() {
    if (!profile || followsLoadRef.current || !isSupabaseConfigured()) return;
    followsLoadRef.current = true;
    const { data, error } = await communityService.getMyFollows();
    if (error) { followsLoadRef.current = false; return; }
    applyFollows(new Set(data || []));
    setFollowsLoaded(true);
    communityService.getOrgsByIds(data || []).then(({ data: orgs }) => setFollowedOrgs(orgs || []));
  }

  // First visit to the Community screen loads the feed + my marks; later
  // visits reuse state (posting/liking keeps it fresh enough for v1).
  async function ensureFeed() {
    if (loadedRef.current || !me || !isSupabaseConfigured()) return;
    loadedRef.current = true;
    setFeedLoading(true);
    setFeedError(null);
    const today = localDateISO();
    const [{ data: rows, error }, { data: marks }, { data: eventRows }, { data: spot }, { data: unis }] = await Promise.all([
      communityService.getFeed({}),
      communityService.getMyMarks(),
      // bounded: dated today or later, at most 100 — events.is_past is never maintained
      eventService.getUpcomingEvents({ from: today, limit: 100, viewerId: profile ? profile.id : null }),
      communityService.getSpotlight(),
      orgService.listUniversities(),
      ensureFollows(),
    ]);
    setFeedLoading(false);
    if (error) { setFeedError(error); loadedRef.current = false; return; }
    const posts = rows.map(fromDbPost).filter(Boolean);
    setFeed(posts);
    setFeedHasMore(rows.length >= FEED_PAGE);
    if (marks) {
      setPostLikes(new Set(marks.likes));
      setPostSaves(new Set(marks.saves));
    }
    setBoardEvents(
      (eventRows || [])
        .filter((e) => e && e.date && e.date >= today)
        .map((e) => toBoardEvent(e, { universities: unis || [] }))
        .filter(Boolean)
    );
    setSpotlight(spot
      ? { org: { ...spot.org, uni: resolveOrgUniSlug(spot.org, unis || []) }, post: spot.post ? fromDbPost(spot.post) : null }
      : null);
  }

  async function refreshFeed() {
    loadedRef.current = false;
    await ensureFeed();
  }

  // From a flyer's "Post to the board": prime the composer, the caller routes.
  function openBoardComposer(projectId, kind = "update") {
    if (!profile) return requireAuth("Sign in to post about a project");
    setComposerPreset({ projectId, kind, nonce: Date.now() });
  }
  function clearComposerPreset() { setComposerPreset(null); }

  // The notes tagged with a project (flyer page). One fetch per visit.
  async function ensureProjectPosts(projectId) {
    if (!projectId || !me || !isSupabaseConfigured()) return;
    setProjectPosts((m) => ({ ...m, [projectId]: { posts: (m[projectId] && m[projectId].posts) || [], loading: true } }));
    const { data, error } = await communityService.getProjectPosts(projectId, { limit: 5 });
    if (error) { setProjectPosts((m) => ({ ...m, [projectId]: { posts: [], loading: false } })); return; }
    setProjectPosts((m) => ({ ...m, [projectId]: { posts: data.map(fromDbPost).filter(Boolean), loading: false } }));
  }

  // The permalink's post: reuse a loaded copy when the board has it, else one
  // fetch. `missing` = deleted, hidden by reports, or never existed.
  async function ensurePost(id) {
    if (!id || !me) return;
    // `missing` is not final: a flaky fetch must be retried on the next visit.
    if (postDetail.id === id && (postDetail.post || postDetail.loading)) return;
    const local = feed.find((p) => p.id === id)
      || (savedPosts || []).find((p) => p.id === id);
    if (local) { setPostDetail({ id, post: local, loading: false, missing: false }); return; }
    setPostDetail({ id, post: null, loading: true, missing: false });
    if (!isSupabaseConfigured()) { setPostDetail({ id, post: null, loading: false, missing: true }); return; }
    const { data, error } = await communityService.getPost(id);
    if (error) { toast("Couldn't load that post — try again", "x"); setPostDetail({ id, post: null, loading: false, missing: false, error: true }); return; }
    setPostDetail({ id, post: data ? fromDbPost(data) : null, loading: false, missing: !data });
  }

  // Edit my own note (words / kind / project tag). The DB stamps edited_at.
  async function editCommunityPost(id, patch) {
    if (!me) return requireAuth("Sign in to edit");
    const { data, error } = await communityService.updatePost(id, {
      body: (patch.body || "").trim(),
      kind: patch.kind,
      projectId: patch.projectId,
    });
    if (error) {
      toast(communityErrorMessage(error, "Couldn't save that edit — try again"), "x");
      return { ok: false };
    }
    const row = fromDbPost(data);
    const swap = (list) => list.map((p) => (p.id === id ? { ...p, ...row } : p));
    setFeed(swap);
    setSavedPosts((sp) => (sp === null ? sp : swap(sp)));
    setPostDetail((d) => (d.post && d.post.id === id ? { ...d, post: { ...d.post, ...row } } : d));
    setSpotlight((s) => (s && s.post && s.post.id === id ? { ...s, post: { ...s.post, ...row } } : s));
    toast("Edit saved", "check");
    return { ok: true };
  }

  // The org dashboard's numbers: followers + posts pinned as the org.
  async function ensureOrgStats() {
    if (!orgAccount || !isSupabaseConfigured()) return;
    if (statsRef.current === orgAccount.id) return;
    statsRef.current = orgAccount.id;
    const [{ data: n }, { data: rows }] = await Promise.all([
      communityService.getOrgFollowerCount(orgAccount.id),
      communityService.getOrgPosts(orgAccount.id, { limit: 200 }),
    ]);
    setOrgFollowerCount(n || 0);
    setOrgPostCount((rows || []).length);
  }

  // The /saved page's posts: fetched once, cached; togglePostSave keeps the
  // cache coherent, and a failed unsave drops it so the next visit refetches.
  async function ensureSavedPosts() {
    if (!me || savedPosts !== null || savedLoading || !isSupabaseConfigured()) return;
    setSavedLoading(true);
    const { data, error } = await communityService.getSavedFeed();
    setSavedLoading(false);
    if (error) { toast("Couldn't load saved posts — try again", "x"); return; }
    setSavedPosts(data.map(fromDbPost).filter(Boolean));
  }

  // "Load older": page the feed back from its oldest loaded post.
  async function loadMoreFeed() {
    if (loadingMore || !feed.length) return;
    const before = feed[feed.length - 1].at;
    setLoadingMore(true);
    const { data, error } = await communityService.getFeed({ before });
    setLoadingMore(false);
    if (error) { toast("Couldn't load older posts — try again", "x"); return; }
    setFeed((f) => appendUnique(f, data.map(fromDbPost).filter(Boolean)));
    setFeedHasMore(data.length >= FEED_PAGE);
  }

  // Follow / unfollow an org (students only). Optimistic.
  async function toggleFollowOrg(orgId) {
    if (!profile) return requireAuth("Sign in to follow orgs");
    if (!orgId) return;
    const wasOn = followsRef.current.has(orgId);
    const next = new Set(followsRef.current);
    wasOn ? next.delete(orgId) : next.add(orgId);
    applyFollows(next);
    if (!isSupabaseConfigured()) return;
    const { error } = wasOn
      ? await communityService.unfollowOrg(orgId, profile.id)
      : await communityService.followOrg(orgId, profile.id);
    if (error) {
      const back = new Set(followsRef.current);
      wasOn ? back.add(orgId) : back.delete(orgId);
      applyFollows(back);
      toast(communityErrorMessage(error, "That didn't save — try again"), "x");
      return;
    }
    // "Your corner" lists the orgs behind the ids.
    setFollowedOrgs((list) => wasOn ? list.filter((o) => o.id !== orgId) : list);
    if (!wasOn) communityService.getOrgsByIds([orgId]).then(({ data: orgs }) => {
      if (orgs && orgs.length) setFollowedOrgs((list) => (list.some((o) => o.id === orgId) ? list : [...list, orgs[0]].sort((a, b) => a.name.localeCompare(b.name))));
    });
  }

  // The composer's submit: upload images (sequential — order = slot order),
  // insert the post, prepend the returned row. Files arrive raw from the
  // screen; body/projectId/kind already validated there. Org accounts post
  // AS the org (toDbOrgPost); students as themselves.
  async function createCommunityPost({ body, files, projectId, kind }) {
    if (!me) return requireAuth("Sign in to post");
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

    const payload = orgAccount
      ? toDbOrgPost({ body: text, images, kind }, orgAccount, orgAccount.owner_user_id)
      : toDbPost({ body: text, images, projectId, kind }, profile);
    const { data, error } = await communityService.createPost(payload);
    setPosting(false);
    if (error) {
      toast(communityErrorMessage(error, "Post didn't pin — try again"), "x");
      return { ok: false };
    }
    const made = fromDbPost(data);
    setFeed((f) => [made, ...f]);
    if (made.project) setProjectPosts((m) => m[made.project.id] ? { ...m, [made.project.id]: { ...m[made.project.id], posts: [made, ...m[made.project.id].posts].slice(0, 5) } } : m);
    setFeedError(null); // a successful write proves the board is reachable again
    if (orgAccount) setOrgPostCount((n) => (n === null ? n : n + 1));
    toast("Posted", "check");
    return { ok: true };
  }

  async function deleteCommunityPost(id) {
    const prev = feed;
    const prevDetail = postDetail;
    setFeed((f) => f.filter((p) => p.id !== id));
    setSavedPosts((sp) => (sp === null ? sp : sp.filter((p) => p.id !== id)));
    setPostDetail((d) => (d.post && d.post.id === id ? { id, post: null, loading: false, missing: true } : d));
    setSpotlight((s) => (s && s.post && s.post.id === id ? { ...s, post: null } : s));
    const { error } = await communityService.deletePost(id);
    if (error) {
      setFeed(prev);
      setPostDetail(prevDetail);
      setSavedPosts(null);
      toast("Couldn't take that down — " + (error.message || "try again"), "x");
    } else {
      if (orgAccount) setOrgPostCount((n) => (n === null ? n : Math.max(0, n - 1)));
      toast("Post taken down", "check");
    }
  }

  function bumpLikeCount(id, delta) {
    const bump = (list) => list.map((p) => p.id === id ? { ...p, likes: Math.max(0, p.likes + delta) } : p);
    setFeed(bump);
    setSavedPosts((sp) => (sp === null ? sp : bump(sp)));
    setPostDetail((d) => (d.post && d.post.id === id ? { ...d, post: bump([d.post])[0] } : d));
    setSpotlight((s) => (s && s.post && s.post.id === id ? { ...s, post: bump([s.post])[0] } : s));
  }

  async function togglePostLike(id) {
    if (!me) return requireAuth("Sign in to like posts");
    const wasOn = postLikes.has(id);
    setPostLikes((s) => { const n = new Set(s); wasOn ? n.delete(id) : n.add(id); return n; });
    bumpLikeCount(id, wasOn ? -1 : 1);
    if (!isSupabaseConfigured()) return;
    const { error } = wasOn
      ? await communityService.unlikePost(id, me.id)
      : await communityService.likePost(id, me.id);
    if (error) {
      setPostLikes((s) => { const n = new Set(s); wasOn ? n.add(id) : n.delete(id); return n; });
      bumpLikeCount(id, wasOn ? 1 : -1);
      toast("That didn't save — try again", "x");
    }
  }

  async function togglePostSave(id) {
    if (!me) return requireAuth("Sign in to save posts");
    const wasOn = postSaves.has(id);
    setPostSaves((s) => { const n = new Set(s); wasOn ? n.delete(id) : n.add(id); return n; });
    // Keep the cached Saved list coherent: unsave drops the card; save adds
    // it from whichever list currently holds the post.
    setSavedPosts((sp) => {
      if (sp === null) return sp;
      if (wasOn) return sp.filter((p) => p.id !== id);
      const post = feed.find((p) => p.id === id)
        || (postDetail.post && postDetail.post.id === id ? postDetail.post : null);
      return post && !sp.some((p) => p.id === id) ? [post, ...sp] : sp;
    });
    toast(wasOn ? "Removed from saved" : "Saved", wasOn ? "x" : "bookmark");
    if (!isSupabaseConfigured()) return;
    const { error } = wasOn
      ? await communityService.unsavePost(id, me.id)
      : await communityService.savePost(id, me.id);
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

  function bumpCommentCount(postId, delta) {
    const bump = (list) => list.map((p) => p.id === postId ? { ...p, commentCount: Math.max(0, p.commentCount + delta) } : p);
    setFeed(bump);
    setSavedPosts((sp) => (sp === null ? sp : bump(sp)));
    setPostDetail((d) => (d.post && d.post.id === postId ? { ...d, post: bump([d.post])[0] } : d));
    setSpotlight((s) => (s && s.post && s.post.id === postId ? { ...s, post: bump([s.post])[0] } : s));
  }

  async function addCommunityComment(postId, body) {
    if (!me) return requireAuth("Sign in to comment");
    const text = (body || "").trim();
    if (!text) return { ok: false };
    const { data, error } = await communityService.addComment(toDbComment(postId, text, me));
    if (error) {
      toast(communityErrorMessage(error, "Comment didn't send — try again"), "x");
      return { ok: false };
    }
    const row = fromDbComment(data);
    setPostComments((c) => {
      const cur = c[postId];
      return { ...c, [postId]: { list: [...((cur && cur.list) || []), row], loading: false } };
    });
    bumpCommentCount(postId, 1);
    return { ok: true };
  }

  async function deleteCommunityComment(postId, commentId) {
    const cur = postComments[postId];
    if (!cur || !cur.list) return;
    const prev = cur.list;
    setPostComments((c) => ({ ...c, [postId]: { list: prev.filter((x) => x.id !== commentId), loading: false } }));
    bumpCommentCount(postId, -1);
    const { error } = await communityService.deleteComment(commentId);
    if (error) {
      setPostComments((c) => ({ ...c, [postId]: { list: prev, loading: false } }));
      bumpCommentCount(postId, 1);
      toast("Couldn't delete that — try again", "x");
    }
  }

  // Report a post / comment. Optimistic mark (reports are write-only, so the
  // session remembers what I've already flagged); a repeat is a no-op.
  async function reportContent(targetType, targetId, reason) {
    if (!me) return requireAuth("Sign in to report");
    const key = targetType + ":" + targetId;
    if (reported.has(key)) { toast("Already reported — thanks", "check"); return { ok: true }; }
    setReported((s) => { const n = new Set(s); n.add(key); return n; });
    if (!isSupabaseConfigured()) return { ok: true };
    const { error } = await communityService.reportContent({ targetType, targetId, reason }, me.id);
    if (error) {
      setReported((s) => { const n = new Set(s); n.delete(key); return n; });
      toast(communityErrorMessage(error, "Couldn't send that report — try again"), "x");
      return { ok: false };
    }
    toast("Reported — we'll take a look", "check");
    return { ok: true };
  }

  // signOut's wipe of this domain.
  function resetCommunity() {
    setFeed([]);
    setFeedLoading(false);
    setFeedError(null);
    setFeedHasMore(false);
    setPostLikes(new Set());
    setPostSaves(new Set());
    setPostComments({});
    setPosting(false);
    setLoadingMore(false);
    setSavedPosts(null);
    setSavedLoading(false);
    applyFollows(new Set());
    setFollowsLoaded(false);
    setFollowedOrgs([]);
    followsLoadRef.current = false;
    setBoardEvents([]);
    setSpotlight(null);
    setReported(new Set());
    setPostDetail({ id: null, post: null, loading: false, missing: false });
    setComposerPreset(null);
    setProjectPosts({});
    setOrgFollowerCount(null);
    setOrgPostCount(null);
    loadedRef.current = false;
    statsRef.current = null;
  }

  return {
    feed, feedLoading, feedError,
    feedHasMore, loadingMore, loadMoreFeed,
    savedPosts, savedLoading, ensureSavedPosts,
    follows, followsLoaded, followedOrgs, ensureFollows, toggleFollowOrg, markFollowed,
    boardEvents, spotlight,
    reported, reportContent,
    postDetail, ensurePost, editCommunityPost,
    composerPreset, openBoardComposer, clearComposerPreset,
    projectPosts, ensureProjectPosts,
    orgFollowerCount, orgPostCount, ensureOrgStats,
    postLikes, postSaves, postComments, posting,
    ensureFeed, refreshFeed,
    createCommunityPost, deleteCommunityPost,
    togglePostLike, togglePostSave,
    loadPostComments, addCommunityComment, deleteCommunityComment,
    resetCommunity,
  };
}
