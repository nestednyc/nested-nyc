import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { getDiscoverProjects, getDiscoverProjectsAsync, getCurrentUserId } from '../utils/projectData'
import { getDiscoverNests, getDiscoverNestsAsync, DEMO_CURRENT_USER_ID } from '../utils/nestData'
import { SHOW_NESTS, SHOW_FILTERS } from '../config/features'

/**
 * DiscoverScreen - Projects Feed
 * Nested NYC – Student-only project network
 *
 * Clean card-based layout with project discovery
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

// Placeholder team members for projects without team data
const PLACEHOLDER_MEMBERS = [
  { name: 'Alex', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
  { name: 'Sarah', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
  { name: 'Jordan', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop' },
  { name: 'Maya', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop' },
]

// Get up to 4 members for facepile with names
function getProjectMembers(project) {
  if (project.team && project.team.length > 0) {
    return project.team.slice(0, 4).map(member => ({
      name: member.name.split(' ')[0],
      image: member.image
    }))
  }
  return PLACEHOLDER_MEMBERS.slice(0, 3)
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
  const [searchQuery, setSearchQuery] = useState('')

  // Load projects and nests from centralized store (with Supabase support)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      const userId = await getCurrentUserId()
      setCurrentUserId(userId)

      try {
        const projects = await getDiscoverProjectsAsync()
        setProjectsFeed(projects)
      } catch (err) {
        console.error('Error loading projects:', err)
        setProjectsFeed(getDiscoverProjects())
      }

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

      setLoading(false)
    }

    loadData()
  }, [])

  // Filter projects by search query
  const filteredProjects = projectsFeed.filter(project => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (project.title && project.title.toLowerCase().includes(q)) ||
      (project.description && project.description.toLowerCase().includes(q)) ||
      (project.tagline && project.tagline.toLowerCase().includes(q)) ||
      (project.category && project.category.toLowerCase().includes(q)) ||
      (project.tags && project.tags.some(t => t.toLowerCase().includes(q))) ||
      (project.schools && project.schools.some(s => s.toLowerCase().includes(q)))
    )
  })

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: '100px',
          padding: '16px 16px 100px 16px'
        }}
      >
        {/* NYC label */}
        <p
          style={{
            margin: 0,
            marginBottom: '8px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#9CA3AF',
            letterSpacing: '0.5px'
          }}
        >
          NYC
        </p>

        {/* Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            padding: '12px 16px',
            gap: '12px',
            marginBottom: '24px'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: '14px',
              color: '#111827'
            }}
          />
        </div>

        {/* Section Heading */}
        <h2
          style={{
            margin: 0,
            marginBottom: '16px',
            fontSize: '18px',
            fontWeight: 700,
            color: '#111827'
          }}
        >
          Projects for you
        </h2>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: '14px' }}>
            Loading projects...
          </div>
        )}

        {/* Projects List */}
        {!loading && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {filteredProjects.map(project => {
              const members = getProjectMembers(project)
              const locationText = project.schools && project.schools.length > 0
                ? project.schools.slice(0, 2).join(', ')
                : 'NYC'

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  style={{
                    padding: '16px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '12px',
                    border: '1px solid #E5E7EB',
                    cursor: 'pointer',
                    transition: 'box-shadow 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {/* Card Header: Icon + Name + Location */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                    {/* Project Icon */}
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        backgroundColor: '#6366F1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '22px',
                        flexShrink: 0
                      }}
                    >
                      {getProjectIcon(project.category)}
                    </div>

                    {/* Name + Location */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#111827'
                      }}>
                        {project.title}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span style={{ fontSize: '13px', color: '#6B7280' }}>
                          {locationText}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p
                    style={{
                      margin: 0,
                      marginBottom: '12px',
                      fontSize: '14px',
                      color: '#6B7280',
                      lineHeight: 1.5,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}
                  >
                    {project.description || project.tagline || 'Building something awesome with fellow students'}
                  </p>

                  {/* Tags Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {/* Category tag (purple) */}
                    {project.category && (
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#FFFFFF',
                          backgroundColor: '#6366F1',
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          fontWeight: 500
                        }}
                      >
                        {project.category}
                      </span>
                    )}
                    {/* Tech tags (gray) */}
                    {project.tags && project.tags.slice(0, 4).map((tag, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '12px',
                          color: '#4B5563',
                          backgroundColor: '#F3F4F6',
                          padding: '4px 12px',
                          borderRadius: '9999px',
                          fontWeight: 500
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid #E5E7EB', marginBottom: '12px' }} />

                  {/* Card Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    {/* Left: Facepile + Spots */}
                    <div>
                      {/* Facepile + Joined text */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {members.map((member, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                border: '2px solid white',
                                backgroundColor: '#E5E7EB',
                                marginLeft: idx > 0 ? '-8px' : 0,
                                overflow: 'hidden',
                                position: 'relative',
                                zIndex: 4 - idx
                              }}
                            >
                              <img
                                src={member.image}
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
                        <span style={{
                          fontSize: '12px',
                          color: '#6B7280'
                        }}>
                          {getJoinedByText(members)}
                        </span>
                      </div>

                      {/* Spots open */}
                      {project.spotsLeft !== undefined && project.spotsLeft > 0 && (
                        <span style={{
                          fontSize: '12px',
                          color: '#22C55E',
                          fontWeight: 600
                        }}>
                          {project.spotsLeft} spots open
                        </span>
                      )}
                    </div>

                    {/* Right: Join button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/projects/${project.id}`)
                      }}
                      style={{
                        padding: '8px 20px',
                        backgroundColor: '#6366F1',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 600,
                        borderRadius: '20px',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4F46E5'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#6366F1'}
                    >
                      Join
                      <span style={{ fontSize: '14px' }}>&rarr;</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state for search */}
        {!loading && filteredProjects.length === 0 && searchQuery.trim() && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF', fontSize: '14px' }}>
            No projects found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}

export default DiscoverScreen
