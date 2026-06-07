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
   * Find an available slug derived from a base.
   * Tries `base`, then `base-2`, `base-3`, … up to 20. Skips any candidate
   * that fails validateSlug (e.g. lands on a reserved word).
   * Returns null if nothing fits — shouldn't happen in practice.
   */
  async _findAvailableSlug(baseSlug) {
    for (let i = 1; i <= 20; i++) {
      const candidate = i === 1 ? baseSlug : `${baseSlug}-${i}`
      if (validateSlug(candidate)) continue
      const { available } = await this.isSlugAvailable(candidate)
      if (available) return candidate
    }
    return null
  },

  /**
   * Create an organization owned by the current user.
   * One signup = one org = one entity (the org account IS the user from a
   * display standpoint), so there's no junction table — the auth user's id
   * goes straight onto organizations.owner_user_id and RLS enforces from there.
   *
   * The URL slug is auto-generated from the org name. Users never pick it —
   * it's an implementation detail of the URL, not a thing they should think
   * about. Collisions get suffixed (-2, -3, …).
   */
  async createOrg(input) {
    if (!isSupabaseConfigured() || !supabase) return NOT_CONFIGURED
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return NOT_AUTH

    const baseSlug = slugify(input.name) || `org-${Date.now()}`
    const slug = await this._findAvailableSlug(baseSlug)
    if (!slug) {
      return { data: null, error: { message: 'Could not generate a unique URL for that name. Try a different name.' } }
    }

    const payload = {
      slug,
      name: input.name,
      type: input.type,
      university_id: input.university_id ?? null,
      logo: input.logo ?? null,
      banner: input.banner ?? null,
      bio: input.bio ?? null,
      website: input.website ?? null,
      instagram: input.instagram ?? null,
      location: input.location ?? null,
      owner_user_id: user.id
    }

    const { data, error } = await supabase
      .from('organizations')
      .insert(payload)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update org settings. RLS restricts to the owner.
   */
  async updateOrg(orgId, updates) {
    if (!isSupabaseConfigured() || !supabase) return NOT_CONFIGURED
    if (updates.slug) {
      const formatError = validateSlug(updates.slug)
      if (formatError) return { data: null, error: { message: formatError } }
    }
    // verified + ownership are server-controlled (RLS + the org_lock_verified
    // trigger). Never send them from the client, even by accident.
    const { verified, owner_user_id, id, ...safe } = updates || {}
    const { data, error } = await supabase
      .from('organizations')
      .update(safe)
      .eq('id', orgId)
      .select()
      .single()
    return { data, error }
  },

  /**
   * Orgs the current user owns.
   */
  async getMyOrgs() {
    if (!isSupabaseConfigured() || !supabase) return { data: [], error: null }
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return { data: [], error: null }

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: true })

    return { data: data || [], error }
  },

  /**
   * Does the current user own this org? (No team/multi-admin concept — the
   * owner is the only one allowed to act on the org's behalf.)
   */
  async isOwner(orgId) {
    if (!isSupabaseConfigured() || !supabase) return false
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return false
    const { data } = await supabase
      .from('organizations')
      .select('owner_user_id')
      .eq('id', orgId)
      .maybeSingle()
    return data?.owner_user_id === user.id
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
