import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { getDiscoverProjects, getDiscoverProjectsAsync, getCurrentUserId, getSavedProjects } from '../utils/projectData'
import { getDiscoverNests, getDiscoverNestsAsync, DEMO_CURRENT_USER_ID } from '../utils/nestData'
import { getUpcomingEvents, getUpcomingEventsAsync } from '../utils/eventData'
import { SHOW_NESTS, SHOW_FILTERS } from '../config/features'
import { getInitialsAvatar } from '../utils/avatarUtils'
import WelcomeTutorial from '../components/WelcomeTutorial'

/**
 * DiscoverScreen - Projects Feed + Nests Discovery
 * Nested NYC – Student-only project network
 *
 * Two-column layout with large immersive project cards
 * Right sidebar with Saved Projects, Recently Active, and Upcoming Events
 */

// Project category icons
const CATEGORY_ICONS = {
  'startup': '🚀',
  'Startup': '🚀',
  'class-project': '📚',
  'Class Project': '📚',
  'hackathon': '⚡',
  'Hackathon': '⚡',
  'side-project': '🛠',
  'Side Project': '🛠',
  'research': '🔬',
  'Research': '🔬',
  'default': '📦'
}

function getProjectIcon(category) {
  if (!category) return CATEGORY_ICONS.default
  return CATEGORY_ICONS[category] || CATEGORY_ICONS.default
}

// Get up to 4 members for facepile with names
function getProjectMembers(project) {
  if (project.team && project.team.length > 0) {
    return project.team.slice(0, 4).map(member => ({
      name: member.name.split(' ')[0], // First name only
      image: member.image
    }))
  }
  return []
}

// Generate "Joined by..." text
function getJoinedByText(members) {
  if (members.length === 0) return ''
  if (members.length === 1) return `Joined by ${members[0].name}`
  if (members.length === 2) return `Joined by ${members[0].name} and ${members[1].name}`
  const othersCount = members.length - 2
  return `Joined by ${members[0].name}, ${members[1].name}${othersCount > 0 ? ` +${othersCount}` : ''}`
}

function DiscoverScreen() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('projects')
  const [projectsFeed, setProjectsFeed] = useState([])
  const [nestsFeed, setNestsFeed] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [savedProjects, setSavedProjects] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])

  // Load projects and nests from centralized store (with Supabase support)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      // Get current user ID
      const userId = await getCurrentUserId()
      setCurrentUserId(userId)

      // Load projects from Supabase or localStorage
      try {
        const projects = await getDiscoverProjectsAsync()
        setProjectsFeed(projects)
      } catch (err) {
        console.error('Error loading projects:', err)
        setProjectsFeed(getDiscoverProjects())
      }

      // Load nests (async if available)
      try {
        if (typeof getDiscoverNestsAsync === 'function') {
          const nests = await getDiscoverNestsAsync()
          setNestsFeed(nests)
        } else {
          setNestsFeed(getDiscoverNests())
        }
      } catch (err) {
        console.error('Error loading nests:', err)
        setNestsFeed(getDiscoverNests())
      }

      // Load sidebar data (sync is fine for these)
      setSavedProjects(getSavedProjects())
      try {
        const events = await getUpcomingEventsAsync()
        setUpcomingEvents(events.slice(0, 3))
      } catch (err) {
        setUpcomingEvents(getUpcomingEvents().slice(0, 3))
      }

      setLoading(false)
    }

    loadData()
  }, [])


  return (
    <div className="flex flex-col h-full bg-white relative">
      <WelcomeTutorial />
      {/* Header */}
      <div
        style={{
          paddingTop: '50px',
          paddingLeft: '20px',
          paddingRight: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}
      >
        {/* Left: Title + Location */}
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              color: '#5B4AE6'
            }}
          >
            Discover
          </h1>
          <p
            style={{
              margin: 0,
              marginTop: '4px',
              fontSize: '12px',
              color: '#ADAFBB'
            }}
          >
            NYC
          </p>
        </div>

        {/* Right: Filter Icon - Hidden for MVP */}
        {SHOW_FILTERS && (
          <button
            onClick={() => navigate('/filters')}
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '15px',
              border: '1px solid #E5E7EB',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <FilterIcon />
          </button>
        )}
      </div>

      {/* Tab Bar - Only show if Nests feature is enabled */}
      {SHOW_NESTS && (
        <div
          style={{
            display: 'flex',
            marginTop: '16px',
            borderBottom: '1px solid #E5E7EB'
          }}
        >
          <button
            onClick={() => setActiveTab('projects')}
            style={{
              flex: 1,
              padding: '14px 0',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'projects' ? '2px solid #5B4AE6' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              color: activeTab === 'projects' ? '#5B4AE6' : '#ADAFBB',
              transition: 'all 0.2s ease'
            }}
          >
            Projects
          </button>
          <button
            onClick={() => setActiveTab('nests')}
            style={{
              flex: 1,
              padding: '14px 0',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'nests' ? '2px solid #5B4AE6' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              color: activeTab === 'nests' ? '#5B4AE6' : '#ADAFBB',
              transition: 'all 0.2s ease'
            }}
          >
            Nests
          </button>
        </div>
      )}

      {/* Tab Content - Default to projects, only show nests if feature enabled */}
      {(activeTab === 'projects' || !SHOW_NESTS) ? (
        /* Projects Feed - Two Column Layout */
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingBottom: '100px',
            padding: '28px 32px'
          }}
        >
          {/* Search Projects */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F8F9FA',
              borderRadius: '14px',
              padding: '14px 18px',
              gap: '12px',
              marginBottom: '32px',
              border: '1px solid #F0F1F3'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search projects..."
              style={{
                flex: 1,
                border: 'none',
                backgroundColor: 'transparent',
                outline: 'none',
                fontSize: '14px',
                color: '#374151'
              }}
            />
          </div>

          {/* Two Column Layout */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 320px',
              gap: '40px',
              alignItems: 'start'
            }}
            className="discover-two-col"
          >
            {/* Left Column - Main Feed */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* All Projects Label */}
              <p style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: 600,
                color: '#6B7280',
                letterSpacing: '0.02em'
              }}>
                Projects for you
              </p>

              {/* Large Project Cards */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}
              >
                {projectsFeed.map(project => {
                  const members = getProjectMembers(project)
                  return (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      style={{
                        padding: '24px 28px',
                        backgroundColor: '#FFFFFF',
                        borderRadius: '16px',
                        border: '1px solid #EAECF0',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.06)'
                        e.currentTarget.style.transform = 'translateY(-1px)'
                        e.currentTarget.style.borderColor = '#D1D5DB'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.03)'
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.borderColor = '#EAECF0'
                      }}
                    >
                      {/* Header: Icon + Title + Category */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                        {/* Large Project Icon */}
                        <div
                          style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '14px',
                            backgroundColor: 'rgba(91, 74, 230, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px',
                            flexShrink: 0,
                            overflow: 'hidden'
                          }}
                        >
                          {project.iconType === 'image' && project.iconImage ? (
                            <img src={project.iconImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            project.iconEmoji || getProjectIcon(project.category)
                          )}
                        </div>

                        {/* Title and Category */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <h3 style={{
                              margin: 0,
                              fontSize: '20px',
                              fontWeight: 700,
                              color: '#111827',
                              lineHeight: 1.3
                            }}>
                              {project.title}
                            </h3>
                            {project.isUserProject && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  color: 'white',
                                  backgroundColor: '#5B4AE6',
                                  padding: '3px 10px',
                                  borderRadius: '10px',
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.03em'
                                }}
                              >
                                Your Project
                              </span>
                            )}
                          </div>
                          {/* Schools */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                              <circle cx="12" cy="10" r="3"/>
                            </svg>
                            <span style={{ fontSize: '13px', color: '#6B7280' }}>
                              {project.schools && project.schools.length > 0
                                ? project.schools.join(', ')
                                : 'NYC'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Description - 4 line clamp */}
                      <p
                        style={{
                          margin: 0,
                          marginBottom: '20px',
                          fontSize: '14px',
                          color: '#4B5563',
                          lineHeight: 1.65,
                          display: '-webkit-box',
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {project.description || project.tagline || 'Building something awesome with fellow students'}
                      </p>

                      {/* Tags Row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        {project.category && (
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#5B4AE6',
                              backgroundColor: 'rgba(91, 74, 230, 0.08)',
                              padding: '5px 12px',
                              borderRadius: '12px',
                              fontWeight: 600
                            }}
                          >
                            {project.category}
                          </span>
                        )}
                        {project.skillsNeeded && project.skillsNeeded.slice(0, 3).map((skill, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '11px',
                              color: '#6B7280',
                              backgroundColor: '#F3F4F6',
                              padding: '5px 12px',
                              borderRadius: '12px',
                              fontWeight: 500
                            }}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>

                      {/* Footer: Team + Spots + Action */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '16px',
                        borderTop: '1px solid #F3F4F6'
                      }}>
                        {/* Team Facepile */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {members.map((member, idx) => (
                              <div
                                key={idx}
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  border: '2px solid white',
                                  backgroundColor: '#E5E7EB',
                                  marginLeft: idx > 0 ? '-10px' : 0,
                                  overflow: 'hidden',
                                  position: 'relative',
                                  zIndex: 4 - idx,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                                }}
                              >
                                <img
                                  src={member.image || getInitialsAvatar(member.name, 32)}
                                  alt={member.name}
                                  style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                              {getJoinedByText(members)}
                            </span>
                            {project.spotsLeft > 0 && (
                              <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>
                                {project.spotsLeft} spots open
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Join Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/projects/${project.id}`)
                          }}
                          style={{
                            padding: '10px 24px',
                            backgroundColor: project.isUserProject ? 'transparent' : '#5B4AE6',
                            color: project.isUserProject ? '#5B4AE6' : 'white',
                            fontSize: '13px',
                            fontWeight: 600,
                            borderRadius: '20px',
                            border: project.isUserProject ? '1.5px solid #5B4AE6' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                          onMouseEnter={(e) => {
                            if (!project.isUserProject) {
                              e.currentTarget.style.backgroundColor = '#4A3CD4'
                            } else {
                              e.currentTarget.style.backgroundColor = 'rgba(91, 74, 230, 0.08)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!project.isUserProject) {
                              e.currentTarget.style.backgroundColor = '#5B4AE6'
                            } else {
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }
                          }}
                        >
                          {project.isUserProject ? 'View' : 'Join'}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 12h14M12 5l7 7-7 7"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Create Project CTA - Natural card styling */}
              <div
                style={{
                  padding: '28px 32px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  border: '1px solid #EAECF0',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '24px'
                }}
              >
                <div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                    Can't find a project to join?
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6B7280' }}>
                    Start your own and find teammates.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/create-project')}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#5B4AE6',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    borderRadius: '20px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4A3CD4'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5B4AE6'}
                >
                  Create Project
                </button>
              </div>
            </div>

            {/* Right Column - Sidebar Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Saved Projects Section */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '14px',
                  padding: '20px',
                  border: '1px solid #F0F1F3'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Saved Projects
                  </h3>
                  <button
                    onClick={() => navigate('/matches')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#5B4AE6',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    See all
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {savedProjects.slice(0, 3).map(project => (
                    <div
                      key={project.id}
                      onClick={() => navigate(`/projects/${project.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        backgroundColor: '#FAFBFC',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FAFBFC'}
                    >
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          flexShrink: 0
                        }}
                      >
                        <img
                          src={project.image}
                          alt={project.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0,
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#374151',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {project.title}
                        </p>
                        <p style={{ margin: '1px 0 0 0', fontSize: '11px', color: '#9CA3AF' }}>
                          {project.category}
                        </p>
                      </div>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#5B4AE6" stroke="none" style={{ opacity: 0.7 }}>
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming Events Section */}
              <div
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '14px',
                  padding: '20px',
                  border: '1px solid #F0F1F3'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Upcoming Events
                  </h3>
                  <button
                    onClick={() => navigate('/events')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#5B4AE6',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    See all
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {upcomingEvents.map(event => (
                    <div
                      key={event.id}
                      onClick={() => navigate(`/events/${event.id}`)}
                      style={{
                        display: 'flex',
                        gap: '12px',
                        padding: '10px 12px',
                        backgroundColor: '#FAFBFC',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FAFBFC'}
                    >
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(91, 74, 230, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0,
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#374151',
                          lineHeight: 1.3
                        }}>
                          {event.title}
                        </p>
                        <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#5B4AE6', fontWeight: 500 }}>
                          {event.date} {event.time ? `• ${event.time.split(' - ')[0] || event.time}` : ''}
                        </p>
                        <p style={{ margin: '1px 0 0 0', fontSize: '10px', color: '#9CA3AF' }}>
                          {event.location}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : SHOW_NESTS ? (
        /* Nests Discovery - Only rendered if SHOW_NESTS is true */
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            paddingBottom: '100px',
            padding: '16px'
          }}
        >
          {/* Search Nests */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#F3F3F3',
              borderRadius: '15px',
              padding: '12px 16px',
              gap: '12px',
              marginBottom: '20px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ADAFBB" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search nests..."
              style={{
                flex: 1,
                border: 'none',
                backgroundColor: 'transparent',
                outline: 'none',
                fontSize: '14px',
                color: '#231429'
              }}
            />
          </div>

          {/* Suggested Nests Label */}
          <p
            style={{
              margin: 0,
              marginBottom: '16px',
              fontSize: '14px',
              fontWeight: 700,
              color: '#5B4AE6'
            }}
          >
            Suggested for you
          </p>

          {/* Nests Grid */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {nestsFeed.map(nest => {
              const isOwner = nest.isOwner || nest.ownerId === DEMO_CURRENT_USER_ID
              return (
                <div
                  key={nest.id}
                  onClick={() => navigate(`/nests/${nest.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '14px',
                    backgroundColor: '#FAFAFA',
                    borderRadius: '15px',
                    gap: '14px',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FAFAFA'}
                >
                  {/* Nest Image */}
                  <div
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '15px',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                  >
                    <img
                      src={nest.image}
                      alt={nest.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>

                  {/* Nest Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
                        {nest.name}
                      </p>
                      {isOwner && (
                        <span
                          style={{
                            fontSize: '9px',
                            fontWeight: 700,
                            color: '#059669',
                            backgroundColor: 'rgba(5, 150, 105, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '6px'
                          }}
                        >
                          Owner
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        marginTop: '2px',
                        fontSize: '12px',
                        color: '#ADAFBB',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {nest.description}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#ADAFBB' }}>
                        {nest.members} members
                      </span>
                      <span style={{ fontSize: '11px', color: '#ADAFBB' }}>•</span>
                      {nest.tags?.map((tag, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '10px',
                            color: '#5B4AE6',
                            backgroundColor: 'rgba(109, 93, 246, 0.1)',
                            padding: '2px 6px',
                            borderRadius: '8px'
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/nests/${nest.id}`)
                    }}
                    style={{
                      padding: '8px 18px',
                      backgroundColor: isOwner ? 'rgba(91, 74, 230, 0.1)' : '#5B4AE6',
                      color: isOwner ? '#5B4AE6' : 'white',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: '20px',
                      border: 'none',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    {isOwner ? 'Manage' : 'View'}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Create Nest CTA */}
          <div
            style={{
              marginTop: '24px',
              padding: '20px',
              backgroundColor: 'rgba(109, 93, 246, 0.05)',
              borderRadius: '15px',
              border: '2px dashed rgba(109, 93, 246, 0.15)',
              textAlign: 'center'
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#5B4AE6' }}>
              Can't find your community?
            </p>
            <button
              onClick={() => navigate('/create-nest')}
              style={{
                marginTop: '12px',
                padding: '10px 24px',
                backgroundColor: 'transparent',
                color: '#5B4AE6',
                fontSize: '14px',
                fontWeight: 700,
                borderRadius: '20px',
                border: '2px solid #5B4AE6',
                cursor: 'pointer'
              }}
            >
              Create a Nest
            </button>
          </div>
        </div>
      ) : null}

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}

function FilterIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
      <line x1="4" y1="6" x2="20" y2="6"/>
      <line x1="8" y1="12" x2="20" y2="12"/>
      <line x1="4" y1="18" x2="20" y2="18"/>
      <circle cx="6" cy="6" r="2" fill="#5B4AE6"/>
      <circle cx="10" cy="12" r="2" fill="#5B4AE6"/>
      <circle cx="6" cy="18" r="2" fill="#5B4AE6"/>
    </svg>
  )
}

export default DiscoverScreen
