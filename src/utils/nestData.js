/**
 * Nest Data Store
 * Supabase-backed, with localStorage cache for user-created nests (offline support).
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { nestService } from '../services/nestService'
import { getInitialsAvatar } from './avatarUtils'

const NESTS_STORAGE_KEY = 'nested_user_nests'

/**
 * Get user-created nests from localStorage
 */
export function getUserNests() {
  try {
    const stored = localStorage.getItem(NESTS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Save a new nest to localStorage
 */
export async function saveNest(nest) {
  const nests = getUserNests()
  const ownerId = await getCurrentUserId()
  const newNest = {
    ...nest,
    id: `user-nest-${Date.now()}`,
    ownerId,
    isOwner: true,
    members: 1,
    memberAvatars: [],
    createdAt: new Date().toISOString()
  }
  nests.unshift(newNest)
  localStorage.setItem(NESTS_STORAGE_KEY, JSON.stringify(nests))
  return newNest
}

/**
 * Transform user-created nest to standard format
 */
function transformUserNest(nest) {
  return {
    ...nest,
    isUserNest: true,
    isOwner: true
  }
}

/**
 * Get all nests (user-created localStorage cache only — sync fallback)
 */
export function getAllNests() {
  return getUserNests().map(transformUserNest)
}

/**
 * Get nest by ID (sync fallback)
 */
export function getNestById(nestId) {
  if (!nestId) return null
  const userNest = getUserNests().find(n => n.id === nestId)
  if (userNest) return transformUserNest(userNest)
  return null
}

/**
 * Get discoverable nests (sync fallback)
 */
export function getDiscoverNests() {
  return getUserNests().map(transformUserNest)
}

// ============================================
// ASYNC SUPABASE-AWARE FUNCTIONS
// ============================================

/**
 * Get current user ID from Supabase
 */
async function getCurrentUserId() {
  if (!isSupabaseConfigured() || !supabase) {
    return null
  }
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

/**
 * Transform a Supabase nest to the standard component format
 */
function transformSupabaseNest(n, isOwner = false, isMember = false) {
  return {
    id: n.id,
    name: n.name,
    description: n.description,
    image: n.image || getInitialsAvatar(n.name, 200),
    tags: n.tags || [],
    members: n.member_count || 1,
    ownerId: n.owner_id,
    isOwner: isOwner,
    isMember: isMember,
    isSupabaseNest: true,
    createdAt: n.created_at,
    memberAvatars: []
  }
}

/**
 * Async: Get all nests for Discover
 */
export async function getDiscoverNestsAsync() {
  const localNests = getDiscoverNests()

  if (!isSupabaseConfigured()) {
    return localNests
  }

  try {
    const { data: dbNests, error } = await nestService.getAllNests()

    if (error || !dbNests) {
      console.warn('Could not fetch nests from Supabase, using localStorage:', error?.message)
      return localNests
    }

    const currentUserId = await getCurrentUserId()

    let joinedNestIds = new Set()
    if (currentUserId) {
      const { data: joined } = await nestService.getJoinedNests()
      if (joined) {
        joinedNestIds = new Set(joined.map(n => n.id))
      }
    }

    const transformedDbNests = dbNests.map(n =>
      transformSupabaseNest(
        n,
        n.owner_id === currentUserId,
        joinedNestIds.has(n.id)
      )
    )

    const dbIds = new Set(dbNests.map(n => n.id))
    const localOnly = localNests.filter(n => !dbIds.has(n.id))

    return [...transformedDbNests, ...localOnly]
  } catch (err) {
    console.error('Error fetching nests:', err)
    return localNests
  }
}

/**
 * Async: Get a single nest by ID
 */
export async function getNestByIdAsync(nestId) {
  if (!nestId) return null

  const localNest = getNestById(nestId)

  if (!isSupabaseConfigured()) {
    return localNest
  }

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nestId)

  if (isUUID) {
    try {
      const { data, error } = await nestService.getNest(nestId)

      if (!error && data) {
        const currentUserId = await getCurrentUserId()
        const isMember = currentUserId ? await nestService.isMember(nestId) : false
        return transformSupabaseNest(data, data.owner_id === currentUserId, isMember)
      }
    } catch (err) {
      console.error('Error fetching nest:', err)
    }
  }

  return localNest
}

/**
 * Async: Create a new nest
 */
export async function createNestAsync(nestData) {
  if (!isSupabaseConfigured()) {
    return { data: await saveNest(nestData), error: null }
  }

  try {
    const { data, error } = await nestService.createNest({
      name: nestData.name,
      description: nestData.description,
      image: nestData.image,
      tags: nestData.tags || []
    })

    if (error) {
      console.error('Error creating nest in Supabase:', error)
      return { data: await saveNest(nestData), error: null }
    }

    return { data: transformSupabaseNest(data, true, true), error: null }
  } catch (err) {
    console.error('Error creating nest:', err)
    return { data: await saveNest(nestData), error: null }
  }
}

/**
 * Async: Join a nest
 */
export async function joinNestAsync(nestId) {
  if (!isSupabaseConfigured()) {
    return { error: { message: 'Supabase not configured' } }
  }

  try {
    const { data, error } = await nestService.joinNest(nestId)
    return { data, error }
  } catch (err) {
    console.error('Error joining nest:', err)
    return { error: err }
  }
}

/**
 * Async: Leave a nest
 */
export async function leaveNestAsync(nestId) {
  if (!isSupabaseConfigured()) {
    return { error: { message: 'Supabase not configured' } }
  }

  try {
    const { error } = await nestService.leaveNest(nestId)
    return { error }
  } catch (err) {
    console.error('Error leaving nest:', err)
    return { error: err }
  }
}
