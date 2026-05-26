/**
 * Profile Service
 * Handles all profile-related database operations via Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

export const profileService = {
  /**
   * Get a profile by user ID
   * @param {string} userId - The user's UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getProfile(userId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    return { data, error }
  },

  /**
   * Get the current authenticated user's profile
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getCurrentProfile() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    return this.getProfile(user.id)
  },

  /**
   * Update a user's profile
   * @param {string} userId - The user's UUID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async updateProfile(userId, updates) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Upsert a profile (insert or update)
   * @param {string} userId - The user's UUID
   * @param {object} profileData - Profile data to upsert
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async upsertProfile(userId, profileData) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...profileData })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update the current user's profile
   * @param {object} updates - Fields to update
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async updateCurrentProfile(updates) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    return this.updateProfile(user.id, updates)
  },

  /**
   * Mark onboarding as completed for current user
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async completeOnboarding() {
    return this.updateCurrentProfile({ onboarding_completed: true })
  },

  /**
   * Check if user has completed onboarding
   * @param {string} userId - The user's UUID
   * @returns {Promise<boolean>}
   */
  async hasCompletedOnboarding(userId) {
    const { data } = await this.getProfile(userId)
    return data?.onboarding_completed === true
  },

  /**
   * Delete a user's profile and related data (MVP: profile data only, auth record stays)
   * @param {string} userId - The user's UUID
   * @returns {Promise<{error: object|null}>}
   */
  async deleteProfile(userId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: { message: 'Supabase not configured' } }
    }

    try {
      // Delete team memberships
      await supabase.from('team_members').delete().eq('user_id', userId)

      // Delete user's owned projects
      await supabase.from('projects').delete().eq('owner_id', userId)

      // Delete profile
      const { error } = await supabase.from('profiles').delete().eq('id', userId)

      return { error }
    } catch (err) {
      console.error('Delete profile error:', err)
      return { error: err }
    }
  },

  /**
   * Get lightweight stats for a user's social profile header.
   * Returns { projectCount, eventCount, joinedAt } — small parallel reads, no joins.
   * projectCount = owned projects + approved team memberships (small chance of
   * double-counting if a user owns a project and also appears in its team_members;
   * acceptable for V1 stats display).
   * @param {string} userId
   * @returns {Promise<{data: {projectCount: number, eventCount: number, joinedAt: string|null}|null, error: object|null}>}
   */
  async getUserStats(userId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    try {
      const [ownedRes, joinedRes, eventRes, profileRes] = await Promise.all([
        supabase.from('projects').select('*', { count: 'exact', head: true }).eq('owner_id', userId),
        supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'approved'),
        supabase.from('event_registrations').select('*', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('profiles').select('created_at').eq('id', userId).single()
      ])

      return {
        data: {
          projectCount: (ownedRes.count || 0) + (joinedRes.count || 0),
          eventCount: eventRes.count || 0,
          joinedAt: profileRes.data?.created_at || null
        },
        error: null
      }
    } catch (err) {
      console.error('getUserStats error:', err)
      return { data: null, error: err }
    }
  },

  /**
   * Fetch a profile via the column-restricted public_profiles view.
   * Used for anon viewers — exposes only the safe columns
   * (id, first_name, last_name, username, avatar, photos, university, headline).
   * @param {string} userId
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getPublicProfile(userId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('public_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    return { data, error }
  },

  /**
   * Get all profiles (for discovery/matching)
   * @param {object} options - Query options (limit, offset, filters)
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getAllProfiles(options = {}) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    let query = supabase
      .from('profiles')
      .select('*')
      .eq('onboarding_completed', true)

    if (options.university) {
      query = query.eq('university', options.university)
    }

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    return { data, error }
  }
}

export default profileService
