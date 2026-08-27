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

// Friendly message for the write-path errors the DB raises.
export function communityErrorMessage(error, fallback) {
  if (error && error.code === 'PT429') return "Easy there — you're posting too fast. Give it a minute."
  return (error && error.message) || fallback
}

const POST_SELECT = '*, project:projects(id, name, category)'

export const communityService = {
  /**
   * Newest-first feed page. Pass `before` (ISO created_at of the oldest
   * loaded post) to page further back; `university` to filter My school.
   */
  async getFeed({ before = null, university = null, limit = 30 } = {}) {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    let q = supabase
      .from('posts')
      .select(POST_SELECT)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (before) q = q.lt('created_at', before)
    if (university) q = q.eq('university', university)
    const { data, error } = await q
    return { data: data || [], error }
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
      .order('created_at', { ascending: false })
    return { data: data || [], error }
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
}

export default communityService
