import { supabase, isSupabaseConfigured } from './supabase'

/**
 * Profile Service
 * 
 * Handles all profile CRUD operations and username availability checks.
 * Works with the profiles table created by 003_profiles_table.sql migration.
 */

export const profileService = {
  /**
   * Get a user's profile by their user ID
   * @param {string} userId - The user's UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getProfile(userId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Database not configured', code: 'NOT_CONFIGURED' } }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code === 'PGRST116') {
        // No profile found - not an error, just null
        return { data: null, error: null }
      }

      if (error) {
        return { data: null, error: { message: error.message, code: error.code } }
      }

      return { data, error: null }
    } catch (err) {
      console.error('getProfile error:', err)
      return { data: null, error: { message: err.message, code: 'UNKNOWN_ERROR' } }
    }
  },

  /**
   * Create a new profile for a user (during onboarding)
   * @param {string} userId - The user's UUID
   * @param {object} profileData - Profile fields to set
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async createProfile(userId, profileData) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Database not configured', code: 'NOT_CONFIGURED' } }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          ...profileData
        })
        .select()
        .single()

      if (error) {
        // Handle unique constraint violation (username taken)
        if (error.code === '23505') {
          return { 
            data: null, 
            error: { message: 'Username already taken', code: 'USERNAME_TAKEN' } 
          }
        }
        return { data: null, error: { message: error.message, code: error.code } }
      }

      return { data, error: null }
    } catch (err) {
      console.error('createProfile error:', err)
      return { data: null, error: { message: err.message, code: 'UNKNOWN_ERROR' } }
    }
  },

  /**
   * Update an existing profile
   * @param {string} userId - The user's UUID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async updateProfile(userId, updates) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Database not configured', code: 'NOT_CONFIGURED' } }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) {
        // Handle unique constraint violation (username taken)
        if (error.code === '23505') {
          return { 
            data: null, 
            error: { message: 'Username already taken', code: 'USERNAME_TAKEN' } 
          }
        }
        return { data: null, error: { message: error.message, code: error.code } }
      }

      return { data, error: null }
    } catch (err) {
      console.error('updateProfile error:', err)
      return { data: null, error: { message: err.message, code: 'UNKNOWN_ERROR' } }
    }
  },

  /**
   * Create or update a profile (upsert)
   * Useful for onboarding where we don't know if profile exists yet
   * @param {string} userId - The user's UUID
   * @param {object} profileData - Profile fields to set
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async upsertProfile(userId, profileData) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Database not configured', code: 'NOT_CONFIGURED' } }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          ...profileData
        }, {
          onConflict: 'id'
        })
        .select()
        .single()

      if (error) {
        // Handle unique constraint violation (username taken)
        if (error.code === '23505') {
          return { 
            data: null, 
            error: { message: 'Username already taken', code: 'USERNAME_TAKEN' } 
          }
        }
        return { data: null, error: { message: error.message, code: error.code } }
      }

      return { data, error: null }
    } catch (err) {
      console.error('upsertProfile error:', err)
      return { data: null, error: { message: err.message, code: 'UNKNOWN_ERROR' } }
    }
  },

  /**
   * Check if a username is available (case-insensitive)
   * Calls the is_username_available RPC function
   * @param {string} username - Username to check
   * @returns {Promise<boolean>}
   */
  async isUsernameAvailable(username) {
    if (!isSupabaseConfigured() || !supabase) {
      return false
    }

    if (!username || typeof username !== 'string' || username.trim() === '') {
      return false
    }

    try {
      const { data, error } = await supabase.rpc('is_username_available', {
        check_username: username.trim()
      })

      if (error) {
        console.error('isUsernameAvailable error:', error)
        return false
      }

      return data === true
    } catch (err) {
      console.error('isUsernameAvailable error:', err)
      return false
    }
  },

  /**
   * Mark onboarding as complete
   * @param {string} userId - The user's UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async completeOnboarding(userId) {
    return this.updateProfile(userId, { onboarding_completed: true })
  },

  /**
   * Get a profile by username (for profile pages)
   * @param {string} username - The username to look up
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getProfileByUsername(username) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Database not configured', code: 'NOT_CONFIGURED' } }
    }

    if (!username || typeof username !== 'string') {
      return { data: null, error: { message: 'Invalid username', code: 'INVALID_INPUT' } }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', username.trim())
        .single()

      if (error && error.code === 'PGRST116') {
        // No profile found
        return { data: null, error: { message: 'Profile not found', code: 'NOT_FOUND' } }
      }

      if (error) {
        return { data: null, error: { message: error.message, code: error.code } }
      }

      return { data, error: null }
    } catch (err) {
      console.error('getProfileByUsername error:', err)
      return { data: null, error: { message: err.message, code: 'UNKNOWN_ERROR' } }
    }
  },

  /**
   * Search profiles by university (for discovery)
   * @param {string} university - University name to search
   * @param {number} limit - Max results to return
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getProfilesByUniversity(university, limit = 20) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Database not configured', code: 'NOT_CONFIGURED' } }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('university', university)
        .eq('onboarding_completed', true)
        .limit(limit)

      if (error) {
        return { data: null, error: { message: error.message, code: error.code } }
      }

      return { data: data || [], error: null }
    } catch (err) {
      console.error('getProfilesByUniversity error:', err)
      return { data: null, error: { message: err.message, code: 'UNKNOWN_ERROR' } }
    }
  }
}

export default profileService
