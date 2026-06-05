/**
 * Project Service
 * Handles all project-related database operations via Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * Backfill team-member public profiles the embed couldn't return.
 *
 * Discover/detail embed `team_members(*, profiles(...))`, but `profiles` is
 * authenticated-only at the RLS layer (002_rls_policies.sql) — so for a
 * logged-out (anon) viewer the embed comes back `profiles: null` and avatars
 * fall back to initials. This hydrates those null rows from the
 * column-restricted `public_profiles` view (readable by anon) in ONE batched
 * query, attaching the result as `m.profiles` — the exact shape projectAdapter's
 * liveName()/memberPhoto() already consume.
 *
 * For authenticated viewers the embed already filled every member, so `missing`
 * is empty and this short-circuits with no extra query — the auth path is
 * unchanged. Mutates the passed rows in place. Best-effort: a failed backfill
 * just leaves initials, never throws into the fetch path.
 *
 * Selects `avatar` only — the live public_profiles view doesn't expose `photos`.
 * avatar is kept in sync with photos[1] by a DB trigger, and the adapter reads
 * photos[0] -> avatar -> image, so avatar alone restores the facepile.
 *
 * @param {Array<object>} projects - project rows, each with team_members[]
 */
async function hydratePublicProfiles(projects) {
  if (!isSupabaseConfigured() || !supabase || !Array.isArray(projects)) return

  const missing = new Set()
  for (const p of projects) {
    for (const m of (p?.team_members || [])) {
      if (m.user_id && !m.profiles) missing.add(m.user_id)
    }
  }
  if (missing.size === 0) return // auth path: embed already filled — no-op

  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, first_name, last_name, username, avatar')
    .in('id', [...missing])
  if (error || !data) return // best-effort — keep initials rather than break the feed

  const byId = new Map(data.map(pr => [pr.id, pr]))
  for (const p of projects) {
    for (const m of (p?.team_members || [])) {
      if (m.user_id && !m.profiles && byId.has(m.user_id)) m.profiles = byId.get(m.user_id)
    }
  }
}

export const projectService = {
  /**
   * Get all published projects for the Discover feed
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getDiscoverProjects() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*, team_members(*, profiles(avatar, photos, first_name, last_name, username))')
      .eq('publish_to_discover', true)
      .order('created_at', { ascending: false })

    // Filter to only include approved team members
    if (data) {
      data.forEach(project => {
        if (project.team_members) {
          project.team_members = project.team_members.filter(m => m.status === 'approved')
        }
      })
      // Guests can't read the embedded `profiles` (auth-only RLS) → it returns
      // null and avatars fall back to initials. Backfill from public_profiles.
      await hydratePublicProfiles(data)
    }

    return { data, error }
  },

  /**
   * Get a single project by ID
   * @param {string} projectId - The project UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getProject(projectId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*, team_members(*, profiles(avatar, photos, first_name, last_name, username))')
      .eq('id', projectId)
      .single()

    // Filter to only include approved team members
    if (data?.team_members) {
      data.team_members = data.team_members.filter(m => m.status === 'approved')
    }
    // Guests get profiles:null from the embed (auth-only RLS) — backfill avatars
    // from public_profiles so the lead/crew facepile isn't all initials.
    if (data) await hydratePublicProfiles([data])

    return { data, error }
  },

  /**
   * Get all projects owned by the current user
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getMyProjects() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: null }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: null }
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*, team_members(*, profiles(avatar, photos, first_name, last_name, username))')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    // Filter to only include approved team members
    if (data) {
      data.forEach(project => {
        if (project.team_members) {
          project.team_members = project.team_members.filter(m => m.status === 'approved')
        }
      })
    }

    return { data: data || [], error }
  },

  /**
   * Create a new project
   * @param {object} project - Project data
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async createProject(project) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        ...project,
        owner_id: user.id
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update an existing project
   * @param {string} projectId - The project UUID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async updateProject(projectId, updates) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Delete a project
   * @param {string} projectId - The project UUID
   * @returns {Promise<{error: object|null}>}
   */
  async deleteProject(projectId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: { message: 'Supabase not configured' } }
    }

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    return { error }
  },

  /**
   * Add a team member to a project
   * @param {string} projectId - The project UUID
   * @param {object} member - Team member data
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async addTeamMember(projectId, member) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert({
        project_id: projectId,
        ...member
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Remove a team member from a project
   * @param {string} memberId - The team member UUID
   * @returns {Promise<{error: object|null}>}
   */
  async removeTeamMember(memberId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: { message: 'Supabase not configured' } }
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)

    return { error }
  },

  /**
   * Update a team member
   * @param {string} memberId - The team member UUID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async updateTeamMember(memberId, updates) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('team_members')
      .update(updates)
      .eq('id', memberId)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Get projects by category
   * @param {string} category - The project category
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getProjectsByCategory(category) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*, team_members(*, profiles(avatar, photos, first_name, last_name, username))')
      .eq('category', category)
      .eq('publish_to_discover', true)
      .order('created_at', { ascending: false })

    // Filter to only include approved team members
    if (data) {
      data.forEach(project => {
        if (project.team_members) {
          project.team_members = project.team_members.filter(m => m.status === 'approved')
        }
      })
    }

    return { data, error }
  },

  /**
   * Search projects by name or description
   * @param {string} query - Search query
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async searchProjects(query) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*, team_members(*, profiles(avatar, photos, first_name, last_name, username))')
      .eq('publish_to_discover', true)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%,tagline.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    // Filter to only include approved team members
    if (data) {
      data.forEach(project => {
        if (project.team_members) {
          project.team_members = project.team_members.filter(m => m.status === 'approved')
        }
      })
    }

    return { data, error }
  },

  /**
   * Join a project (add current user as team member)
   * @param {string} projectId - The project UUID
   * @param {string} role - Optional role the user wants to fill
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async joinProject(projectId, role = null, message = null) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
    if (!isUuid) {
      return { data: null, error: { message: 'Invalid project ID.' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    // Get user's profile info
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name, avatar, university')
      .eq('id', user.id)
      .single()

    const memberName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Team Member'
      : 'Team Member'

    // Check if already a team member
    const { data: existing } = await supabase
      .from('team_members')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      // A declined request is final — don't silently re-create it.
      if (existing.status === 'rejected') {
        return { data: null, error: { message: 'Your request to join was declined.' } }
      }
      return { data: existing, error: null } // already pending or approved
    }

    // Add as team member with 'pending' status (requires owner approval)
    const insertData = {
      project_id: projectId,
      user_id: user.id,
      name: memberName,
      school: profile?.university || null,
      role: role,
      image: profile?.avatar || null,
      status: 'pending'
    }
    if (message) insertData.message = message

    const { data, error } = await supabase
      .from('team_members')
      .insert(insertData)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Leave a project (remove current user from team)
   * @param {string} projectId - The project UUID
   * @returns {Promise<{error: object|null}>}
   */
  async leaveProject(projectId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: { message: 'Not authenticated' } }
    }

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', user.id)

    return { error }
  },

  /**
   * Check if current user has joined a project (pending or approved)
   * @param {string} projectId - The project UUID
   * @returns {Promise<{joined: boolean, status: string|null}>}
   */
  async hasJoinedProject(projectId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { joined: false, status: null }
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)
    if (!isUuid) return { joined: false, status: null }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { joined: false, status: null }
    }

    const { data } = await supabase
      .from('team_members')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    return { joined: !!data, status: data?.status || null }
  },

  /**
   * Get pending join requests for a project (owner only)
   * @param {string} projectId - The project UUID
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getPendingRequests(projectId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: null }
    }

    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .order('joined_at', { ascending: false })

    return { data: data || [], error }
  },

  /**
   * Approve a join request (update status to approved)
   * @param {string} memberId - The team member UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async approveRequest(memberId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('team_members')
      .update({ status: 'approved' })
      .eq('id', memberId)
      .select()
      .single()

    // Decrement spots_left on the project
    if (data && !error) {
      const { data: project } = await supabase
        .from('projects')
        .select('spots_left')
        .eq('id', data.project_id)
        .single()

      if (project) {
        await supabase
          .from('projects')
          .update({ spots_left: Math.max((project.spots_left || 0) - 1, 0) })
          .eq('id', data.project_id)
      }
    }

    return { data, error }
  },

  /**
   * Reject a join request (delete the team member row)
   * @param {string} memberId - The team member UUID
   * @returns {Promise<{error: object|null}>}
   */
  async rejectRequest(memberId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: { message: 'Supabase not configured' } }
    }

    // Soft-decline: keep the row as 'rejected' (don't delete) so the requester
    // can see they were declined. Owner-side lists filter status='pending', so it
    // disappears from the owner's inbox; crew/facepile filter 'approved', so it
    // never shows as a member.
    const { error } = await supabase
      .from('team_members')
      .update({ status: 'rejected' })
      .eq('id', memberId)

    return { error }
  },

  /**
   * Pending join requests across ALL projects the current user owns — the
   * owner-side inbox that powers the Notifications page. Each row carries its
   * project ({id, title}) for context. (getPendingRequests above is per-project.)
   * @returns {Promise<{data: array, error: object|null}>}
   */
  async getMyPendingRequests() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: null }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: null }
    }
    // Two-step (no embedded filter — PostgREST's `projects!inner` + a filter on the
    // embedded column proved unreliable): fetch my owned projects, then their
    // pending requests. Same RLS path as getPendingRequests(projectId).
    const { data: owned, error: ownErr } = await supabase
      .from('projects')
      .select('id, name')
      .eq('owner_id', user.id)
    if (ownErr) return { data: [], error: ownErr }
    if (!owned || !owned.length) return { data: [], error: null }

    // projects' display column is `name` (mapped to UI `title` by projectAdapter);
    // there is no projects.title column. Keep the output key `title` — that's the
    // shape the Notifications UI reads as req.project.title.
    const titleById = {}
    owned.forEach((p) => { titleById[p.id] = p.name })

    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .in('project_id', owned.map((p) => p.id))
      .eq('status', 'pending')
      .order('joined_at', { ascending: false })
    if (error) return { data: [], error }

    // Attach the project context the Notifications UI reads as req.project.
    const rows = (data || []).map((m) => ({
      ...m,
      project: { id: m.project_id, title: titleById[m.project_id] || '' },
    }))
    return { data: rows, error: null }
  },

  /**
   * Get projects the current user has joined (as approved team member, not owner)
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getJoinedProjects() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: null }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: null }
    }

    // Get approved team memberships where user_id matches
    const { data: memberships, error: memberError } = await supabase
      .from('team_members')
      .select('project_id')
      .eq('user_id', user.id)
      .eq('status', 'approved')

    if (memberError || !memberships?.length) {
      return { data: [], error: memberError }
    }

    const projectIds = memberships.map(m => m.project_id)

    // Get those projects (excluding ones user owns)
    const { data, error } = await supabase
      .from('projects')
      .select('*, team_members(*, profiles(avatar, photos, first_name, last_name, username))')
      .in('id', projectIds)
      .neq('owner_id', user.id)
      .order('created_at', { ascending: false })

    // Filter to only include approved team members
    if (data) {
      data.forEach(project => {
        if (project.team_members) {
          project.team_members = project.team_members.filter(m => m.status === 'approved')
        }
      })
    }

    return { data: data || [], error }
  },

  /**
   * Get projects the current user has REQUESTED to join but isn't approved for
   * yet (their team_members row is still 'pending'). Mirrors getJoinedProjects,
   * which returns only 'approved' memberships — together they let the UI tell
   * "Request sent" (pending) apart from "You're in" (approved).
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getRequestedProjects() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: null }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: null }
    }

    // Pending team memberships where user_id matches
    const { data: memberships, error: memberError } = await supabase
      .from('team_members')
      .select('project_id')
      .eq('user_id', user.id)
      .eq('status', 'pending')

    if (memberError || !memberships?.length) {
      return { data: [], error: memberError }
    }

    const projectIds = memberships.map(m => m.project_id)

    // Get those projects (excluding ones user owns — you can't request your own)
    const { data, error } = await supabase
      .from('projects')
      .select('*, team_members(*, profiles(avatar, photos, first_name, last_name, username))')
      .in('id', projectIds)
      .neq('owner_id', user.id)
      .order('created_at', { ascending: false })

    // Only approved members belong on the public flyer's crew/facepile.
    if (data) {
      data.forEach(project => {
        if (project.team_members) {
          project.team_members = project.team_members.filter(m => m.status === 'approved')
        }
      })
    }

    return { data: data || [], error }
  },

  /**
   * Projects the current user was DECLINED from (their team_members row is
   * 'rejected'). Powers the requester-side "Declined" rows in Matches. Only the
   * ids are needed by the caller, so this stays light (no project join).
   * @returns {Promise<{data: array, error: object|null}>}
   */
  async getRejectedProjects() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: null }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: null }
    }
    const { data, error } = await supabase
      .from('team_members')
      .select('project_id')
      .eq('user_id', user.id)
      .eq('status', 'rejected')
    if (error) return { data: [], error }
    return { data: (data || []).map((m) => ({ id: m.project_id })), error: null }
  },

  // ============================================
  // SAVED PROJECTS (bookmarks)
  // ============================================

  /**
   * Save (bookmark) a project for the current user
   * @param {string} projectId - The project UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async saveProject(projectId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    const { data, error } = await supabase
      .from('saved_projects')
      .insert({ user_id: user.id, project_id: projectId })
      .select()
      .single()

    // Treat duplicate as success (already saved)
    if (error && error.code === '23505') {
      return { data: null, error: null }
    }

    return { data, error }
  },

  /**
   * Unsave (remove bookmark) a project for the current user
   * @param {string} projectId - The project UUID
   * @returns {Promise<{error: object|null}>}
   */
  async unsaveProject(projectId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: { message: 'Not authenticated' } }
    }

    const { error } = await supabase
      .from('saved_projects')
      .delete()
      .eq('user_id', user.id)
      .eq('project_id', projectId)

    return { error }
  },

  /**
   * Check whether the current user has saved a project
   * @param {string} projectId - The project UUID
   * @returns {Promise<{saved: boolean, error: object|null}>}
   */
  async isProjectSaved(projectId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { saved: false, error: null }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { saved: false, error: null }
    }

    const { data, error } = await supabase
      .from('saved_projects')
      .select('id')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .maybeSingle()

    return { saved: !!data, error }
  },

  /**
   * Get all projects the current user has saved
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getSavedProjects() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: null }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: null }
    }

    const { data, error } = await supabase
      .from('saved_projects')
      .select('created_at, project:projects(*, team_members(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return { data: [], error }
    }

    // Flatten to project rows; drop entries where the project was deleted
    const projects = (data || [])
      .map(row => row.project)
      .filter(Boolean)

    // Filter to only include approved team members
    projects.forEach(p => {
      if (p.team_members) {
        p.team_members = p.team_members.filter(m => m.status === 'approved')
      }
    })

    return { data: projects, error: null }
  }
}

export default projectService
