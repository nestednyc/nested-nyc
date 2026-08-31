/**
 * Notification Service
 * Supabase data access for the persisted notification feed (likes, comments,
 * mentions, org follows — migration 20260831000000). Rows are trigger-written;
 * the client only reads its own, flips read_at, and deletes. All methods
 * return { data, error } and never throw.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

const notConfigured = { message: 'Supabase not configured' }
export const NOTIF_PAGE = 50

export const notificationService = {
  /** Newest-first page of my notifications. */
  async list({ limit = NOTIF_PAGE } = {}) {
    if (!isSupabaseConfigured()) return { data: [], error: notConfigured }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    return { data: data || [], error }
  },

  /** Flip read_at on every unread row of mine. */
  async markAllRead() {
    if (!isSupabaseConfigured()) return { error: notConfigured }
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
    return { error }
  },

}

export default notificationService
