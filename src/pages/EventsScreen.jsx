import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { getUpcomingEventsAsync, getPastEventsAsync } from '../utils/eventData'

/**
 * EventsScreen - Campus Events Discovery
 * Nested NYC – Student-only project network
 *
 * Redesigned card layout with indigo accent, pill tags, and facepile footer
 */

// Event type icons/emojis
const EVENT_ICONS = {
  'Networking': '🤝',
  'Tech': '💻',
  'Design': '🎨',
  'Workshop': '🛠',
  'Demo': '🎤',
  'Showcase': '✨',
  'Social': '🎉',
  'Career': '💼',
  'Hackathon': '⚡',
  'default': '📅'
}

// Background colors for the icon square
const EVENT_ICON_BG = {
  'Networking': '#EEF2FF',
  'Tech': '#EFF6FF',
  'Design': '#FDF2F8',
  'Workshop': '#FFF7ED',
  'Demo': '#F5F3FF',
  'Showcase': '#FFFBEB',
  'Social': '#FEF2F2',
  'Career': '#F0FDF4',
  'Hackathon': '#FFFBEB',
  'default': '#F3F4F6'
}

function getEventIcon(tags) {
  if (!tags || tags.length === 0) return EVENT_ICONS.default
  for (const tag of tags) {
    if (EVENT_ICONS[tag]) return EVENT_ICONS[tag]
  }
  return EVENT_ICONS.default
}

function getEventIconBg(tags) {
  if (!tags || tags.length === 0) return EVENT_ICON_BG.default
  for (const tag of tags) {
    if (EVENT_ICON_BG[tag]) return EVENT_ICON_BG[tag]
  }
  return EVENT_ICON_BG.default
}

// Placeholder attendee avatars
const ATTENDEE_AVATARS = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
]

// Get attendee avatars for facepile (use placeholder for demo)
function getAttendeeAvatars(count) {
  const numAvatars = Math.min(count, 4)
  return ATTENDEE_AVATARS.slice(0, Math.max(numAvatars, 3))
}

function EventsScreen() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('upcoming')
  const [upcomingEvents, setUpcomingEvents] = useState([])
  const [pastEvents, setPastEvents] = useState([])
  const [loading, setLoading] = useState(true)

  // Load events from Supabase (with mock fallback)
  useEffect(() => {
    async function loadEvents() {
      setLoading(true)
      try {
        const [upcoming, past] = await Promise.all([
          getUpcomingEventsAsync(),
          getPastEventsAsync()
        ])
        setUpcomingEvents(upcoming)
        setPastEvents(past)
      } catch (err) {
        console.error('Failed to load events:', err)
      } finally {
        setLoading(false)
      }
    }
    loadEvents()
  }, [])

  const events = activeTab === 'upcoming' ? upcomingEvents : pastEvents

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header - subtitle only, no large title */}
      <div
        style={{
          paddingLeft: '20px',
          paddingRight: '20px',
          paddingTop: '16px',
          paddingBottom: '4px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '15px',
            color: '#6B7280',
            lineHeight: 1.5,
          }}
        >
          Discover what's happening in the NYC student community
        </p>
      </div>

      {/* Tab Bar - left aligned */}
      <div
        style={{
          display: 'flex',
          marginTop: '12px',
          paddingLeft: '20px',
          paddingRight: '20px',
          borderBottom: '1px solid #E5E7EB',
          gap: '24px',
        }}
      >
        <button
          onClick={() => setActiveTab('upcoming')}
          style={{
            padding: '12px 0',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'upcoming' ? '2px solid #6366F1' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'upcoming' ? '#6366F1' : '#9CA3AF',
            transition: 'all 0.2s ease',
          }}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab('past')}
          style={{
            padding: '12px 0',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'past' ? '2px solid #6366F1' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'past' ? '#6366F1' : '#9CA3AF',
            transition: 'all 0.2s ease',
          }}
        >
          Past
        </button>
      </div>

      {/* Events List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          paddingBottom: '100px',
        }}
      >
        {/* Loading State */}
        {loading && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px 0',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid #E5E7EB',
              borderTopColor: '#6366F1',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {events.map(event => (
              <div
                key={event.id}
                onClick={() => navigate(`/events/${event.id}`)}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  padding: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Top section: Icon square + Name + Tags */}
                <div style={{ display: 'flex', gap: '14px' }}>
                  {/* Icon Avatar */}
                  <div
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '10px',
                      backgroundColor: getEventIconBg(event.tags),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      flexShrink: 0,
                    }}
                  >
                    {getEventIcon(event.tags)}
                  </div>

                  {/* Name + Tags */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#111827',
                        lineHeight: 1.3,
                      }}
                    >
                      {event.title}
                    </h3>

                    {/* Tag pills */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {event.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          style={{
                            backgroundColor: '#EEF2FF',
                            color: '#6366F1',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 10px',
                            borderRadius: '9999px',
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p
                  style={{
                    margin: 0,
                    marginTop: '12px',
                    fontSize: '13px',
                    color: '#6B7280',
                    lineHeight: 1.6,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {event.description}
                </p>

                {/* Meta row */}
                <div
                  style={{
                    marginTop: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap',
                  }}
                >
                  {/* Date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span style={{ fontSize: '12px', color: '#6366F1', fontWeight: 500 }}>
                      {event.date}
                    </span>
                  </div>

                  {/* Location */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>
                      {event.location}
                    </span>
                  </div>

                  {/* Attendees */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span style={{ fontSize: '12px', color: '#6B7280' }}>
                      {event.attendees} going
                    </span>
                  </div>
                </div>

                {/* Footer divider + facepile + RSVP (upcoming) */}
                {activeTab === 'upcoming' && (
                  <>
                    <div style={{
                      borderTop: '1px solid #E5E7EB',
                      marginTop: '16px',
                      paddingTop: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}>
                      {/* Facepile + Attending Text */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {getAttendeeAvatars(event.attendees).map((avatar, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: '2px solid white',
                                backgroundColor: '#E5E7EB',
                                marginLeft: idx > 0 ? '-8px' : 0,
                                overflow: 'hidden',
                                position: 'relative',
                                zIndex: 4 - idx,
                              }}
                            >
                              <img
                                src={avatar}
                                alt=""
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: '12px', color: '#6B7280' }}>
                          {event.attendees} attending
                        </span>
                      </div>

                      {/* RSVP Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/events/${event.id}`)
                        }}
                        style={{
                          padding: '8px 22px',
                          backgroundColor: '#6366F1',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: 600,
                          borderRadius: '20px',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease',
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4F46E5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366F1'}
                      >
                        RSVP
                      </button>
                    </div>
                  </>
                )}

                {/* Footer divider + facepile + Ended (past) */}
                {activeTab === 'past' && (
                  <>
                    <div style={{
                      borderTop: '1px solid #E5E7EB',
                      marginTop: '16px',
                      paddingTop: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}>
                      {/* Facepile + Attended Text */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {getAttendeeAvatars(event.attendees).map((avatar, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: '2px solid white',
                                backgroundColor: '#E5E7EB',
                                marginLeft: idx > 0 ? '-8px' : 0,
                                overflow: 'hidden',
                                position: 'relative',
                                zIndex: 4 - idx,
                                filter: 'grayscale(30%)',
                                opacity: 0.8,
                              }}
                            >
                              <img
                                src={avatar}
                                alt=""
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            </div>
                          ))}
                        </div>
                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                          {event.attendees} attended
                        </span>
                      </div>

                      {/* Ended Badge */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          backgroundColor: '#F3F4F6',
                          borderRadius: '20px',
                          flexShrink: 0,
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>
                          Ended
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Empty State */}
            {events.length === 0 && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: '#9CA3AF',
                }}
              >
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  style={{ margin: '0 auto 16px' }}
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <p style={{ margin: 0, fontSize: '15px', fontWeight: 500 }}>
                  {activeTab === 'upcoming' ? 'No upcoming events' : 'No past events'}
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '13px' }}>
                  Check back soon for new events!
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}

export default EventsScreen
