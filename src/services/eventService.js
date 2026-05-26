/**
 * Event Service
 * Handles all event-related database operations via Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

export const eventService = {
  /**
   * Get all events
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getAllEvents() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('events')
      .select('*, organization:organizations(id, slug, name, logo, verified)')
      .order('date', { ascending: true })

    return { data, error }
  },

  /**
   * Get upcoming events (not past)
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getUpcomingEvents() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('events')
      .select('*, organization:organizations(id, slug, name, logo, verified)')
      .eq('is_past', false)
      .order('date', { ascending: true })

    return { data, error }
  },

  /**
   * Get past events
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getPastEvents() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('events')
      .select('*, organization:organizations(id, slug, name, logo, verified)')
      .eq('is_past', true)
      .order('date', { ascending: false })

    return { data, error }
  },

  /**
   * Get a single event by ID
   * @param {string} eventId - The event UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getEvent(eventId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('events')
      .select('*, organization:organizations(id, slug, name, logo, verified)')
      .eq('id', eventId)
      .single()

    return { data, error }
  },

  /**
   * Get event with registration info for current user
   * @param {string} eventId - The event UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getEventWithRegistration(eventId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, organization:organizations(id, slug, name, logo, verified)')
      .eq('id', eventId)
      .single()

    if (eventError) {
      return { data: null, error: eventError }
    }

    // Check if current user is registered
    const { data: { user } } = await supabase.auth.getUser()
    let isRegistered = false

    if (user) {
      const { data: registration } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .single()

      isRegistered = !!registration
    }

    return {
      data: {
        ...event,
        isRegistered
      },
      error: null
    }
  },

  /**
   * Create a new event
   * @param {object} event - Event data
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async createEvent(event) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        ...event,
        organizer_id: user.id
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Update an existing event
   * @param {string} eventId - The event UUID
   * @param {object} updates - Fields to update
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async updateEvent(eventId, updates) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single()

    return { data, error }
  },

  /**
   * Delete an event
   * @param {string} eventId - The event UUID
   * @returns {Promise<{error: object|null}>}
   */
  async deleteEvent(eventId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: { message: 'Supabase not configured' } }
    }

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)

    return { error }
  },

  /**
   * Register for an event (current user)
   * @param {string} eventId - The event UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async registerForEvent(eventId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: { message: 'Not authenticated' } }
    }

    // Check if already registered
    const { data: existing } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return { data: existing, error: null } // Already registered
    }

    // Check if event is at max capacity
    const { data: event } = await this.getEvent(eventId)
    if (event?.max_attendees && event.attendees >= event.max_attendees) {
      return { data: null, error: { message: 'Event is at full capacity' } }
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .insert({
        event_id: eventId,
        user_id: user.id
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Unregister from an event (current user)
   * @param {string} eventId - The event UUID
   * @returns {Promise<{error: object|null}>}
   */
  async unregisterFromEvent(eventId) {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: { message: 'Supabase not configured' } }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { error: { message: 'Not authenticated' } }
    }

    const { error } = await supabase
      .from('event_registrations')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id)

    return { error }
  },

  /**
   * Check if current user is registered for an event
   * @param {string} eventId - The event UUID
   * @returns {Promise<boolean>}
   */
  async isRegistered(eventId) {
    if (!isSupabaseConfigured() || !supabase) {
      return false
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return false
    }

    const { data } = await supabase
      .from('event_registrations')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single()

    return !!data
  },

  /**
   * Get events the current user is registered for
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getMyRegisteredEvents() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: null }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: null }
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .select('event_id, events(*, organization:organizations(id, slug, name, logo, verified))')
      .eq('user_id', user.id)

    if (error) {
      return { data: [], error }
    }

    // Extract the event objects
    const events = data?.map(item => item.events).filter(Boolean) || []
    return { data: events, error: null }
  },

  /**
   * Get events organized by the current user
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async getMyOrganizedEvents() {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: [], error: null }
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { data: [], error: null }
    }

    const { data, error } = await supabase
      .from('events')
      .select('*, organization:organizations(id, slug, name, logo, verified)')
      .eq('organizer_id', user.id)
      .order('date', { ascending: true })

    return { data: data || [], error }
  },

  /**
   * Fetch public attendee profiles for an event (name + avatar + university only).
   * Works for unauthenticated viewers via the public_profiles view.
   * @param {string} eventId
   * @param {number} limit
   */
  async getAttendees(eventId, limit = 24) {
    if (!isSupabaseConfigured() || !supabase) return { data: [], error: null }

    const { data: regs, error: regError } = await supabase
      .from('event_registrations')
      .select('user_id, registered_at')
      .eq('event_id', eventId)
      .order('registered_at', { ascending: true })
      .limit(limit)

    if (regError) return { data: [], error: regError }
    const userIds = (regs || []).map(r => r.user_id).filter(Boolean)
    if (userIds.length === 0) return { data: [], error: null }

    const { data: profiles, error: profileError } = await supabase
      .from('public_profiles')
      .select('id, first_name, last_name, avatar, university')
      .in('id', userIds)

    if (profileError) return { data: [], error: profileError }
    return { data: profiles || [], error: null }
  },

  /**
   * Search events by title or description
   * @param {string} query - Search query
   * @returns {Promise<{data: array|null, error: object|null}>}
   */
  async searchEvents(query) {
    if (!isSupabaseConfigured() || !supabase) {
      return { data: null, error: { message: 'Supabase not configured' } }
    }

    const { data, error } = await supabase
      .from('events')
      .select('*, organization:organizations(id, slug, name, logo, verified)')
      .or(`title.ilike.%${query}%,description.ilike.%${query}%,location.ilike.%${query}%`)
      .order('date', { ascending: true })

    return { data, error }
  }
}

export default eventService
