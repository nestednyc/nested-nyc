import { useLocation, useNavigate } from 'react-router-dom'

/**
 * ContextSidebar - Contextual sidebar that renders based on current route
 * 
 * Visibility Rules:
 * - /discover: Show both Upcoming Events + People to Connect
 * - /matches (My Projects): Show both, de-emphasized
 * - /events: Hide Upcoming Events (redundant), show People to Connect only
 * - /messages: Hide entire sidebar (handled in WebLayout)
 * - /onboarding/*: Never render (handled in WebLayout)
 */
function ContextSidebar() {
  const location = useLocation()
  const pathname = location.pathname

  // Determine what to show based on route
  const showEvents = pathname === '/discover' || pathname === '/matches'
  const showPeople = pathname === '/discover' || pathname === '/matches' || pathname === '/events'
  const isDeEmphasized = pathname === '/matches'
  const isEventsPage = pathname === '/events'

  return (
    <div className="context-sidebar">
      {/* Upcoming Events Section */}
      {showEvents && (
        <UpcomingEventsSection deEmphasized={isDeEmphasized} />
      )}

      {/* People to Connect Section */}
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
 * UpcomingEventsSection - Shows upcoming events
 */
function UpcomingEventsSection({ deEmphasized = false }) {
  const navigate = useNavigate()
  
  const events = [
    {
      id: 1,
      title: 'NYC Tech Meetup',
      date: 'Jan 15',
      time: '6:00 PM',
      location: 'WeWork SoHo',
      attendees: 45,
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=200&h=120&fit=crop'
    },
    {
      id: 2,
      title: 'Design Systems Workshop',
      date: 'Jan 18',
      time: '2:00 PM',
      location: 'Parsons',
      attendees: 28,
      image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=200&h=120&fit=crop'
    },
    {
      id: 3,
      title: 'Startup Pitch Night',
      date: 'Jan 22',
      time: '7:30 PM',
      location: 'NYU Stern',
      attendees: 62,
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=200&h=120&fit=crop'
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
          <div key={event.id} className="sidebar-event-card">
            <div className="sidebar-event-image">
              <img src={event.image} alt={event.title} />
            </div>
            <div className="sidebar-event-info">
              <h4 className="sidebar-event-title">{event.title}</h4>
              <p className="sidebar-event-meta">
                {event.date} • {event.time}
              </p>
              <p className="sidebar-event-location">{event.location}</p>
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
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      mutualProjects: 2
    },
    {
      id: 2,
      name: 'David Kim',
      school: 'NYU',
      role: 'Full Stack Dev',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
      mutualProjects: 1
    },
    {
      id: 3,
      name: 'Emma Wilson',
      school: 'Parsons',
      role: 'UI/UX Designer',
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      mutualProjects: 3
    },
    {
      id: 4,
      name: 'Marcus Chen',
      school: 'Columbia',
      role: 'Backend Engineer',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
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
            <img 
              src={person.image} 
              alt={person.name}
              className="sidebar-person-image"
            />
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





