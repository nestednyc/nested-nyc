/**
 * Project Service
 * Handles all project-related database operations via Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

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
      .select('*, team_members(*)')
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
      .select('*, team_members(*)')
      .eq('id', projectId)
      .single()

    // Filter to only include approved team members
    if (data?.team_members) {
      data.team_members = data.team_members.filter(m => m.status === 'approved')
    }

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
      .select('*, team_members(*)')
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
      .select('*, team_members(*)')
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
      .select('*, team_members(*)')
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
      return { data: existing, error: null } // Already joined
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
      .select('id, status')
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
      .order('created_at', { ascending: false })

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

    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId)

    return { error }
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
      .select('*, team_members(*)')
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
  }
}

export default projectService
