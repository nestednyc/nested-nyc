/**
 * Auth Helper Utilities
 * Common functions for working with authenticated users
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Get the current authenticated user's ID
 * @returns {Promise<string|null>} User ID or null if not authenticated
 */
export async function getCurrentUserId() {
  if (!isSupabaseConfigured() || !supabase) {
    return null
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
  } catch (err) {
    console.error('Error getting current user:', err)
    return null
  }
}

/**
 * Get the current authenticated user
 * @returns {Promise<object|null>} User object or null if not authenticated
 */
export async function getCurrentUser() {
  if (!isSupabaseConfigured() || !supabase) {
    return null
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user || null
  } catch (err) {
    console.error('Error getting current user:', err)
    return null
  }
}

/**
 * Check if a user is authenticated
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
  const user = await getCurrentUser()
  return !!user
}

/**
 * Get current user's session
 * @returns {Promise<object|null>} Session object or null
 */
export async function getSession() {
  if (!isSupabaseConfigured() || !supabase) {
    return null
  }

  try {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  } catch (err) {
    console.error('Error getting session:', err)
    return null
  }
}

/**
 * Check if the current user owns a resource
 * @param {string} ownerId - The owner ID to check against
 * @returns {Promise<boolean>}
 */
export async function isCurrentUserOwner(ownerId) {
  if (!ownerId) return false

  const currentUserId = await getCurrentUserId()
  if (!currentUserId) return false

  return currentUserId === ownerId
}
