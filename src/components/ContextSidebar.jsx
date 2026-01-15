import { useLocation, useNavigate } from 'react-router-dom'
import { SHOW_PEOPLE_SECTION } from '../config/features'

/**
 * ContextSidebar - Contextual sidebar that renders based on current route
 * 
 * Visibility Rules:
 * - /discover: Show both Upcoming Events + People to Connect
 * - /matches (My Projects): Show both, de-emphasized
 * - /events: Hide Upcoming Events (redundant), show People to Connect only
 * - /messages: Hide entire sidebar (handled in WebLayout)
 * - /onboarding/*: Never render (handled in WebLayout)
 * 
 * Note: People section is hidden for MVP (SHOW_PEOPLE_SECTION flag)
 */
function ContextSidebar() {
  const location = useLocation()
  const pathname = location.pathname

  // Determine what to show based on route
  const showEvents = pathname === '/discover' || pathname === '/matches'
  // People section hidden for MVP via feature flag
  const showPeople = SHOW_PEOPLE_SECTION && (pathname === '/discover' || pathname === '/matches' || pathname === '/events')
  const isDeEmphasized = pathname === '/matches'
  const isEventsPage = pathname === '/events'

  return (
    <div className="context-sidebar">
      {/* Upcoming Events Section */}
      {showEvents && (
        <UpcomingEventsSection deEmphasized={isDeEmphasized} />
      )}

      {/* People to Connect Section - Hidden for MVP */}
      {showPeople && (
        <PeopleToConnectSection 
          deEmphasized={isDeEmphasized} 
          label={isEventsPage ? 'People at Events' : 'People to Connect'}
        />
      )}
    </div>
  )
}

/**
 * UpcomingEventsSection - Shows upcoming events (text-first layout)
 */
function UpcomingEventsSection({ deEmphasized = false }) {
  const navigate = useNavigate()
  
  const events = [
    {
      id: 'event-1',
      title: 'NYC Tech Meetup',
      date: 'Jan 15',
      time: '6:00 PM',
      location: 'WeWork SoHo',
      attendees: 45
    },
    {
      id: 'event-2',
      title: 'Design Systems Workshop',
      date: 'Jan 18',
      time: '2:00 PM',
      location: 'Parsons',
      attendees: 28
    },
    {
      id: 'event-3',
      title: 'Startup Pitch Night',
      date: 'Jan 22',
      time: '7:30 PM',
      location: 'NYU Stern',
      attendees: 62
    }
  ]

  return (
    <div className={`sidebar-section ${deEmphasized ? 'de-emphasized' : ''}`}>
      <div className="sidebar-section-header">
        <h3 className="sidebar-section-title">Upcoming Events</h3>
        <button 
          className="sidebar-see-all"
          onClick={() => navigate('/events')}
        >
          See all
        </button>
      </div>
      
      <div className="sidebar-events-list">
        {events.map(event => (
          <div 
            key={event.id} 
            className="sidebar-event-card-text"
            onClick={() => navigate(`/events/${event.id}`)}
            style={{ cursor: 'pointer' }}
          >
            {/* Calendar Icon */}
            <div className="sidebar-event-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </div>
            
            {/* Event Info */}
            <div className="sidebar-event-info-text">
              <h4 className="sidebar-event-title-text">{event.title}</h4>
              <p className="sidebar-event-datetime">
                {event.date} • {event.time}
              </p>
              <p className="sidebar-event-location-text">{event.location}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * PeopleToConnectSection - Shows suggested people to connect with
 */
function PeopleToConnectSection({ deEmphasized = false, label = 'People to Connect' }) {
  const people = [
    {
      id: 1,
      name: 'Sofia Rodriguez',
      school: 'Columbia',
      role: 'Data Science',
      mutualProjects: 2
    },
    {
      id: 2,
      name: 'David Kim',
      school: 'NYU',
      role: 'Full Stack Dev',
      mutualProjects: 1
    },
    {
      id: 3,
      name: 'Emma Wilson',
      school: 'Parsons',
      role: 'UI/UX Designer',
      mutualProjects: 3
    },
    {
      id: 4,
      name: 'Marcus Chen',
      school: 'Columbia',
      role: 'Backend Engineer',
      mutualProjects: 1
    }
  ]

  return (
    <div className={`sidebar-section ${deEmphasized ? 'de-emphasized' : ''}`}>
      <div className="sidebar-section-header">
        <h3 className="sidebar-section-title">{label}</h3>
      </div>
      
      <div className="sidebar-people-list">
        {people.map(person => (
          <div key={person.id} className="sidebar-person-card">
            {/* Person Icon */}
            <div className="sidebar-person-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <div className="sidebar-person-info">
              <h4 className="sidebar-person-name">{person.name}</h4>
              <p className="sidebar-person-role">{person.role}</p>
              <p className="sidebar-person-meta">
                {person.school} • {person.mutualProjects} mutual project{person.mutualProjects !== 1 ? 's' : ''}
              </p>
            </div>
            <button className="sidebar-connect-btn">
              Connect
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ContextSidebar
