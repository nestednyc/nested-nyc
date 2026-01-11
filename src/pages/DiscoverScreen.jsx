import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { getDiscoverProjects } from '../utils/projectData'

/**
 * DiscoverScreen - Projects Feed + Nests Discovery
 * Nested NYC – Student-only project network
 * 
 * Specs:
 * - Header: "Discover" title, NYC location, filter icon
 * - Tab bar: Projects | Nests
 * - Projects tab: Social media feed of project cards (includes user-created)
 * - Nests tab: Discover and join communities
 * - Bottom nav: 4 icons
 */

function DiscoverScreen() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('projects')
  const [projectsFeed, setProjectsFeed] = useState([])

  // Load projects from centralized store
  useEffect(() => {
    setProjectsFeed(getDiscoverProjects())
  }, [])
  
  // Legacy data (not used - projectsFeed comes from getDiscoverProjects)
  const _legacyProjects = [
    {
      id: 'proj-1-legacy',
      title: 'ClimateTech Dashboard',
      category: 'Sustainability × Data Viz',
      schools: ['NYU', 'Columbia'],
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=800&fit=crop',
      author: 'Marcus Chen',
      authorImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
      description: 'Building an interactive dashboard to visualize NYC climate data and track sustainability initiatives across campuses. We want to help students understand their environmental impact and find ways to reduce it together.',
      skillsNeeded: ['React', 'D3.js', 'Python', 'Data Viz'],
      spotsLeft: 3,
      team: [
        { name: 'Marcus Chen', school: 'NYU', role: 'Lead / Backend', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
        { name: 'Sofia Rodriguez', school: 'Columbia', role: 'Data Science', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop' },
      ]
    },
    {
      id: 2,
      title: 'AI Study Buddy',
      category: 'EdTech × ML',
      schools: ['Columbia'],
      image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=800&fit=crop',
      author: 'Priya Sharma',
      authorImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      description: 'An AI-powered study companion that helps students learn more effectively. Uses spaced repetition and personalized quizzes based on your course material.',
      skillsNeeded: ['Python', 'ML/AI', 'React Native', 'UI/UX'],
      spotsLeft: 2,
      team: [
        { name: 'Priya Sharma', school: 'Columbia', role: 'Lead / ML', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop' },
        { name: 'David Kim', school: 'Columbia', role: 'Backend', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop' },
        { name: 'Emma Wilson', school: 'Columbia', role: 'Design', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop' },
      ]
    },
    {
      id: 3,
      title: 'NYC Transit Tracker',
      category: 'Civic Tech × Mobile',
      schools: ['NYU', 'Parsons'],
      image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&h=800&fit=crop',
      author: 'Jake Morrison',
      authorImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
      description: 'Real-time NYC subway and bus tracking with crowd-sourced delay reports. Making commutes less stressful for students traveling across the city.',
      skillsNeeded: ['React Native', 'Node.js', 'APIs', 'UI/UX'],
      spotsLeft: 4,
      team: [
        { name: 'Jake Morrison', school: 'NYU', role: 'Lead / Mobile', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop' },
        { name: 'Lily Chen', school: 'Parsons', role: 'Design', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop' },
      ]
    },
    {
      id: 4,
      title: 'Campus Events App',
      category: 'Social × React Native',
      schools: ['Parsons', 'The New School'],
      image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=600&h=800&fit=crop',
      author: 'Aisha Patel',
      authorImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      description: 'Discover events happening across NYC campuses. From hackathons to art shows, never miss what\'s happening in the student community.',
      skillsNeeded: ['React Native', 'Firebase', 'UI/UX', 'Marketing'],
      spotsLeft: 2,
      team: [
        { name: 'Aisha Patel', school: 'Parsons', role: 'Lead / Design', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop' },
        { name: 'Tom Richards', school: 'The New School', role: 'Frontend', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop' },
        { name: 'Nina Santos', school: 'Parsons', role: 'Marketing', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop' },
      ]
    },
  ]
  
  // Discoverable nests
  const discoverableNests = [
    {
      id: 1,
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
        
        {/* Right: Filter Icon */}
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
      </div>
      
      {/* Tab Bar */}
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
      
      {/* Tab Content */}
      {activeTab === 'projects' ? (
        /* Projects Feed - Nest Card Style */
        <div 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            paddingBottom: '100px',
            padding: '16px'
          }}
        >
          {/* Search Projects (matching Nest search) */}
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
          
          {/* Projects List */}
          <div 
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {projectsFeed.map(project => (
              <div 
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  backgroundColor: '#FAFAFA',
                  borderRadius: '15px',
                  gap: '14px',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              >
                {/* Project Thumbnail */}
                <div 
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '15px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: project.isUserProject ? '2px solid #5B4AE6' : 'none'
                  }}
                >
                  <img 
                    src={project.image}
                    alt={project.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                
                {/* Project Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
                      {project.title}
                    </p>
                    {project.isUserProject && (
                      <span 
                        style={{
                          fontSize: '10px',
                          color: '#5B4AE6',
                          backgroundColor: 'rgba(109, 93, 246, 0.1)',
                          padding: '2px 6px',
                          borderRadius: '8px',
                          fontWeight: 600
                        }}
                      >
                        Your Project
                      </span>
                    )}
                  </div>
                  <p 
                    style={{ 
                      margin: 0, 
                      marginTop: '2px',
                      fontSize: '12px', 
                      color: '#ADAFBB',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {project.description || project.tagline || 'Building something awesome with fellow students'}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {/* Spots left count */}
                    {project.spotsLeft !== undefined && project.spotsLeft > 0 && (
                      <>
                        <span style={{ fontSize: '11px', color: '#ADAFBB' }}>
                          {project.spotsLeft} spots left
                        </span>
                        {(project.schools && project.schools.length > 0) || project.category ? (
                          <span style={{ fontSize: '11px', color: '#ADAFBB' }}>•</span>
                        ) : null}
                      </>
                    )}
                    {/* Schools */}
                    {project.schools && project.schools.length > 0 && (
                      <>
                        <span style={{ fontSize: '11px', color: '#ADAFBB' }}>
                          {project.schools.slice(0, 2).join(', ')}
                          {project.schools.length > 2 ? '...' : ''}
                        </span>
                        {project.category && (
                          <span style={{ fontSize: '11px', color: '#ADAFBB' }}>•</span>
                        )}
                      </>
                    )}
                    {/* Category Tag */}
                    {project.category && (
                      <span 
                        style={{
                          fontSize: '10px',
                          color: '#5B4AE6',
                          backgroundColor: 'rgba(109, 93, 246, 0.1)',
                          padding: '2px 6px',
                          borderRadius: '8px'
                        }}
                      >
                        {project.category}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Join/View Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/projects/${project.id}`)
                  }}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: project.isUserProject ? 'transparent' : '#5B4AE6',
                    color: project.isUserProject ? '#5B4AE6' : 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '20px',
                    border: project.isUserProject ? '1px solid #5B4AE6' : 'none',
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!project.isUserProject) {
                      e.currentTarget.style.backgroundColor = '#4A3CD4'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!project.isUserProject) {
                      e.currentTarget.style.backgroundColor = '#5B4AE6'
                    }
                  }}
                >
                  {project.isUserProject ? 'View' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Nests Discovery */
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
            {discoverableNests.map(nest => (
              <div 
                key={nest.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  backgroundColor: '#FAFAFA',
                  borderRadius: '15px',
                  gap: '14px'
                }}
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
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
                    {nest.name}
                  </p>
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
                    {nest.tags.map((tag, idx) => (
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
                
                {/* Join Button */}
                <button 
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#5B4AE6',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '20px',
                    border: 'none',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  Join
                </button>
              </div>
            ))}
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
      )}
      
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
