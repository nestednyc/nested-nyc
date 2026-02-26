import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { getUpcomingEventsAsync, getPastEventsAsync } from '../utils/eventData'

/**
 * EventsScreen - Campus Events Discovery
 * Nested NYC – Student-only project network
 *
 * Text-first, compact card layout for MVP
 * No stock images – clean, scannable event dashboard
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

function getEventIcon(tags) {
  if (!tags || tags.length === 0) return EVENT_ICONS.default
  for (const tag of tags) {
    if (EVENT_ICONS[tag]) return EVENT_ICONS[tag]
  }
  return EVENT_ICONS.default
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
      {/* Header */}
      <div
        style={{
          paddingTop: '32px',
          paddingLeft: '40px',
          paddingRight: '40px',
          paddingBottom: '0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              color: '#111827'
            }}
          >
            Events
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6B7280' }}>
            Discover what's happening in the NYC student community
          </p>
        </div>

        {/* Create Event Button (preserved from new-testing) */}
        <button
          onClick={() => navigate('/create-event')}
          style={{
            height: '40px',
            padding: '0 16px',
            borderRadius: '20px',
            border: 'none',
            backgroundColor: '#5B4AE6',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Create
        </button>
      </div>

      {/* Tab Bar - Sticky */}
      <div
        style={{
          display: 'flex',
          marginTop: '24px',
          marginLeft: '40px',
          marginRight: '40px',
          borderBottom: '1px solid #EAECF0',
          position: 'sticky',
          top: 0,
          backgroundColor: 'white',
          zIndex: 10
        }}
      >
        <button
          onClick={() => setActiveTab('upcoming')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'upcoming' ? '2px solid #5B4AE6' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'upcoming' ? '#5B4AE6' : '#9CA3AF',
            transition: 'all 0.2s ease',
            marginBottom: '-1px'
          }}
        >
          Upcoming
        </button>
        <button
          onClick={() => setActiveTab('past')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'past' ? '2px solid #5B4AE6' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'past' ? '#5B4AE6' : '#9CA3AF',
            transition: 'all 0.2s ease',
            marginBottom: '-1px'
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
          paddingBottom: '100px',
          padding: '28px 40px'
        }}
      >
        {/* Loading State */}
        {loading && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px 0'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid #E5E7EB',
              borderTopColor: '#5B4AE6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
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
                borderRadius: '16px',
                border: '1px solid #EAECF0',
                padding: '20px 24px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#D1D5DB'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#EAECF0'
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.03)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {/* Top Row: Icon + Title + Tags */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '12px' }}>
                {/* Event Icon */}
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(91, 74, 230, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    flexShrink: 0
                  }}
                >
                  {getEventIcon(event.tags)}
                </div>

                {/* Title + Tags */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '17px',
                      fontWeight: 700,
                      color: '#111827',
                      lineHeight: 1.3,
                      marginBottom: '8px'
                    }}
                  >
                    {event.title}
                  </h3>
                  {/* Tags */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {event.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          backgroundColor: 'rgba(91, 74, 230, 0.08)',
                          color: '#5B4AE6',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '4px 10px',
                          borderRadius: '10px'
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
                  marginBottom: '16px',
                  fontSize: '14px',
                  color: '#4B5563',
                  lineHeight: 1.6,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {event.description}
              </p>

              {/* Metadata Row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}
              >
                {/* Date */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  <span style={{ fontSize: '13px', color: '#5B4AE6', fontWeight: 500 }}>
                    {event.date}
                  </span>
                </div>

                {/* Location */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>
                    {event.location}
                  </span>
                </div>

                {/* Attendees */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>
                    {event.attendees} going
                  </span>
                </div>
              </div>

              {/* Footer: Attendee count + RSVP */}
              {activeTab === 'upcoming' && (
                <div style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span style={{ fontSize: '13px', color: '#6B7280', fontWeight: 500 }}>
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
                      padding: '10px 22px',
                      backgroundColor: '#5B4AE6',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: '20px',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4A3CD4'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5B4AE6'}
                  >
                    RSVP
                  </button>
                </div>
              )}

              {/* Past event - Attended count + Ended indicator */}
              {activeTab === 'past' && (
                <div style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: 500 }}>
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
                      borderRadius: '16px',
                      flexShrink: 0
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                    <span style={{ fontSize: '12px', color: '#9CA3AF', fontWeight: 500 }}>
                      Ended
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Empty State */}
          {events.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#9CA3AF'
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
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
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
