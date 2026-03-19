import { useLocation, useNavigate } from 'react-router-dom'
import { SHOW_PEOPLE_SECTION } from '../config/features'

/**
 * ContextSidebar - Contextual sidebar that renders based on current route
 *
 * Visibility Rules:
 * - /discover: Show all three sections (Saved Projects, Recently Active, Upcoming Events)
 * - /events: Show Saved Projects + Recently Active only
 * - /matches: Show all three sections, de-emphasized
 * - /messages: Hide entire sidebar (handled in WebLayout)
 * - /onboarding/*: Never render (handled in WebLayout)
 */
function ContextSidebar() {
  const location = useLocation()
  const pathname = location.pathname

  const isDiscoverPage = pathname === '/discover'
  const isEventsPage = pathname === '/events'
  const isMatchesPage = pathname === '/matches'
  const isDeEmphasized = isMatchesPage

  const showSavedProjects = isDiscoverPage || isEventsPage || isMatchesPage
  const showRecentlyActive = isDiscoverPage || isEventsPage || isMatchesPage
  const showUpcomingEvents = isDiscoverPage || isMatchesPage

  return (
    <div className="context-sidebar">
      {showSavedProjects && (
        <SavedProjectsSection deEmphasized={isDeEmphasized} />
      )}

      {showRecentlyActive && (
        <RecentlyActiveSection deEmphasized={isDeEmphasized} />
      )}

      {showUpcomingEvents && (
        <UpcomingEventsSection deEmphasized={isDeEmphasized} />
      )}
    </div>
  )
}

/* ─── Shared Styles ─── */

const sectionStyle = {
  marginBottom: '24px',
}

const sectionDeEmphasizedStyle = {
  ...sectionStyle,
  opacity: 0.6,
}

const sectionHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '12px',
  padding: '0 4px',
}

const sectionTitleStyle = {
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '#6B7280',
  margin: 0,
}

const seeAllStyle = {
  fontSize: '12px',
  fontWeight: 500,
  color: '#6366F1',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
}

const listItemStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 8px',
  borderRadius: '8px',
  cursor: 'pointer',
  transition: 'background 0.15s',
}

const avatarStyle = (color) => ({
  width: '36px',
  height: '36px',
  minWidth: '36px',
  borderRadius: '50%',
  backgroundColor: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 600,
  marginRight: '12px',
})

const itemInfoStyle = {
  flex: 1,
  minWidth: 0,
}

const itemNameStyle = {
  fontSize: '13px',
  fontWeight: 600,
  color: '#1F2937',
  margin: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

const itemSubStyle = {
  fontSize: '11px',
  color: '#9CA3AF',
  margin: 0,
  marginTop: '2px',
}

/* ─── Saved Projects Section ─── */

function SavedProjectsSection({ deEmphasized = false }) {
  const navigate = useNavigate()

  const savedProjects = [
    {
      id: 'saved-1',
      name: 'Startup Pitch Deck',
      category: 'Business',
      initial: 'S',
      color: '#6366F1',
    },
    {
      id: 'saved-2',
      name: 'Music Collab Platform',
      category: 'Creative',
      initial: 'M',
      color: '#EC4899',
    },
    {
      id: 'saved-3',
      name: 'Green Campus App',
      category: 'Sustainability',
      initial: 'G',
      color: '#10B981',
    },
  ]

  return (
    <div style={deEmphasized ? sectionDeEmphasizedStyle : sectionStyle}>
      <div style={sectionHeaderStyle}>
        <h3 style={sectionTitleStyle}>SAVED PROJECTS</h3>
        <button
          style={seeAllStyle}
          onClick={() => navigate('/matches')}
        >
          See all
        </button>
      </div>

      <div>
        {savedProjects.map((project) => (
          <div
            key={project.id}
            style={listItemStyle}
            onClick={() => navigate(`/projects/${project.id}`)}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Avatar */}
            <div style={avatarStyle(project.color)}>
              {project.initial}
            </div>

            {/* Info */}
            <div style={itemInfoStyle}>
              <p style={itemNameStyle}>{project.name}</p>
              <p style={itemSubStyle}>{project.category}</p>
            </div>

            {/* Bookmark Icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="#6366F1"
              stroke="#6366F1"
              strokeWidth="2"
              style={{ flexShrink: 0, marginLeft: '8px' }}
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Recently Active Section ─── */

function RecentlyActiveSection({ deEmphasized = false }) {
  const navigate = useNavigate()

  const recentProjects = [
    {
      id: 'recent-1',
      name: 'ClimateTech Dashboard',
      timestamp: '2 hours ago',
      initial: 'C',
      color: '#F59E0B',
    },
    {
      id: 'recent-2',
      name: 'AI Study Buddy',
      timestamp: '5 hours ago',
      initial: 'A',
      color: '#8B5CF6',
    },
    {
      id: 'recent-3',
      name: 'NYC Transit Tracker',
      timestamp: 'Yesterday',
      initial: 'N',
      color: '#3B82F6',
    },
  ]

  return (
    <div style={deEmphasized ? sectionDeEmphasizedStyle : sectionStyle}>
      <div style={sectionHeaderStyle}>
        <h3 style={sectionTitleStyle}>RECENTLY ACTIVE</h3>
      </div>

      <div>
        {recentProjects.map((project) => (
          <div
            key={project.id}
            style={listItemStyle}
            onClick={() => navigate(`/projects/${project.id}`)}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Avatar */}
            <div style={avatarStyle(project.color)}>
              {project.initial}
            </div>

            {/* Info */}
            <div style={itemInfoStyle}>
              <p style={itemNameStyle}>{project.name}</p>
              <p style={itemSubStyle}>{project.timestamp}</p>
            </div>

            {/* Green active dot */}
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                flexShrink: 0,
                marginLeft: '8px',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Upcoming Events Section ─── */

function UpcomingEventsSection({ deEmphasized = false }) {
  const navigate = useNavigate()

  const events = [
    {
      id: 'event-1',
      title: 'NYC Tech Meetup',
      date: 'Jan 15, 2026',
      time: '6:00 PM',
    },
    {
      id: 'event-2',
      title: 'Design Systems Workshop',
      date: 'Jan 18, 2026',
      time: '2:00 PM',
    },
    {
      id: 'event-3',
      title: 'Startup Pitch Night',
      date: 'Jan 22, 2026',
      time: '7:30 PM',
    },
  ]

  return (
    <div style={deEmphasized ? sectionDeEmphasizedStyle : sectionStyle}>
      <div style={sectionHeaderStyle}>
        <h3 style={sectionTitleStyle}>UPCOMING EVENTS</h3>
        <button
          style={seeAllStyle}
          onClick={() => navigate('/events')}
        >
          See all
        </button>
      </div>

      <div>
        {events.map((event) => (
          <div
            key={event.id}
            style={listItemStyle}
            onClick={() => navigate(`/events/${event.id}`)}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {/* Calendar Icon */}
            <div
              style={{
                width: '36px',
                height: '36px',
                minWidth: '36px',
                borderRadius: '8px',
                backgroundColor: '#EEF2FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '12px',
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#6366F1"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>

            {/* Event Info */}
            <div style={itemInfoStyle}>
              <p style={itemNameStyle}>{event.title}</p>
              <p
                style={{
                  fontSize: '11px',
                  color: '#6366F1',
                  margin: 0,
                  marginTop: '2px',
                  fontWeight: 500,
                }}
              >
                {event.date} &bull; {event.time}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default ContextSidebar
