import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { getDiscoverProjects } from '../utils/projectData'
import { getDiscoverNests, DEMO_CURRENT_USER_ID } from '../utils/nestData'
import { SHOW_NESTS, SHOW_FILTERS } from '../config/features'

/**
 * DiscoverScreen - Projects Feed + Nests Discovery
 * Nested NYC – Student-only project network
 * 
 * Text-first project cards - no stock images
 * Clean, scannable layout for MVP demo
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
      name: member.name.split(' ')[0], // First name only
      image: member.image
    }))
  }
  // Return placeholder members for demo
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

  // Load projects and nests from centralized store
  useEffect(() => {
    setProjectsFeed(getDiscoverProjects())
    setNestsFeed(getDiscoverNests())
  }, [])
  
  // Legacy static nests (now using dynamic nestsFeed)
  const discoverableNests = [
    {
      id: 'nest-legacy-1',
      name: 'NYU Builders',
      description: 'Build cool stuff with NYU students',
      members: 248,
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&h=200&fit=crop',
      tags: ['Tech', 'Startups']
    },
    {
      id: 2,
      name: 'Columbia AI',
      description: 'ML research & projects at Columbia',
      members: 156,
      image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=200&h=200&fit=crop',
      tags: ['AI', 'Research']
    },
    {
      id: 3,
      name: 'NYC Design',
      description: 'Designers across NYC schools',
      members: 312,
      image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=200&h=200&fit=crop',
      tags: ['Design', 'UI/UX']
    },
    {
      id: 4,
      name: 'Startup Founders',
      description: 'Student entrepreneurs building companies',
      members: 89,
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=200&h=200&fit=crop',
      tags: ['Business', 'Startups']
    },
    {
      id: 5,
      name: 'Data Science NYC',
      description: 'Analytics & data projects',
      members: 124,
      image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=200&h=200&fit=crop',
      tags: ['Data', 'Python']
    },
    {
      id: 6,
      name: 'Creative Coders',
      description: 'Art meets technology',
      members: 67,
      image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=200&h=200&fit=crop',
      tags: ['Creative', 'Code']
    },
  ]

  return (
    <div className="flex flex-col h-full bg-white relative">
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
        /* Projects Feed - Text-First Layout */
        <div 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            paddingBottom: '100px',
            padding: '16px'
          }}
        >
          {/* Search Projects */}
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
              placeholder="Search projects..."
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
          
          {/* Featured Project Section */}
          {(() => {
            const featuredProject = projectsFeed.find(p => p.isUserProject)
            if (!featuredProject) return null
            
            const members = getProjectMembers(featuredProject)
            
            return (
              <div style={{ marginBottom: '24px' }}>
                <p style={{ 
                  margin: 0, 
                  marginBottom: '12px', 
                  fontSize: '14px', 
                  fontWeight: 700, 
                  color: '#5B4AE6' 
                }}>
                  Your Project
                </p>
                <div
                  onClick={() => navigate(`/projects/${featuredProject.id}`)}
                  style={{
                    padding: '17px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(91, 74, 230, 0.08) 0%, rgba(91, 74, 230, 0.03) 100%)',
                    border: '1px solid rgba(91, 74, 230, 0.15)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(91, 74, 230, 0.15)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {/* Top Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    {/* Left: Icon + Content */}
                    <div style={{ display: 'flex', gap: '14px', flex: 1, minWidth: 0 }}>
                      {/* Project Icon */}
                      <div
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: '14px',
                          backgroundColor: 'rgba(91, 74, 230, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '26px',
                          flexShrink: 0
                        }}
                      >
                        {getProjectIcon(featuredProject.category)}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Title + Featured Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <h3 style={{ 
                            margin: 0, 
                            fontSize: '18px', 
                            fontWeight: 700, 
                            color: '#111827' 
                          }}>
                            {featuredProject.title}
                          </h3>
                          <span 
                            style={{
                              fontSize: '10px',
                              color: 'white',
                              backgroundColor: '#5B4AE6',
                              padding: '3px 10px',
                              borderRadius: '10px',
                              fontWeight: 600
                            }}
                          >
                            Featured
                          </span>
                        </div>

                        {/* Description */}
                        <p 
                          style={{ 
                            margin: 0, 
                            marginTop: '6px',
                            fontSize: '13px', 
                            color: '#6B7280',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.5
                          }}
                        >
                          {featuredProject.description || featuredProject.tagline || 'Building something awesome with fellow students'}
                        </p>

                        {/* Tags */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                          {featuredProject.category && (
                            <span 
                              style={{
                                fontSize: '11px',
                                color: '#5B4AE6',
                                backgroundColor: 'rgba(91, 74, 230, 0.1)',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontWeight: 500
                              }}
                            >
                              {featuredProject.category}
                            </span>
                          )}
                          {featuredProject.spotsLeft > 0 && (
                            <span 
                              style={{
                                fontSize: '11px',
                                color: '#059669',
                                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontWeight: 500
                              }}
                            >
                              {featuredProject.spotsLeft} spots open
                            </span>
                          )}
                          {featuredProject.schools && featuredProject.schools[0] && (
                            <span 
                              style={{
                                fontSize: '11px',
                                color: '#6B7280',
                                backgroundColor: '#F3F4F6',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontWeight: 500
                              }}
                            >
                              {featuredProject.schools[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Facepile + Button */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px', flexShrink: 0 }}>
                      {/* Facepile */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {members.map((member, idx) => (
                            <div
                              key={idx}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                border: '2px solid white',
                                backgroundColor: '#E5E7EB',
                                marginLeft: idx > 0 ? '-10px' : 0,
                                overflow: 'hidden',
                                position: 'relative',
                                zIndex: 4 - idx,
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
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
                          fontSize: '10px', 
                          color: '#6B7280',
                          whiteSpace: 'nowrap'
                        }}>
                          {getJoinedByText(members)}
                        </span>
                      </div>

                      {/* View Project Button */}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/projects/${featuredProject.id}`)
                        }}
                        style={{
                          padding: '10px 20px',
                          backgroundColor: '#5B4AE6',
                          color: 'white',
                          fontSize: '13px',
                          fontWeight: 600,
                          borderRadius: '20px',
                          border: 'none',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4A3CD4'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5B4AE6'}
                      >
                        View Project
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}
          
          {/* All Projects Label */}
          <p style={{ 
            margin: 0, 
            marginBottom: '12px', 
            fontSize: '14px', 
            fontWeight: 700, 
            color: '#5B4AE6' 
          }}>
            All Projects
          </p>

          {/* Projects List - Text First */}
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            {projectsFeed.filter(p => !p.isUserProject).map(project => (
              <div 
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                style={{
                  padding: '14px',
                  backgroundColor: project.isUserProject ? 'rgba(91, 74, 230, 0.04)' : '#FFFFFF',
                  borderRadius: '14px',
                  border: project.isUserProject ? '1px solid rgba(91, 74, 230, 0.2)' : '1px solid #E5E7EB',
                  borderLeft: '4px solid #5B4AE6',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#5B4AE6'
                  e.currentTarget.style.boxShadow = project.isUserProject 
                    ? '0 2px 12px rgba(91, 74, 230, 0.15)' 
                    : '0 2px 8px rgba(91, 74, 230, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = project.isUserProject ? 'rgba(91, 74, 230, 0.2)' : '#E5E7EB'
                  e.currentTarget.style.borderLeftColor = '#5B4AE6'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Top Row: Icon + Title + Badge */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  {/* Project Icon */}
                <div 
                  style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(91, 74, 230, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      flexShrink: 0
                    }}
                  >
                    {getProjectIcon(project.category)}
                </div>
                
                  {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Title Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#111827' }}>
                      {project.title}
                    </p>
                    {project.isUserProject && (
                      <span 
                        style={{
                          fontSize: '10px',
                          color: '#5B4AE6',
                            backgroundColor: 'rgba(91, 74, 230, 0.1)',
                            padding: '3px 8px',
                            borderRadius: '10px',
                          fontWeight: 600
                        }}
                      >
                        Your Project
                      </span>
                    )}
                  </div>

                    {/* Description */}
                  <p 
                    style={{ 
                      margin: 0, 
                        marginTop: '4px',
                        fontSize: '13px', 
                        color: '#6B7280',
                      display: '-webkit-box',
                        WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                        lineHeight: 1.4
                    }}
                  >
                    {project.description || project.tagline || 'Building something awesome with fellow students'}
                  </p>

                    {/* Metadata Row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', flexWrap: 'wrap' }}>
                      {/* Spots left */}
                    {project.spotsLeft !== undefined && project.spotsLeft > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                          </svg>
                          <span style={{ fontSize: '11px', color: '#5B4AE6', fontWeight: 500 }}>
                            {project.spotsLeft} spots
                        </span>
                        </div>
                      )}

                      {/* Location */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                          <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span style={{ fontSize: '11px', color: '#6B7280' }}>
                          {project.schools && project.schools.length > 0 
                            ? project.schools.slice(0, 1).join(', ')
                            : 'NYC'}
                        </span>
                      </div>

                    {/* Category Tag */}
                    {project.category && (
                      <span 
                        style={{
                          fontSize: '10px',
                          color: '#5B4AE6',
                            backgroundColor: 'rgba(91, 74, 230, 0.1)',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontWeight: 500
                        }}
                      >
                        {project.category}
                      </span>
                    )}
                  </div>
                </div>

                  {/* Right side: Facepile + Button */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                    {/* Facepile */}
                    {(() => {
                      const members = getProjectMembers(project)
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
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
                            fontSize: '10px', 
                            color: '#9CA3AF',
                            whiteSpace: 'nowrap'
                          }}>
                            {getJoinedByText(members)}
                          </span>
                        </div>
                      )
                    })()}
                
                {/* Join/View Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/projects/${project.id}`)
                  }}
                  style={{
                        padding: '8px 16px',
                    backgroundColor: project.isUserProject ? 'transparent' : '#5B4AE6',
                    color: project.isUserProject ? '#5B4AE6' : 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '20px',
                        border: project.isUserProject ? '1.5px solid #5B4AE6' : 'none',
                    cursor: 'pointer',
                        transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!project.isUserProject) {
                      e.currentTarget.style.backgroundColor = '#4A3CD4'
                        } else {
                          e.currentTarget.style.backgroundColor = 'rgba(91, 74, 230, 0.1)'
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
                </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Create Project CTA */}
          <div 
            style={{
              marginTop: '24px',
              padding: '24px 20px',
              backgroundColor: 'rgba(91, 74, 230, 0.05)',
              borderRadius: '15px',
              border: '2px dashed rgba(91, 74, 230, 0.15)',
              textAlign: 'center'
            }}
          >
            <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#5B4AE6' }}>
              Can't find a project to join?
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#9CA3AF' }}>
              Start your own and find teammates.
            </p>
            <button 
              onClick={() => navigate('/create-project')}
              style={{
                marginTop: '16px',
                padding: '12px 28px',
                backgroundColor: '#5B4AE6',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4A3CD4'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5B4AE6'}
            >
              Create a Project
            </button>
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
                      if (isOwner) {
                        navigate(`/nests/${nest.id}`)
                      } else {
                        navigate(`/nests/${nest.id}`)
                      }
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
