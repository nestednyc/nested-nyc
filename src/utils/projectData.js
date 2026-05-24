/**
 * Project Data Store
 * Supabase-backed, with localStorage cache for user-created projects (offline support).
 */

import { getProjects, updateProject } from './projectStorage'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { projectService } from '../services/projectService'
import { getInitialsAvatar } from './avatarUtils'

// Role display mapping
const ROLE_LABELS = {
  'frontend': 'Frontend Dev',
  'backend': 'Backend Dev',
  'fullstack': 'Full Stack',
  'designer': 'UI/UX Designer',
  'data': 'Data Science',
  'ml': 'ML/AI',
  'mobile': 'Mobile Dev',
  'pm': 'Product Manager',
  'marketing': 'Marketing',
  'business': 'Business/Strategy',
}

// Category display mapping
const CATEGORY_LABELS = {
  'startup': 'Startup',
  'class-project': 'Class Project',
  'side-project': 'Side Project',
  'research': 'Research',
}


/**
 * Transform user-created (localStorage) project to standard format
 */
function transformUserProject(p) {
  const authorName = p.author || 'You'
  return {
    id: `user-${p.id}`,
    title: p.name,
    category: CATEGORY_LABELS[p.category] || p.category,
    schools: p.university ? [p.university] : ['NYC'],
    school: p.university || 'NYC',
    university: p.university || 'NYC',
    image: p.image,
    author: authorName,
    authorImage: p.authorImage || getInitialsAvatar(authorName),
    description: p.description,
    skillsNeeded: p.roles?.map(r => ROLE_LABELS[r] || r).slice(0, 6) || p.skills || [],
    spotsLeft: p.spotsLeft ?? p.roles?.length ?? 0,
    commitment: p.commitment || 'side-project',
    team: [{
      name: authorName,
      school: p.university || 'NYC',
      role: 'Project Lead',
      image: p.authorImage || getInitialsAvatar(authorName)
    }],
    isUserProject: true,
    isOwner: true,
    tagline: p.tagline,
    joined: true,
  }
}

/**
 * Get all projects (user-created localStorage cache only — sync fallback)
 */
export function getAllProjects() {
  return getProjects().map(transformUserProject)
}

/**
 * Get project by ID (sync fallback — localStorage only)
 */
export function getProjectById(projectId) {
  if (!projectId) return null

  const userProjects = getProjects()
  const userProject = userProjects.find(p => `user-${p.id}` === projectId || String(p.id) === projectId)
  if (userProject) {
    return transformUserProject(userProject)
  }

  return null
}

/**
 * Get projects for Discover feed (sync fallback)
 */
export function getDiscoverProjects() {
  return getProjects()
    .filter(p => p.publishToDiscover)
    .map(transformUserProject)
}

/**
 * Get projects for My Projects page (sync fallback)
 */
export function getMyProjects() {
  return getProjects().map(transformUserProject)
}

/**
 * Get saved/bookmarked projects (sync fallback — always empty,
 * since saves only exist in Supabase). Use getSavedProjectsAsync for real data.
 */
export function getSavedProjects() {
  return []
}

// ============================================
// ASYNC SUPABASE-AWARE FUNCTIONS
// ============================================

/**
 * Transform a Supabase project to the standard component format
 */
function transformSupabaseProject(p, isOwner = false) {
  const authorName = p.author_name || 'Unknown'
  return {
    id: p.id,
    title: p.name,
    category: CATEGORY_LABELS[p.category] || p.category,
    schools: p.university ? [p.university] : ['NYC'],
    school: p.university || 'NYC',
    image: p.image,
    author: authorName,
    authorImage: p.author_image || getInitialsAvatar(authorName),
    description: p.description,
    tagline: p.tagline,
    skillsNeeded: p.roles?.map(r => ROLE_LABELS[r] || r).slice(0, 6) || p.skills || [],
    spotsLeft: p.spots_left || p.roles?.length || 0,
    team: p.team_members?.map(m => ({
      id: m.user_id,
      name: m.name,
      school: m.school,
      role: m.role,
      image: m.image || getInitialsAvatar(m.name)
    })) || [],
    isSupabaseProject: true,
    isOwner: isOwner,
    ownerId: p.owner_id,
    joined: isOwner,
    commitment: p.commitment,
    publishToDiscover: p.publish_to_discover,
    communicationLink: p.communication_link || null,
    createdAt: p.created_at
  }
}

/**
 * Get current user ID from Supabase
 */
export async function getCurrentUserId() {
  if (!isSupabaseConfigured() || !supabase) {
    return null
  }
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id || null
}

/**
 * Async: Get all projects for Discover feed
 */
export async function getDiscoverProjectsAsync() {
  const localProjects = getDiscoverProjects()

  if (!isSupabaseConfigured()) {
    return localProjects
  }

  try {
    const { data: dbProjects, error } = await projectService.getDiscoverProjects()

    if (error || !dbProjects) {
      console.warn('Could not fetch from Supabase, using localStorage:', error?.message)
      return localProjects
    }

    const currentUserId = await getCurrentUserId()

    const transformedDbProjects = dbProjects.map(p =>
      transformSupabaseProject(p, p.owner_id === currentUserId)
    )

    const dbIds = new Set(dbProjects.map(p => p.id))
    const localOnly = localProjects.filter(p => !dbIds.has(p.id))

    return [...transformedDbProjects, ...localOnly]
  } catch (err) {
    console.error('Error fetching projects:', err)
    return localProjects
  }
}

/**
 * Async: Get my projects
 */
export async function getMyProjectsAsync() {
  const localProjects = getMyProjects()

  if (!isSupabaseConfigured()) {
    return localProjects
  }

  try {
    const { data: dbProjects, error } = await projectService.getMyProjects()

    if (error || !dbProjects) {
      console.warn('Could not fetch from Supabase, using localStorage:', error?.message)
      return localProjects
    }

    const transformedDbProjects = dbProjects.map(p =>
      transformSupabaseProject(p, true)
    )

    return [...transformedDbProjects, ...localProjects.filter(p => p.isUserProject)]
  } catch (err) {
    console.error('Error fetching projects:', err)
    return localProjects
  }
}

/**
 * Async: Get a single project by ID
 */
export async function getProjectByIdAsync(projectId) {
  if (!projectId) return null

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)

  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await projectService.getProject(projectId)
      if (!error && data) {
        const currentUserId = await getCurrentUserId()
        return transformSupabaseProject(data, data.owner_id === currentUserId)
      }
      if (isUuid && import.meta.env.DEV) {
        console.warn('[getProjectByIdAsync] Supabase returned no project for UUID:', projectId, { error: error?.message, hasData: !!data })
      }
    } catch (err) {
      console.error('Error fetching project:', err)
    }
  } else if (isUuid && import.meta.env.DEV) {
    console.warn('[getProjectByIdAsync] Supabase not configured (check VITE_SUPABASE_* env). UUID projects require Supabase.', projectId)
  }

  return getProjectById(projectId)
}

/**
 * Async: Create a new project
 */
export async function createProjectAsync(projectData) {
  if (!isSupabaseConfigured()) {
    const { saveProject } = await import('./projectStorage')
    const project = {
      id: Date.now(),
      ...projectData,
      createdAt: new Date().toISOString()
    }
    saveProject(project)
    return { data: project, error: null }
  }

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, avatar, university')
      .eq('id', user.id)
      .single()

    const authorName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'You'
      : 'You'

    const dbProject = {
      name: projectData.name,
      tagline: projectData.tagline,
      description: projectData.description,
      category: projectData.category,
      image: projectData.image,
      university: profile?.university || projectData.university,
      author_name: authorName,
      author_image: profile?.avatar,
      roles: projectData.roles || [],
      skills: projectData.skills || [],
      commitment: projectData.commitment,
      publish_to_discover: projectData.publishToDiscover !== false,
      spots_left: projectData.roles?.length || 0,
      communication_link: projectData.communicationLink || null
    }

    const { data, error } = await projectService.createProject(dbProject)

    if (error) {
      console.error('Error creating project in Supabase:', error)
      const { saveProject } = await import('./projectStorage')
      const project = {
        id: Date.now(),
        ...projectData,
        createdAt: new Date().toISOString()
      }
      saveProject(project)
      return { data: project, error: null }
    }

    if (data?.id) {
      await projectService.addTeamMember(data.id, {
        user_id: user.id,
        name: authorName,
        school: profile?.university || null,
        role: 'Creator',
        image: profile?.avatar || null,
        status: 'approved'
      })
    }

    return { data: transformSupabaseProject(data, true), error: null }
  } catch (err) {
    console.error('Error creating project:', err)
    return { data: null, error: err }
  }
}

/**
 * Async: Update a project
 */
export async function updateProjectAsync(projectId, updates) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)

  if (isUUID && isSupabaseConfigured()) {
    try {
      const dbUpdates = {}
      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.tagline !== undefined) dbUpdates.tagline = updates.tagline
      if (updates.description !== undefined) dbUpdates.description = updates.description
      if (updates.category !== undefined) dbUpdates.category = updates.category
      if (updates.roles !== undefined) dbUpdates.roles = updates.roles
      if (updates.skills !== undefined) dbUpdates.skills = updates.skills
      if (updates.commitment !== undefined) dbUpdates.commitment = updates.commitment
      if (updates.publishToDiscover !== undefined) dbUpdates.publish_to_discover = updates.publishToDiscover
      if (updates.spotsLeft !== undefined) dbUpdates.spots_left = updates.spotsLeft

      const { data, error } = await projectService.updateProject(projectId, dbUpdates)

      if (error) {
        console.error('Error updating project in Supabase:', error)
        return { error }
      }

      return { data, error: null }
    } catch (err) {
      console.error('Error updating project:', err)
      return { error: err }
    }
  }

  // localStorage fallback for user-created projects
  const rawId = typeof projectId === 'string' && projectId.startsWith('user-')
    ? projectId.replace('user-', '')
    : projectId
  updateProject(parseInt(rawId) || rawId, updates)
  return { data: { id: projectId, ...updates }, error: null }
}

/**
 * Async: Delete a project
 */
export async function deleteProjectAsync(projectId) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)

  if (isUUID && isSupabaseConfigured()) {
    try {
      const { error } = await projectService.deleteProject(projectId)
      if (error) {
        console.error('Error deleting project in Supabase:', error)
        return { error }
      }
      return { error: null }
    } catch (err) {
      console.error('Error deleting project:', err)
      return { error: err }
    }
  }

  const { deleteProject } = await import('./projectStorage')
  deleteProject(projectId)
  return { error: null }
}

// ============================================
// SAVED PROJECTS (bookmarks)
// ============================================

/**
 * Async: Save (bookmark) a project for the current user
 */
export async function saveProjectAsync(projectId) {
  if (!isSupabaseConfigured()) {
    return { error: { message: 'Sign in to save projects' } }
  }
  return projectService.saveProject(projectId)
}

/**
 * Async: Unsave a project for the current user
 */
export async function unsaveProjectAsync(projectId) {
  if (!isSupabaseConfigured()) {
    return { error: null }
  }
  return projectService.unsaveProject(projectId)
}

/**
 * Async: Check whether the current user has saved a project
 */
export async function isProjectSavedAsync(projectId) {
  if (!isSupabaseConfigured()) {
    return false
  }
  const { saved } = await projectService.isProjectSaved(projectId)
  return saved
}

/**
 * Async: Get all saved projects for the current user
 */
export async function getSavedProjectsAsync() {
  if (!isSupabaseConfigured()) {
    return []
  }

  const { data, error } = await projectService.getSavedProjects()
  if (error) {
    console.error('Error fetching saved projects:', error)
    return []
  }

  const currentUserId = await getCurrentUserId()
  return (data || []).map(p =>
    transformSupabaseProject(p, p.owner_id === currentUserId)
  )
}
