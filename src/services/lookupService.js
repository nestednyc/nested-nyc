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
    if (!email || typeof email !== 'string') {
      return { exists: false, error: { message: 'Invalid email' } }
    }

    // Goes through the /api/check-email proxy (service-role + per-IP rate limit)
    // instead of the RPC directly — anon EXECUTE on check_email_exists was
    // revoked to kill email enumeration (migration 20260625000001). This is a
    // signup UX hint only, so ANY failure (404 in local `vite` dev with no
    // Vercel runtime, 429, 5xx, network) fails OPEN: report "doesn't exist" and
    // let signup proceed — Supabase still enforces email uniqueness.
    try {
      const res = await fetch('/api/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      })
      if (!res.ok) {
        return { exists: false, error: { code: res.status, message: 'Lookup unavailable' } }
      }
      const data = await res.json()
      return { exists: data && data.exists === true, error: null }
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
