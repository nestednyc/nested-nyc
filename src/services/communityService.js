/**
 * Community Service
 * Supabase data access for the community board: posts (text + images,
 * optional project tag), likes, comments, saves. All methods return
 * { data, error } and never throw. Author identity rides denormalized
 * snapshot columns (see migration 20260827000000) — no profiles join.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

const notConfigured = { message: 'Supabase not configured' }

// Client-mirrored limits (the DB CHECKs + rate triggers enforce for real).
export const POST_BODY_MAX = 2000
export const POST_COMMENT_MAX = 1000
export const POST_IMAGES_MAX = 4
export const FEED_PAGE = 30
// Auto-hide threshold (migration 20260830000002): a post / comment with this
// many distinct reports drops out of every feed query until a founder clears it.
export const HIDE_AT = 3

// Friendly message for the write-path errors the DB raises.
export function communityErrorMessage(error, fallback) {
  if (error && error.code === 'PT429') return "Easy there — you're posting too fast. Give it a minute."
  return (error && error.message) || fallback
}

const POST_SELECT = '*, project:projects(id, name, category), org:organizations(id, slug, name, verified)'
const SPOTLIGHT_SELECT = 'id, slug, name, logo, bio, location, verified, type, university_id, spotlight_until'

export const communityService = {
  /**
   * Newest-first feed page. Pass `before` (ISO created_at of the oldest
   * loaded post) to page further back.
   */
  async getFeed({ before = null, limit = FEED_PAGE } = {}) {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    let q = supabase
      .from('posts')
      .select(POST_SELECT)
      .lt('report_count', HIDE_AT)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (before) q = q.lt('created_at', before)
    const { data, error } = await q
    return { data: data || [], error }
  },

  /**
   * The club in the spotlight right now (organizations.spotlight_until in the
   * future, hand-set by a founder — see migration 20260830000001) plus its
   * latest board post. `data` is null when nobody is spotlighted.
   */
  async getSpotlight() {
    if (!isSupabaseConfigured()) return { data: null, error: notConfigured }
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select(SPOTLIGHT_SELECT)
      .eq('verified', true)
      .gt('spotlight_until', new Date().toISOString())
      .order('spotlight_until', { ascending: true })
      .limit(1)
    if (error || !orgs || !orgs.length) return { data: null, error }
    const org = orgs[0]
    const { data: posts } = await communityService.getOrgPosts(org.id, { limit: 1 })
    return { data: { org, post: (posts && posts[0]) || null }, error: null }
  },

  /**
   * File a report against a post / comment / profile. Write-only: users never
   * read the reports table. 23505 = this person already reported this target —
   * treated as success so a double-tap can't surface an error.
   */
  async reportContent({ targetType, targetId, reason = '' }, userId) {
    if (!isSupabaseConfigured()) return { error: notConfigured }
    const { error } = await supabase.from('reports').insert({
      reporter_id: userId,
      target_type: targetType,
      target_id: targetId,
      reason: String(reason || '').slice(0, 500),
    })
    return { error: error && error.code === '23505' ? null : error }
  },

  /** The caller's own like + save marks, one round trip each. */
  async getMyMarks() {
    if (!isSupabaseConfigured()) return { data: { likes: [], saves: [] }, error: notConfigured }
    const [likes, saves] = await Promise.all([
      supabase.from('post_likes').select('post_id'),
      supabase.from('post_saves').select('post_id'),
    ])
    return {
      data: {
        likes: (likes.data || []).map((r) => r.post_id),
        saves: (saves.data || []).map((r) => r.post_id),
      },
      error: likes.error || saves.error,
    }
  },

  /** Saved-only feed: my saved post ids → those posts, newest first. */
  async getSavedFeed() {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    const { data: marks, error: mErr } = await supabase.from('post_saves').select('post_id')
    if (mErr) return { data: [], error: mErr }
    const ids = (marks || []).map((r) => r.post_id)
    if (!ids.length) return { data: [], error: null }
    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .in('id', ids)
      .lt('report_count', HIDE_AT)
      .order('created_at', { ascending: false })
    return { data: data || [], error }
  },

  /** One post by id (the /community/:id permalink). null = gone or hidden. */
  async getPost(id) {
    if (!isSupabaseConfigured()) return { data: null, error: notConfigured }
    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('id', id)
      .lt('report_count', HIDE_AT)
      .maybeSingle()
    return { data: data || null, error }
  },

  /** Edit my own post's words / kind / project tag (column-level grant). */
  async updatePost(id, { body, kind, projectId }) {
    if (!isSupabaseConfigured()) return { data: null, error: notConfigured }
    const patch = {}
    if (body !== undefined) patch.body = body
    if (kind !== undefined) patch.kind = kind
    if (projectId !== undefined) patch.project_id = projectId || null
    const { data, error } = await supabase
      .from('posts')
      .update(patch)
      .eq('id', id)
      .select(POST_SELECT)
      .single()
    return { data, error }
  },

  /** Insert a post (payload from toDbPost) and return the full row back. */
  async createPost(payload) {
    if (!isSupabaseConfigured()) return { data: null, error: notConfigured }
    const { data, error } = await supabase
      .from('posts')
      .insert(payload)
      .select(POST_SELECT)
      .single()
    return { data, error }
  },

  async deletePost(id) {
    if (!isSupabaseConfigured()) return { error: notConfigured }
    const { error } = await supabase.from('posts').delete().eq('id', id)
    return { error }
  },

  async likePost(postId, userId) {
    if (!isSupabaseConfigured()) return { error: notConfigured }
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId })
    // 23505 = already liked (double-click, second tab) — not a real failure.
    return { error: error && error.code === '23505' ? null : error }
  },

  async unlikePost(postId, userId) {
    if (!isSupabaseConfigured()) return { error: notConfigured }
    const { error } = await supabase
      .from('post_likes').delete().eq('post_id', postId).eq('user_id', userId)
    return { error }
  },

  async savePost(postId, userId) {
    if (!isSupabaseConfigured()) return { error: notConfigured }
    const { error } = await supabase.from('post_saves').insert({ post_id: postId, user_id: userId })
    return { error: error && error.code === '23505' ? null : error }
  },

  async unsavePost(postId, userId) {
    if (!isSupabaseConfigured()) return { error: notConfigured }
    const { error } = await supabase
      .from('post_saves').delete().eq('post_id', postId).eq('user_id', userId)
    return { error }
  },

  async getComments(postId) {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    const { data, error } = await supabase
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .lt('report_count', HIDE_AT)
      .order('created_at', { ascending: true })
    return { data: data || [], error }
  },

  /** Insert a comment (payload from toDbComment) and return the row. */
  async addComment(payload) {
    if (!isSupabaseConfigured()) return { data: null, error: notConfigured }
    const { data, error } = await supabase
      .from('post_comments')
      .insert(payload)
      .select('*')
      .single()
    return { data, error }
  },

  async deleteComment(id) {
    if (!isSupabaseConfigured()) return { error: notConfigured }
    const { error } = await supabase.from('post_comments').delete().eq('id', id)
    return { error }
  },
  // ---------------- org follows ----------------

  /** Verified orgs by id (name, slug, logo) — the "Following" list in Your corner. */
  async getOrgsByIds(ids) {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    if (!ids || !ids.length) return { data: [], error: null }
    const { data, error } = await supabase
      .from('organizations')
      .select('id, slug, name, logo')
      .in('id', ids)
      .order('name', { ascending: true })
    return { data: data || [], error }
  },

  /** Org ids the caller follows (own rows only — RLS). */
  async getMyFollows() {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    const { data, error } = await supabase.from('org_follows').select('org_id')
    return { data: (data || []).map((r) => r.org_id), error }
  },

  async followOrg(orgId, userId) {
    if (!isSupabaseConfigured()) return { error: notConfigured }
    const { error } = await supabase.from('org_follows').insert({ org_id: orgId, user_id: userId })
    // 23505 = already following (double-click, second tab) — not a real failure.
    return { error: error && error.code === '23505' ? null : error }
  },

  async unfollowOrg(orgId, userId) {
    if (!isSupabaseConfigured()) return { error: notConfigured }
    const { error } = await supabase
      .from('org_follows').delete().eq('org_id', orgId).eq('user_id', userId)
    return { error }
  },

  /** Follower total for one org (SECURITY DEFINER count — followers stay private). */
  async getOrgFollowerCount(orgId) {
    if (!isSupabaseConfigured()) return { data: 0, error: notConfigured }
    const { data, error } = await supabase.rpc('org_follower_count', { p_org: orgId })
    return { data: typeof data === 'number' ? data : 0, error }
  },

  /** Notes tagged with one project, newest first (the flyer page's "On the board"). */
  async getProjectPosts(projectId, { limit = 5 } = {}) {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('project_id', projectId)
      .lt('report_count', HIDE_AT)
      .order('created_at', { ascending: false })
      .limit(limit)
    return { data: data || [], error }
  },

  /** Posts pinned by one org, newest first (org page + org dashboard). */
  async getOrgPosts(orgId, { limit = 20 } = {}) {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    const { data, error } = await supabase
      .from('posts')
      .select(POST_SELECT)
      .eq('org_id', orgId)
      .lt('report_count', HIDE_AT)
      .order('created_at', { ascending: false })
      .limit(limit)
    return { data: data || [], error }
  },
}

export default communityService
