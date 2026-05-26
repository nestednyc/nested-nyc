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

/**
 * Resolve where the user should land after authenticating.
 *
 * - Org admin with an org → their org dashboard
 * - Org admin without an org yet → org onboarding
 * - Student who finished onboarding → /discover
 * - Student mid-onboarding → /discover (signup flow handles the rest)
 * - Fallback / no session → /auth
 *
 * Reads profile + memberships from Supabase rather than localStorage so it
 * works whether the user signed in here or came back from email confirmation.
 *
 * @returns {Promise<string>} The path to navigate to
 */
export async function resolvePostAuthRoute() {
  if (!isSupabaseConfigured() || !supabase) return '/auth'

  const user = await getCurrentUser()
  if (!user) return '/auth'

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('account_type, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.account_type === 'org_admin') {
      const { data: memberships } = await supabase
        .from('org_members')
        .select('organization:organizations(slug)')
        .eq('user_id', user.id)
        .limit(1)

      const slug = memberships?.[0]?.organization?.slug
      return slug ? `/orgs/${slug}/dashboard` : '/onboarding/org'
    }

    return '/discover'
  } catch (err) {
    console.error('resolvePostAuthRoute error:', err)
    return '/discover'
  }
}
