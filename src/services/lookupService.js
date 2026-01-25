/**
 * Lookup Service
 * Provides email and username availability checks via Supabase RPC functions
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

export const lookupService = {
  /**
   * Check if an email is already registered
   * @param {string} email - Email to check
   * @returns {Promise<{exists: boolean, error: object|null}>}
   */
  async checkEmailExists(email) {
    if (!isSupabaseConfigured() || !supabase) {
      return { exists: false, error: { message: 'Service not configured' } }
    }

    if (!email || typeof email !== 'string') {
      return { exists: false, error: { message: 'Invalid email' } }
    }

    try {
      const { data, error } = await supabase.rpc('check_email_exists', {
        email_to_check: email.toLowerCase().trim()
      })

      if (error) {
        console.error('Email lookup error:', error)
        return { exists: false, error }
      }

      return { exists: data === true, error: null }
    } catch (err) {
      console.error('Email lookup exception:', err)
      return { exists: false, error: { message: 'Lookup failed' } }
    }
  },

  /**
   * Check if a username is available (not taken)
   * @param {string} username - Username to check
   * @returns {Promise<{available: boolean, error: object|null}>}
   */
  async checkUsernameAvailable(username) {
    if (!isSupabaseConfigured() || !supabase) {
      return { available: true, error: { message: 'Service not configured' } }
    }

    if (!username || typeof username !== 'string') {
      return { available: false, error: { message: 'Invalid username' } }
    }

    // Client-side format validation
    const trimmed = username.trim()
    if (trimmed.length < 3) {
      return { available: false, error: { message: 'Username must be at least 3 characters' } }
    }
    if (trimmed.length > 30) {
      return { available: false, error: { message: 'Username must be 30 characters or less' } }
    }
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) {
      return { available: false, error: { message: 'Username must start with a letter and contain only letters, numbers, and underscores' } }
    }

    try {
      const { data, error } = await supabase.rpc('check_username_available', {
        username_to_check: trimmed.toLowerCase()
      })

      if (error) {
        console.error('Username lookup error:', error)
        return { available: true, error }
      }

      // data is TRUE if available, FALSE if taken
      return { available: data === true, error: null }
    } catch (err) {
      console.error('Username lookup exception:', err)
      return { available: true, error: { message: 'Lookup failed' } }
    }
  },

  /**
   * Validate username format (client-side only, no DB check)
   * @param {string} username - Username to validate
   * @returns {{valid: boolean, error: string|null}}
   */
  validateUsernameFormat(username) {
    if (!username || typeof username !== 'string') {
      return { valid: false, error: 'Username is required' }
    }

    const trimmed = username.trim()

    if (trimmed.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters' }
    }

    if (trimmed.length > 30) {
      return { valid: false, error: 'Username must be 30 characters or less' }
    }

    if (!/^[a-zA-Z]/.test(trimmed)) {
      return { valid: false, error: 'Username must start with a letter' }
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) {
      return { valid: false, error: 'Username can only contain letters, numbers, and underscores' }
    }

    return { valid: true, error: null }
  }
}
