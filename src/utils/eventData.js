/**
 * Event Data Store
 * Supabase-backed. Returns [] / null when no data exists.
 */

import { eventService } from '../services/eventService'

// Transform DB event to UI format
function transformEvent(dbEvent) {
  if (!dbEvent) return null
  return {
    id: dbEvent.id,
    title: dbEvent.title,
    description: dbEvent.description,
    date: dbEvent.date,
    time: dbEvent.time,
    location: dbEvent.location,
    address: dbEvent.address,
    attendees: dbEvent.attendees || 0,
    maxAttendees: dbEvent.max_attendees,
    image: dbEvent.image,
    tags: dbEvent.tags || [],
    highlights: dbEvent.highlights || [],
    organizer: {
      name: dbEvent.organizer_name || 'Organizer',
      image: dbEvent.organizer_image
    },
    isPast: dbEvent.is_past || false
  }
}

/**
 * Get upcoming events from Supabase
 * @returns {Promise<Array>}
 */
export async function getUpcomingEventsAsync() {
  try {
    const { data, error } = await eventService.getUpcomingEvents()
    if (error) {
      console.warn('Supabase events error:', error.message)
      return []
    }
    return (data || []).map(transformEvent)
  } catch (err) {
    console.warn('Events fetch failed:', err.message)
    return []
  }
}

/**
 * Get past events from Supabase
 * @returns {Promise<Array>}
 */
export async function getPastEventsAsync() {
  try {
    const { data, error } = await eventService.getPastEvents()
    if (error) {
      console.warn('Supabase events error:', error.message)
      return []
    }
    return (data || []).map(transformEvent)
  } catch (err) {
    console.warn('Events fetch failed:', err.message)
    return []
  }
}

/**
 * Get single event by ID from Supabase
 * @param {string} eventId
 * @returns {Promise<Object|null>}
 */
export async function getEventByIdAsync(eventId) {
  try {
    const { data, error } = await eventService.getEvent(eventId)
    if (error) {
      console.warn('Supabase event error:', error.message)
      return null
    }
    return transformEvent(data)
  } catch (err) {
    console.warn('Event fetch failed:', err.message)
    return null
  }
}
