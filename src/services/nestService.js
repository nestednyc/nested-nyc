/**
 * Nest Service
 * Handles all nest (community/group) related database operations via Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

export const nestService = {
  /**
   * Get all nests
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getAllNests() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('nests')
      .select('*')
      .order('member_count', { ascending: false })

    return { data, error }
  },

  /**
   * Get a single nest by ID
   * @param {string} nestId - The nest UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getNest(nestId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('nests')
      .select('*')
      .eq('id', nestId)
      .single()

    return { data, error }
  },

  /**
   * Get nest with its members
   * @param {string} nestId - The nest UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getNestWithMembers(nestId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data: nest, error: nestError } = await supabase
      .from('nests')
      .select('*')
      .eq('id', nestId)
      .single()

    if (nestError) {
      return { data: null, error: nestError }
    }

    // Get members with profile info
    const { data: members, error: membersError } = await supabase
      .from('nest_members')
      .select('*, profiles(*)')
      .eq('nest_id', nestId)

    if (membersError) {
      return { data: nest, error: membersError }
    }

    return {
      data: {
        ...nest,
        members: members || []
      },
      error: null
    }
  },

  /**
   * Get nests owned by the current user
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getMyNests() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: null }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: null }
    }

    const { data, error } = await supabase
      .from('nests')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    return { data: data || [], error }
  },

  /**
   * Get nests the current user has joined
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getJoinedNests() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: null }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: null }
    }

    const { data, error } = await supabase
      .from('nest_members')
      .select('nest_id, nests(*)')
      .eq('user_id', user.id)

    if (error) {
      return { data: [], error }
    }

    // Extract the nest objects
    const nests = data?.map(item => item.nests).filter(Boolean) || []
    return { data: nests, error: null }
  },

  /**
   * Create a new nest
   * @param {object} nest - Nest data
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async createNest(nest) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    // Create the nest
    const { data: newNest, error: nestError } = await supabase
      .from('nests')
      .insert({
        ...nest,
        owner_id: user.id,
        member_count: 1 // Owner counts as first member
      })
      .select()
      .single()

    if (nestError) {
      return { data: null, error: nestError }
    }

    // Auto-add owner as first member
    await supabase
      .from('nest_members')
      .insert({
        nest_id: newNest.id,
        user_id: user.id
      })

    return { data: newNest, error: null }
  },

  /**
   * Update an existing nest
   * @param {string} nestId - The nest UUID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async updateNest(nestId, updates) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('nests')
      .update(updates)
      .eq('id', nestId)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Delete a nest
   * @param {string} nestId - The nest UUID
   * @returns {Promise<{error: object|null}>}
   */
  async deleteNest(nestId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: { message: 'Supabase not configured' } }
    }

    const { error } = await supabase
      .from('nests')
      .delete()
      .eq('id', nestId)

    return { error }
  },

  /**
   * Join a nest (current user)
   * @param {string} nestId - The nest UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async joinNest(nestId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('nest_members')
      .select('*')
      .eq('nest_id', nestId)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return { data: existing, error: null } // Already a member
    }

    const { data, error } = await supabase
      .from('nest_members')
      .insert({
        nest_id: nestId,
        user_id: user.id
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Leave a nest (current user)
   * @param {string} nestId - The nest UUID
   * @returns {Promise<{error: object|null}>}
   */
  async leaveNest(nestId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: { message: 'Not authenticated' } }
    }

    const { error } = await supabase
      .from('nest_members')
      .delete()
      .eq('nest_id', nestId)
      .eq('user_id', user.id)

    return { error }
  },

  /**
   * Check if current user is a member of a nest
   * @param {string} nestId - The nest UUID
   * @returns {Promise<boolean>}
   */
  async isMember(nestId) {
    if (!isSupabaseConfigured() || !supabase) {
      return false
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return false
    }

    const { data } = await supabase
      .from('nest_members')
      .select('*')
      .eq('nest_id', nestId)
      .eq('user_id', user.id)
      .single()

    return !!data
  },

  /**
   * Check if current user is the owner of a nest
   * @param {string} nestId - The nest UUID
   * @returns {Promise<boolean>}
   */
  async isOwner(nestId) {
    if (!isSupabaseConfigured() || !supabase) {
      return false
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return false
    }

    const { data } = await supabase
      .from('nests')
      .select('owner_id')
      .eq('id', nestId)
      .single()

    return data?.owner_id === user.id
  },

  /**
   * Search nests by name or description
   * @param {string} query - Search query
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async searchNests(query) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('nests')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('member_count', { ascending: false })

    return { data, error }
  }
}

export default nestService
