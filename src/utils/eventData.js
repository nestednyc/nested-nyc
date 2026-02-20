/**
 * Event Data Store
 * Centralized data for all events
 * Supabase-first with localStorage/mock fallback
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

// All events data (mock fallback)
export const EVENTS = [
  {
    id: 'event-1',
    title: 'NYC Tech Meetup',
    description: 'Monthly gathering of NYC tech enthusiasts. Network with founders, engineers, and designers building the next generation of startups. This month features lightning talks from student founders and a fireside chat with a YC alumni.',
    date: 'Jan 15, 2026',
    time: '6:00 PM - 9:00 PM',
    location: 'WeWork SoHo',
    address: '154 Grand St, New York, NY 10013',
    attendees: 45,
    maxAttendees: 100,
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=500&fit=crop',
    tags: ['Networking', 'Tech'],
    organizer: {
      name: 'NYC Tech Community',
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&h=100&fit=crop'
    },
    highlights: [
      'Lightning talks from 5 student founders',
      'Networking with 100+ tech professionals',
      'Free food and drinks',
      'Exclusive access to demo area'
    ],
    isPast: false
  },
  {
    id: 'event-2',
    title: 'Design Systems Workshop',
    description: 'Learn how to build and maintain scalable design systems from industry experts. This hands-on workshop covers component libraries, design tokens, documentation, and collaboration between designers and developers.',
    date: 'Jan 18, 2026',
    time: '2:00 PM - 5:00 PM',
    location: 'Parsons School of Design',
    address: '66 5th Ave, New York, NY 10011',
    attendees: 28,
    maxAttendees: 40,
    image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=500&fit=crop',
    tags: ['Design', 'Workshop'],
    organizer: {
      name: 'Parsons Design Club',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
    },
    highlights: [
      'Hands-on Figma exercises',
      'Build a component library from scratch',
      'Q&A with design leads from top startups',
      'Certificate of completion'
    ],
    isPast: false
  },
  {
    id: 'event-3',
    title: 'Startup Pitch Night',
    description: 'Watch student startups pitch to VCs and angel investors. Q&A session included. This semester features 8 teams competing for $10,000 in prize money and potential follow-on investment opportunities.',
    date: 'Jan 22, 2026',
    time: '7:30 PM - 10:00 PM',
    location: 'NYU Stern',
    address: '44 W 4th St, New York, NY 10012',
    attendees: 62,
    maxAttendees: 150,
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&h=500&fit=crop',
    tags: ['Startups', 'Pitch'],
    organizer: {
      name: 'NYU Entrepreneurship Lab',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop'
    },
    highlights: [
      '8 student startups pitching',
      '$10,000 total prize pool',
      'VC judges from top firms',
      'Networking reception after'
    ],
    isPast: false
  },
  {
    id: 'event-4',
    title: 'AI/ML Study Group',
    description: 'Weekly study group for students interested in machine learning and AI research. This week we\'re covering transformer architectures and attention mechanisms with practical coding examples.',
    date: 'Jan 25, 2026',
    time: '4:00 PM - 6:00 PM',
    location: 'Columbia Engineering',
    address: '500 W 120th St, New York, NY 10027',
    attendees: 18,
    maxAttendees: 25,
    image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&h=500&fit=crop',
    tags: ['AI', 'Study Group'],
    organizer: {
      name: 'Columbia AI Society',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop'
    },
    highlights: [
      'Deep dive into transformers',
      'Hands-on coding session',
      'Paper discussion',
      'Snacks provided'
    ],
    isPast: false
  },
  {
    id: 'event-5',
    title: 'Hackathon Kickoff',
    description: '48-hour hackathon to build solutions for climate change. Prizes worth $10k. Teams of 2-4 will compete to create innovative solutions addressing environmental challenges in NYC.',
    date: 'Feb 1, 2026',
    time: '6:00 PM',
    location: 'NYU Tandon',
    address: '6 MetroTech Center, Brooklyn, NY 11201',
    attendees: 120,
    maxAttendees: 200,
    image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&h=500&fit=crop',
    tags: ['Hackathon', 'Climate'],
    organizer: {
      name: 'NYU Tandon Tech',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop'
    },
    highlights: [
      '48 hours of hacking',
      '$10,000 in prizes',
      'Mentorship from industry experts',
      'All meals provided'
    ],
    isPast: false
  },
  // Past events
  {
    id: 'event-101',
    title: 'Winter Demo Day',
    description: 'End of semester project showcase featuring 20 student teams presenting their work to industry professionals, investors, and faculty.',
    date: 'Dec 15, 2025',
    time: '5:00 PM - 8:00 PM',
    location: 'NYU Kimmel Center',
    address: '60 Washington Square S, New York, NY 10012',
    attendees: 85,
    maxAttendees: 100,
    image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&h=500&fit=crop',
    tags: ['Demo', 'Showcase'],
    organizer: {
      name: 'NYU ITP',
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'
    },
    highlights: [
      '20 student teams presenting',
      'Industry judge panel',
      'Networking reception',
      'Awards ceremony'
    ],
    isPast: true
  },
  {
    id: 'event-102',
    title: 'Product Management 101',
    description: 'Introduction to product management for aspiring PMs. Learn the fundamentals of product thinking, roadmapping, and stakeholder management.',
    date: 'Dec 10, 2025',
    time: '6:00 PM - 8:00 PM',
    location: 'Columbia Business School',
    address: '3022 Broadway, New York, NY 10027',
    attendees: 34,
    maxAttendees: 50,
    image: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=800&h=500&fit=crop',
    tags: ['Product', 'Workshop'],
    organizer: {
      name: 'CBS Tech Club',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop'
    },
    highlights: [
      'PM career panel',
      'Mock interview practice',
      'Resume review session',
      'Networking with PMs'
    ],
    isPast: true
  }
]

/**
 * Get all events
 */
export function getAllEvents() {
  return EVENTS
}

/**
 * Get upcoming events
 */
export function getUpcomingEvents() {
  return EVENTS.filter(e => !e.isPast)
}

/**
 * Get past events
 */
export function getPastEvents() {
  return EVENTS.filter(e => e.isPast)
}

/**
 * Get event by ID
 */
export function getEventById(eventId) {
  return EVENTS.find(e => e.id === eventId) || null
}

// ============================================
// ASYNC FUNCTIONS (Supabase-first with fallback)
// ============================================

/**
 * Get upcoming events from Supabase, fallback to mock
 * @returns {Promise<Array>}
 */
export async function getUpcomingEventsAsync() {
  try {
    const { data, error } = await eventService.getUpcomingEvents()
    if (error) {
      console.warn('Supabase events error, using mock:', error.message)
      return getUpcomingEvents()
    }
    if (data && data.length > 0) {
      return data.map(transformEvent)
    }
    // No events in DB yet, return mock for demo
    console.log('No events in DB, using mock data')
    return getUpcomingEvents()
  } catch (err) {
    console.warn('Events fetch failed, using mock:', err.message)
    return getUpcomingEvents()
  }
}

/**
 * Get past events from Supabase, fallback to mock
 * @returns {Promise<Array>}
 */
export async function getPastEventsAsync() {
  try {
    const { data, error } = await eventService.getPastEvents()
    if (error) {
      console.warn('Supabase events error, using mock:', error.message)
      return getPastEvents()
    }
    if (data && data.length > 0) {
      return data.map(transformEvent)
    }
    // No events in DB yet, return mock for demo
    console.log('No past events in DB, using mock data')
    return getPastEvents()
  } catch (err) {
    console.warn('Events fetch failed, using mock:', err.message)
    return getPastEvents()
  }
}

/**
 * Get single event by ID from Supabase, fallback to mock
 * @param {string} eventId
 * @returns {Promise<Object|null>}
 */
export async function getEventByIdAsync(eventId) {
  try {
    const { data, error } = await eventService.getEvent(eventId)
    if (error) {
      console.warn('Supabase event error, using mock:', error.message)
      return getEventById(eventId)
    }
    if (data) {
      return transformEvent(data)
    }
    // Try mock data
    return getEventById(eventId)
  } catch (err) {
    console.warn('Event fetch failed, using mock:', err.message)
    return getEventById(eventId)
  }
}





