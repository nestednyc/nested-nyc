/**
 * Connection Service
 * Persisted student-to-student "connections" (one-directional: you → them).
 */
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export const connectionService = {
  /**
   * Profiles the current user has connected to.
   * @returns {Promise<{data: array, error: object|null}>} array of profile rows
   */
  async getMyConnections() {
    if (!isSupabaseConfigured() || !supabase) return { data: [], error: null }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: null }

    const { data, error } = await supabase
      .from('connections')
      .select('created_at, target:profiles!connections_target_id_fkey(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return { data: [], error }
    return { data: (data || []).map(r => r.target).filter(Boolean), error: null }
  },

  /**
   * Profiles that have connected TO the current user (one-directional, the
   * reverse of getMyConnections). Powers the People "Incoming" tab. Requires
   * the target-read RLS policy (migration 20260602000002).
   * @returns {Promise<{data: array, error: object|null}>} array of profile rows
   */
  async getIncomingConnections() {
    if (!isSupabaseConfigured() || !supabase) return { data: [], error: null }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: null }

    const { data, error } = await supabase
      .from('connections')
      .select('created_at, source:profiles!connections_user_id_fkey(*)')
      .eq('target_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return { data: [], error }
    return { data: (data || []).map(r => r.source).filter(Boolean), error: null }
  },

  /**
   * Connect to another user. Duplicate (already connected) is treated as success.
   * @param {string} targetId
   */
  async connect(targetId) {
    if (!isSupabaseConfigured() || !supabase) return { error: { message: 'Supabase not configured' } }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: { message: 'Not authenticated' } }

    const { error } = await supabase
      .from('connections')
      .insert({ user_id: user.id, target_id: targetId })

    if (error && error.code === '23505') return { error: null } // already connected
    return { error }
  },

  /**
   * Remove a connection.
   * @param {string} targetId
   */
  async disconnect(targetId) {
    if (!isSupabaseConfigured() || !supabase) return { error: { message: 'Supabase not configured' } }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: { message: 'Not authenticated' } }

    const { error } = await supabase
      .from('connections')
      .delete()
      .eq('user_id', user.id)
      .eq('target_id', targetId)

    return { error }
  },
}

export default connectionService
