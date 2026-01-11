import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getEventById } from '../utils/eventData'

/**
 * EventDetailScreen - Event Detail View
 * Nested NYC – Student-only project network
 * 
 * Desktop: Two-column layout (content left, RSVP card right)
 * Mobile: Single column with sticky bottom CTA
 */

function EventDetailScreen() {
  const navigate = useNavigate()
  const { eventId } = useParams()
  const [isDesktop, setIsDesktop] = useState(false)
  const [isRsvped, setIsRsvped] = useState(false)
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  // Responsive check
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  
  // Load event by ID
  useEffect(() => {
    if (eventId) {
      const foundEvent = getEventById(eventId)
      setEvent(foundEvent)
    }
    setLoading(false)
  }, [eventId])

  // Loading state
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        backgroundColor: 'white'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid #E5E7EB',
          borderTopColor: '#5B4AE6',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
      </div>
    )
  }

  // Event not found state
  if (!event) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100%',
        backgroundColor: 'white',
        padding: '40px',
        textAlign: 'center'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: '#F3F4F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px'
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
          Event not found
        </h2>
        <p style={{ margin: '8px 0 24px 0', fontSize: '14px', color: '#6B7280' }}>
          This event may have been cancelled or the link is incorrect.
        </p>
        <button 
          onClick={() => navigate('/events')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#5B4AE6',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Browse Events
        </button>
      </div>
    )
  }

  const spotsLeft = event.maxAttendees - event.attendees

  // Desktop Layout
  if (isDesktop) {
    return (
      <div className="event-detail-desktop">
        {/* Back Button */}
        <div className="event-detail-back">
          <button 
            onClick={() => navigate('/events')}
            className="back-btn-desktop"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Events
          </button>
        </div>

        <div className="event-detail-layout">
          {/* Left Column - Main Content */}
          <div className="event-detail-main">
            {/* Hero Image */}
            <div className="event-detail-hero">
              <img 
                src={event.image}
                alt={event.title}
                className="event-detail-image"
              />
              <div className="event-detail-hero-overlay" />
              {/* Tags */}
              <div className="event-detail-tags-overlay">
                {event.tags.map((tag, idx) => (
                  <span key={idx} className="event-tag-badge">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Event Header */}
            <div className="event-detail-header">
              <h1 className="event-detail-title">{event.title}</h1>
              <div className="event-organizer">
                <img 
                  src={event.organizer.image} 
                  alt={event.organizer.name}
                  className="organizer-avatar"
                />
                <span className="organizer-name">Hosted by {event.organizer.name}</span>
              </div>
            </div>

            {/* About Section */}
            <div className="event-detail-section">
              <h3 className="section-title-desktop">About this event</h3>
              <p className="event-description-desktop">
                {event.description}
              </p>
            </div>

            {/* Highlights Section */}
            {event.highlights && (
              <div className="event-detail-section">
                <h3 className="section-title-desktop">What to expect</h3>
                <ul className="event-highlights">
                  {event.highlights.map((highlight, idx) => (
                    <li key={idx} className="highlight-item">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2.5">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                      </svg>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right Column - RSVP Sidebar */}
          <div className="event-detail-sidebar">
            <div className="event-rsvp-card">
              {/* Date & Time */}
              <div className="rsvp-info-row">
                <div className="rsvp-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div className="rsvp-info-text">
                  <span className="rsvp-label">{event.date}</span>
                  <span className="rsvp-sublabel">{event.time}</span>
                </div>
              </div>

              {/* Location */}
              <div className="rsvp-info-row">
                <div className="rsvp-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div className="rsvp-info-text">
                  <span className="rsvp-label">{event.location}</span>
                  <span className="rsvp-sublabel">{event.address}</span>
                </div>
              </div>

              {/* Attendees */}
              <div className="rsvp-info-row">
                <div className="rsvp-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div className="rsvp-info-text">
                  <span className="rsvp-label">{event.attendees} attending</span>
                  <span className="rsvp-sublabel">{spotsLeft} spots remaining</span>
                </div>
              </div>

              {/* Capacity Bar */}
              <div className="capacity-bar-container">
                <div className="capacity-bar">
                  <div 
                    className="capacity-bar-fill"
                    style={{ width: `${(event.attendees / event.maxAttendees) * 100}%` }}
                  />
                </div>
                <span className="capacity-text">
                  {Math.round((event.attendees / event.maxAttendees) * 100)}% full
                </span>
              </div>

              {/* RSVP Button */}
              {!event.isPast ? (
                <button 
                  className={`rsvp-btn-desktop ${isRsvped ? 'rsvped' : ''}`}
                  onClick={() => setIsRsvped(!isRsvped)}
                >
                  {isRsvped ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M9 12l2 2 4-4"/>
                        <circle cx="12" cy="12" r="10"/>
                      </svg>
                      You're going!
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      RSVP Now
                    </>
                  )}
                </button>
              ) : (
                <div className="past-event-notice">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>This event has ended</span>
                </div>
              )}

              {/* Share */}
              <button className="share-event-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                Share Event
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Mobile Layout
  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }}>
        {/* Hero Image Section */}
        <div style={{ position: 'relative', height: '240px', flexShrink: 0 }}>
          <img 
            src={event.image}
            alt={event.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          
          {/* Back Button */}
          <button 
            onClick={() => navigate('/events')}
            style={{
              position: 'absolute',
              top: '48px',
              left: '20px',
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <svg width="10" height="16" viewBox="0 0 12 20" fill="none">
              <path 
                d="M10 2L2 10L10 18" 
                stroke="#231429" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
          
          {/* Tags */}
          <div 
            style={{
              position: 'absolute',
              top: '48px',
              right: '20px',
              display: 'flex',
              gap: '8px'
            }}
          >
            {event.tags.map((tag, idx) => (
              <span 
                key={idx}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '20px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#5B4AE6',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                {tag}
              </span>
            ))}
          </div>
          
          {/* Bottom Gradient */}
          <div 
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '100px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)'
            }}
          />
          
          {/* Title Overlay */}
          <div 
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '20px',
              right: '20px'
            }}
          >
            <h1 
              style={{ 
                margin: 0,
                fontSize: '22px',
                fontWeight: 700,
                color: 'white'
              }}
            >
              {event.title}
            </h1>
          </div>
        </div>
        
        {/* Content Section */}
        <div style={{ padding: '20px' }}>
          {/* Organizer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <img 
              src={event.organizer.image}
              alt={event.organizer.name}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                objectFit: 'cover'
              }}
            />
            <span style={{ fontSize: '13px', color: '#6B7280' }}>
              Hosted by <strong style={{ color: '#111827' }}>{event.organizer.name}</strong>
            </span>
          </div>

          {/* Date, Time, Location Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '14px', 
              padding: '14px', 
              backgroundColor: '#FAFAFA', 
              borderRadius: '12px' 
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(91, 74, 230, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>{event.date}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>{event.time}</p>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '14px', 
              padding: '14px', 
              backgroundColor: '#FAFAFA', 
              borderRadius: '12px' 
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(91, 74, 230, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>{event.location}</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>{event.address}</p>
              </div>
            </div>

            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '14px', 
              padding: '14px', 
              backgroundColor: '#FAFAFA', 
              borderRadius: '12px' 
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(91, 74, 230, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>{event.attendees} attending</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>{spotsLeft} spots left</p>
              </div>
            </div>
          </div>
          
          {/* Description */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
              About
            </h3>
            <p style={{ 
              margin: 0, 
              marginTop: '8px', 
              fontSize: '14px', 
              color: '#666', 
              lineHeight: 1.6 
            }}>
              {event.description}
            </p>
          </div>
          
          {/* Highlights */}
          {event.highlights && (
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
                What to expect
              </h3>
              <ul style={{ margin: '12px 0 0 0', padding: 0, listStyle: 'none' }}>
                {event.highlights.map((highlight, idx) => (
                  <li 
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 0',
                      fontSize: '14px',
                      color: '#374151'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2.5">
                      <path d="M9 12l2 2 4-4"/>
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {/* Sticky Bottom CTA - Mobile Only */}
      {!event.isPast && (
        <div 
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '16px 20px',
            paddingBottom: '28px',
            backgroundColor: 'white',
            borderTop: '1px solid #F0F0F0',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}
        >
          {/* Share Button */}
          <button 
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              border: '1.5px solid #E5E7EB',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#231429" strokeWidth="2">
              <circle cx="18" cy="5" r="3"/>
              <circle cx="6" cy="12" r="3"/>
              <circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
          
          {/* RSVP Button */}
          <button 
            onClick={() => setIsRsvped(!isRsvped)}
            style={{
              flex: 1,
              height: '52px',
              backgroundColor: isRsvped ? '#10B981' : '#5B4AE6',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'background-color 0.2s ease'
            }}
          >
            {isRsvped ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M9 12l2 2 4-4"/>
                  <circle cx="12" cy="12" r="10"/>
                </svg>
                You're going!
              </>
            ) : (
              'RSVP Now'
            )}
          </button>
        </div>
      )}
      
      {/* Home Indicator - Mobile Only */}
      <div 
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: '8px' }}
      >
        <div 
          style={{
            width: '134px',
            height: '5px',
            backgroundColor: '#000000',
            borderRadius: '100px'
          }}
        />
      </div>
    </div>
  )
}

export default EventDetailScreen





