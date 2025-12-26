import { useNavigate } from 'react-router-dom'

/**
 * DesktopSidebar - Right sidebar for desktop layout
 * 
 * Contains:
 * - Upcoming Events card
 * - Suggested Teammates / People to Connect
 * - Quick Stats or Info Cards
 * 
 * Only visible on desktop (≥1024px) for specific routes.
 */

function DesktopSidebar() {
  const navigate = useNavigate()
  
  // Sample events data
  const upcomingEvents = [
    {
      id: 1,
      title: 'NYC Hackathon 2025',
      date: 'Jan 15',
      location: 'Columbia',
      attendees: 128,
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=100&h=100&fit=crop'
    },
    {
      id: 2,
      title: 'Design Systems Workshop',
      date: 'Jan 18',
      location: 'Parsons',
      attendees: 45,
      image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=100&h=100&fit=crop'
    },
    {
      id: 3,
      title: 'AI/ML Meetup',
      date: 'Jan 22',
      location: 'NYU',
      attendees: 89,
      image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=100&h=100&fit=crop'
    },
  ]
  
  // Sample suggested people
  const suggestedPeople = [
    {
      id: 1,
      name: 'Sofia Rodriguez',
      school: 'Columbia',
      skills: ['Data Science', 'Python'],
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop'
    },
    {
      id: 2,
      name: 'Marcus Chen',
      school: 'NYU',
      skills: ['React', 'Node.js'],
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop'
    },
    {
      id: 3,
      name: 'Emma Wilson',
      school: 'Parsons',
      skills: ['UI/UX', 'Figma'],
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
    },
  ]

  return (
    <div className="sidebar-content">
      {/* Upcoming Events Card */}
      <div className="sidebar-card">
        <div className="sidebar-card-header">
          <h3>Upcoming Events</h3>
          <button 
            className="sidebar-see-all"
            onClick={() => navigate('/events')}
          >
            See all
          </button>
        </div>
        
        <div className="sidebar-events-list">
          {upcomingEvents.map(event => (
            <div key={event.id} className="sidebar-event-item">
              <div className="sidebar-event-image">
                <img src={event.image} alt={event.title} />
              </div>
              <div className="sidebar-event-info">
                <p className="sidebar-event-title">{event.title}</p>
                <p className="sidebar-event-meta">
                  {event.date} • {event.location}
                </p>
                <p className="sidebar-event-attendees">
                  {event.attendees} attending
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Suggested Teammates Card */}
      <div className="sidebar-card">
        <div className="sidebar-card-header">
          <h3>People to Connect</h3>
        </div>
        
        <div className="sidebar-people-list">
          {suggestedPeople.map(person => (
            <div key={person.id} className="sidebar-person-item">
              <div className="sidebar-person-avatar">
                <img src={person.image} alt={person.name} />
              </div>
              <div className="sidebar-person-info">
                <p className="sidebar-person-name">{person.name}</p>
                <p className="sidebar-person-school">{person.school}</p>
                <div className="sidebar-person-skills">
                  {person.skills.map((skill, idx) => (
                    <span key={idx} className="sidebar-skill-tag">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <button className="sidebar-connect-btn">
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Quick Stats */}
      <div className="sidebar-card sidebar-stats">
        <div className="sidebar-stat">
          <span className="sidebar-stat-number">24</span>
          <span className="sidebar-stat-label">Active Projects</span>
        </div>
        <div className="sidebar-stat">
          <span className="sidebar-stat-number">156</span>
          <span className="sidebar-stat-label">NYC Students</span>
        </div>
        <div className="sidebar-stat">
          <span className="sidebar-stat-number">12</span>
          <span className="sidebar-stat-label">Schools</span>
        </div>
      </div>
      
      {/* Footer Links */}
      <div className="sidebar-footer">
        <a href="#">About</a>
        <span>•</span>
        <a href="#">Help</a>
        <span>•</span>
        <a href="#">Privacy</a>
        <span>•</span>
        <a href="#">Terms</a>
      </div>
    </div>
  )
}

export default DesktopSidebar

