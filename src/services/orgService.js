/**
 * Organization Service
 * Handles organization + org_members CRUD via Supabase.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

const NOT_CONFIGURED = { data: null, error: { message: 'Supabase not configured' } }
const NOT_AUTH = { data: null, error: { message: 'Not authenticated' } }

// Slugs we reserve to keep URL paths unambiguous (matches our React routes).
const RESERVED_SLUGS = new Set([
  'create', 'edit', 'new', 'admin', 'dashboard', 'api', 'auth',
  'login', 'logout', 'signin', 'signup', 'onboarding',
  'profile', 'profiles', 'discover', 'events', 'event',
  'matches', 'messages', 'chat', 'settings', 'help', 'about',
  'terms', 'privacy', 'org', 'orgs', 'organization', 'organizations',
  'me', 'home', 'index', 'public', 'static', 'assets'
])

const SLUG_FORMAT = /^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])$/

export function slugify(raw) {
  if (!raw) return ''
  return raw
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32)
}

export function validateSlug(slug) {
  if (!slug) return 'Slug is required'
  if (slug.length < 3) return 'Slug must be at least 3 characters'
  if (slug.length > 32) return 'Slug must be at most 32 characters'
  if (!SLUG_FORMAT.test(slug)) return 'Use lowercase letters, numbers, and hyphens only (must start and end with a letter or number)'
  if (RESERVED_SLUGS.has(slug)) return 'That slug is reserved — please choose another'
  return null
}

export const orgService = {
  /**
   * Get an organization by slug.
   */
  async getBySlug(slug) {
    if (!isSupabaseConfigured() || !supabase) return NOT_CONFIGURED
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
    return { data, error }
  },

  /**
   * Get an organization by UUID.
   */
  async getById(orgId) {
    if (!isSupabaseConfigured() || !supabase) return NOT_CONFIGURED
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle()
    return { data, error }
  },

  /**
   * Check whether a slug is free (and not reserved).
   */
  async isSlugAvailable(slug) {
    const formatError = validateSlug(slug)
    if (formatError) return { available: false, reason: formatError }
    if (!isSupabaseConfigured() || !supabase) {
      return { available: false, reason: 'Supabase not configured' }
    }
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()
    if (error) return { available: false, reason: error.message }
    return { available: !data, reason: data ? 'That slug is already taken' : null }
  },

  /**
   * Create an organization and add the current user as its owner.
   * Returns the new org row.
   */
  async createOrg(input) {
    if (!isSupabaseConfigured() || !supabase) return NOT_CONFIGURED
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NOT_AUTH

    const formatError = validateSlug(input.slug)
    if (formatError) return { data: null, error: { message: formatError } }

    const payload = {
      slug: input.slug,
      name: input.name,
      type: input.type,
      university_id: input.university_id ?? null,
      logo: input.logo ?? null,
      banner: input.banner ?? null,
      bio: input.bio ?? null,
      website: input.website ?? null,
      instagram: input.instagram ?? null,
      location: input.location ?? null
    }

    const { data: org, error: insertError } = await supabase
      .from('organizations')
      .insert(payload)
      .select()
      .single()

    if (insertError) return { data: null, error: insertError }

    const { error: memberError } = await supabase
      .from('org_members')
      .insert({ org_id: org.id, user_id: user.id, role: 'owner' })

    if (memberError) {
      // Roll back the org we just created — leaves no orphans.
      await supabase.from('organizations').delete().eq('id', org.id)
      return { data: null, error: memberError }
    }

    return { data: org, error: null }
  },

  /**
   * Update org settings. RLS restricts to members.
   */
  async updateOrg(orgId, updates) {
    if (!isSupabaseConfigured() || !supabase) return NOT_CONFIGURED
    if (updates.slug) {
      const formatError = validateSlug(updates.slug)
      if (formatError) return { data: null, error: { message: formatError } }
    }
    const { data, error } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', orgId)
      .select()
      .single()
    return { data, error }
  },

  /**
   * List members of an organization, joined with their profile.
   */
  async listMembers(orgId) {
    if (!isSupabaseConfigured() || !supabase) return NOT_CONFIGURED
    const { data, error } = await supabase
      .from('org_members')
      .select('role, created_at, profile:profiles(id, first_name, last_name, avatar)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })
    return { data, error }
  },

  /**
   * Add a member (admin) to an org. RLS restricts to owners.
   */
  async addMember(orgId, profileId, role = 'admin') {
    if (!isSupabaseConfigured() || !supabase) return NOT_CONFIGURED
    const { data, error } = await supabase
      .from('org_members')
      .insert({ org_id: orgId, user_id: profileId, role })
      .select()
      .single()
    return { data, error }
  },

  /**
   * Remove a member. RLS allows self-leave or owner-removes.
   */
  async removeMember(orgId, profileId) {
    if (!isSupabaseConfigured() || !supabase) return { error: NOT_CONFIGURED.error }
    const { error } = await supabase
      .from('org_members')
      .delete()
      .eq('org_id', orgId)
      .eq('user_id', profileId)
    return { error }
  },

  /**
   * Promote/demote a member. RLS restricts to owners.
   */
  async updateMemberRole(orgId, profileId, role) {
    if (!isSupabaseConfigured() || !supabase) return NOT_CONFIGURED
    const { data, error } = await supabase
      .from('org_members')
      .update({ role })
      .eq('org_id', orgId)
      .eq('user_id', profileId)
      .select()
      .single()
    return { data, error }
  },

  /**
   * Orgs the current user is a member of, with their role.
   */
  async getMyOrgs() {
    if (!isSupabaseConfigured() || !supabase) return { data: [], error: null }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: null }

    const { data, error } = await supabase
      .from('org_members')
      .select('role, organization:organizations(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (error) return { data: [], error }
    const orgs = (data || [])
      .map(row => row.organization ? { ...row.organization, member_role: row.role } : null)
      .filter(Boolean)
    return { data: orgs, error: null }
  },

  /**
   * Is the current user a member of this org?
   */
  async isMember(orgId) {
    if (!isSupabaseConfigured() || !supabase) return false
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle()
    return !!data
  },

  /**
   * Is the current user the owner of this org?
   */
  async isOwner(orgId) {
    if (!isSupabaseConfigured() || !supabase) return false
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase
      .from('org_members')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .maybeSingle()
    return data?.role === 'owner'
  },

  /**
   * Seeded list of universities for the onboarding "affiliated university" dropdown.
   */
  async listUniversities() {
    if (!isSupabaseConfigured() || !supabase) return { data: [], error: null }
    const { data, error } = await supabase
      .from('organizations')
      .select('id, slug, name, location')
      .eq('type', 'university')
      .order('name', { ascending: true })
    return { data: data || [], error }
  },

  /**
   * All events posted by this org, ordered by date.
   */
  async getOrgEvents(orgId, { includePast = true } = {}) {
    if (!isSupabaseConfigured() || !supabase) return { data: [], error: null }
    let query = supabase
      .from('events')
      .select('*')
      .eq('organization_id', orgId)
      .order('date', { ascending: true })
    if (!includePast) query = query.eq('is_past', false)
    const { data, error } = await query
    return { data: data || [], error }
  }
}

export default orgService
