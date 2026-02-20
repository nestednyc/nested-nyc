/**
 * Nest Data Store
 * Centralized data for all nests - both default and user-created
 * Supports both localStorage (fallback) and Supabase (when configured)
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { nestService } from '../services/nestService'

// Demo current user ID (for MVP/demo purposes)
export const DEMO_CURRENT_USER_ID = 'demo-user-1'

// Local storage key for user-created nests
const NESTS_STORAGE_KEY = 'nested_user_nests'

// Default nests data (mock data)
export const DEFAULT_NESTS = [
  {
    id: 'nest-1',
    name: 'NYU Builders',
    description: 'Build cool stuff with NYU students. A community for hackers, makers, and builders who want to create meaningful projects together.',
    members: 248,
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&h=200&fit=crop',
    tags: ['Tech', 'Startups'],
    ownerId: 'demo-user-1', // Demo: This nest is owned by the current user
    memberAvatars: [
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    ]
  },
  {
    id: 'nest-2',
    name: 'Columbia AI',
    description: 'ML research & projects at Columbia. Dive deep into artificial intelligence, machine learning, and data science with fellow researchers and enthusiasts.',
    members: 156,
    image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=200&h=200&fit=crop',
    tags: ['AI', 'Research'],
    ownerId: 'other-user',
    memberAvatars: [
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    ]
  },
  {
    id: 'nest-3',
    name: 'NYC Design',
    description: 'Designers across NYC schools. Connect with UX/UI designers, product designers, and creative minds building beautiful digital experiences.',
    members: 312,
    image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=200&h=200&fit=crop',
    tags: ['Design', 'UI/UX'],
    ownerId: 'other-user',
    memberAvatars: [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop',
    ]
  },
  {
    id: 'nest-4',
    name: 'Startup Founders',
    description: 'Student entrepreneurs building companies. Share ideas, find co-founders, and learn from each other\'s journeys in the startup world.',
    members: 89,
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=200&h=200&fit=crop',
    tags: ['Business', 'Startups'],
    ownerId: 'other-user',
    memberAvatars: [
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    ]
  },
  {
    id: 'nest-5',
    name: 'Data Science NYC',
    description: 'Analytics & data projects. From Python to R, from visualization to modeling - connect with fellow data enthusiasts across NYC universities.',
    members: 124,
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=200&h=200&fit=crop',
    tags: ['Data', 'Python'],
    ownerId: 'other-user',
    memberAvatars: [
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    ]
  },
  {
    id: 'nest-6',
    name: 'Creative Coders',
    description: 'Art meets technology. Explore the intersection of code and creativity through generative art, creative coding, and interactive installations.',
    members: 67,
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200&h=200&fit=crop',
    tags: ['Creative', 'Code'],
    ownerId: 'other-user',
    memberAvatars: [
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop',
    ]
  },
]

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
export function saveNest(nest) {
  const nests = getUserNests()
  const newNest = {
    ...nest,
    id: `user-nest-${Date.now()}`,
    ownerId: DEMO_CURRENT_USER_ID,
    isOwner: true,
    members: 1,
    memberAvatars: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop'],
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
 * Get all nests (default + user-created)
 */
export function getAllNests() {
  const userNests = getUserNests().map(transformUserNest)
  return [...userNests, ...DEFAULT_NESTS]
}

/**
 * Get nest by ID
 */
export function getNestById(nestId) {
  if (!nestId) return null
  
  // Check user-created nests first
  const userNests = getUserNests()
  const userNest = userNests.find(n => n.id === nestId)
  if (userNest) {
    return transformUserNest(userNest)
  }
  
  // Check default nests
  const defaultNest = DEFAULT_NESTS.find(n => n.id === nestId)
  if (defaultNest) return defaultNest
  
  return null
}

/**
 * Get discoverable nests for Discover feed
 */
export function getDiscoverNests() {
  const userNests = getUserNests().map(transformUserNest)
  return [...userNests, ...DEFAULT_NESTS]
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
    image: n.image || 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&h=200&fit=crop',
    tags: n.tags || [],
    members: n.member_count || 1,
    ownerId: n.owner_id,
    isOwner: isOwner,
    isMember: isMember,
    isSupabaseNest: true,
    createdAt: n.created_at,
    memberAvatars: [] // Would need to fetch from nest_members with profiles
  }
}

/**
 * Async: Get all nests for Discover (Supabase + localStorage fallback)
 */
export async function getDiscoverNestsAsync() {
  // Always include localStorage/default nests as base
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

    // Get joined nests for current user
    let joinedNestIds = new Set()
    if (currentUserId) {
      const { data: joined } = await nestService.getJoinedNests()
      if (joined) {
        joinedNestIds = new Set(joined.map(n => n.id))
      }
    }

    // Transform Supabase nests
    const transformedDbNests = dbNests.map(n =>
      transformSupabaseNest(
        n,
        n.owner_id === currentUserId,
        joinedNestIds.has(n.id)
      )
    )

    // Merge: DB nests first, then local nests (avoiding duplicates)
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

  // First try localStorage/default
  const localNest = getNestById(nestId)

  if (!isSupabaseConfigured()) {
    return localNest
  }

  // Check if it looks like a Supabase UUID
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
    // Fall back to localStorage
    return { data: saveNest(nestData), error: null }
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
      // Fall back to localStorage
      return { data: saveNest(nestData), error: null }
    }

    return { data: transformSupabaseNest(data, true, true), error: null }
  } catch (err) {
    console.error('Error creating nest:', err)
    return { data: saveNest(nestData), error: null }
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
