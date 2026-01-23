import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProjectById, DEMO_CURRENT_USER_ID } from '../utils/projectData'

/**
 * ProfileDetailScreen - Project Detail View
 * Nested NYC – Student-only project network
 * 
 * Desktop: Two-column layout (content left, CTA right)
 * Mobile: Single column with sticky bottom CTA
 */

// Mock pending join requests (for demo/MVP)
const MOCK_PENDING_REQUESTS = [
  {
    id: 'req-1',
    name: 'Jordan Lee',
    school: 'NYU Tandon',
    role: 'Frontend Developer',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop',
    requestedAt: '2 days ago'
  },
  {
    id: 'req-2',
    name: 'Samantha Wright',
    school: 'Columbia Engineering',
    role: 'UI/UX Designer',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    requestedAt: '3 days ago'
  },
  {
    id: 'req-3',
    name: 'Alex Chen',
    school: 'Parsons',
    role: 'Product Manager',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    requestedAt: '1 week ago'
  }
]

function ProfileDetailScreen() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [isDesktop, setIsDesktop] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isRequested, setIsRequested] = useState(false)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingRequests, setPendingRequests] = useState(MOCK_PENDING_REQUESTS)
  const [showJoinModal, setShowJoinModal] = useState(false)

  // Handle accept/decline actions (UI only)
  const handleAcceptRequest = (requestId) => {
    setPendingRequests(prev => prev.filter(r => r.id !== requestId))
    // In production, this would call an API
    console.log('Accepted request:', requestId)
  }

  const handleDeclineRequest = (requestId) => {
    setPendingRequests(prev => prev.filter(r => r.id !== requestId))
    // In production, this would call an API
    console.log('Declined request:', requestId)
  }

  // Responsive check
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  
  // Load project by ID
  useEffect(() => {
    if (projectId) {
      const foundProject = getProjectById(projectId)
      setProject(foundProject)
    }
    setLoading(false)
  }, [projectId])

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

  // Check if current user is the project owner
  const isOwner = project?.isOwner || project?.ownerId === DEMO_CURRENT_USER_ID

  // Project not found state
  if (!project) {
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
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
          Project not found
        </h2>
        <p style={{ margin: '8px 0 24px 0', fontSize: '14px', color: '#6B7280' }}>
          This project may have been removed or the link is incorrect.
        </p>
        <button 
          onClick={() => navigate('/discover')}
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
          Browse Projects
        </button>
      </div>
    )
  }

  // Desktop Layout
  if (isDesktop) {
    // Determine commitment level from category
    const getCommitmentLevel = () => {
      const cat = (project.category || '').toLowerCase()
      if (cat.includes('hackathon')) return { type: 'Hackathon', hours: '48 hours' }
      if (cat.includes('startup')) return { type: 'Startup Mode', hours: '15–20 hrs/week' }
      if (cat.includes('side') || cat.includes('project')) return { type: 'Side Project', hours: '5–10 hrs/week' }
      return { type: 'Side Project', hours: '5–10 hrs/week' } // Default
    }
    const commitment = getCommitmentLevel()

    return (
      <>
      <div className="project-detail-desktop">
        {/* Back Button - Desktop */}
        <div className="project-detail-back">
          <button 
            onClick={() => navigate(-1)}
            className="back-btn-desktop"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to projects
          </button>
        </div>

        <div className="project-detail-layout">
          {/* Left Column - Main Content */}
          <div className="project-detail-main">
            {/* Project Header - Text First */}
            <div className="project-detail-header-text">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                {/* Optional Small Icon/Avatar */}
                <div 
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(91, 74, 230, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h1 className="project-detail-title-text" style={{ margin: 0 }}>{project.title}</h1>
                    
                    {/* Owner Badge */}
                    {isOwner && (
                      <span 
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#059669',
                          backgroundColor: 'rgba(5, 150, 105, 0.1)',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          flexShrink: 0
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Owner
                      </span>
                    )}
                  </div>
                  
                  {/* Inline Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                    {/* Location Badge */}
                    <span 
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#6B7280',
                        backgroundColor: '#F3F4F6',
                        padding: '6px 12px',
                        borderRadius: '12px'
                      }}
                    >
                      NYC
                    </span>
                    
                    {/* Category Badge */}
                    {project.category && (
                      <span 
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#5B4AE6',
                          backgroundColor: 'rgba(91, 74, 230, 0.1)',
                          padding: '6px 12px',
                          borderRadius: '12px'
                        }}
                      >
                        {project.category}
                      </span>
                    )}
                    
                    {/* Status Badge */}
                    <span 
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#059669',
                        backgroundColor: 'rgba(5, 150, 105, 0.1)',
                        padding: '6px 12px',
                        borderRadius: '12px'
                      }}
                    >
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* About Section - Single source of truth for description */}
            {project.description ? (
              <div className="project-detail-section">
                <h3 className="section-title-desktop">About this project</h3>
                <p className="project-description-desktop" style={{ lineHeight: '1.8', marginBottom: 0 }}>
                  {project.description}
                </p>
              </div>
            ) : (
              <div className="project-detail-section">
                <h3 className="section-title-desktop">About this project</h3>
                <p style={{ fontSize: '14px', color: '#9CA3AF', margin: 0, fontStyle: 'italic' }}>
                  No project description provided yet.
                </p>
              </div>
            )}

            {/* Looking For Section */}
            <div className="project-detail-section">
              <h3 className="section-title-desktop">Looking for</h3>
              <div className="skills-grid-desktop">
                {project.skillsNeeded && project.skillsNeeded.length > 0 ? (
                  project.skillsNeeded.map((skill, index) => (
                    <span key={index} className="skill-tag-desktop">
                      {skill}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '14px', color: '#9CA3AF' }}>No specific roles listed yet</span>
                )}
              </div>
            </div>

            {/* Commitment Level Section */}
            <div className="project-detail-section">
              <h3 className="section-title-desktop">Commitment Level</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div 
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(91, 74, 230, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827' }}>
                      {commitment.type}
                    </p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#6B7280' }}>
                      {commitment.hours}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Section */}
            {project.team && project.team.length > 0 && (
              <div className="project-detail-section">
                <div className="team-header-desktop">
                  <h3 className="section-title-desktop">Meet the team</h3>
                  <span className="team-count-desktop">
                    {project.team.length} {project.team.length === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <div className="team-grid-desktop">
                  {project.team.map((member, index) => (
                    <div key={index} className="team-card-desktop">
                      {/* Use icon instead of image for builder-focused design */}
                      <div 
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '14px',
                          backgroundColor: 'rgba(91, 74, 230, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                      </div>
                      <div className="team-info-desktop">
                        <p className="team-name-desktop">{member.name}</p>
                        <p className="team-school-desktop">{member.school}</p>
                      </div>
                      <span className="team-role-desktop">{member.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Requests Section - Owner Only */}
            {isOwner && pendingRequests.length > 0 && (
              <div className="project-detail-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 className="section-title-desktop" style={{ margin: 0 }}>Pending Requests</h3>
                  <span style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#F59E0B',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderRadius: '12px'
                  }}>
                    {pendingRequests.length} pending
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {pendingRequests.map((request) => (
                    <div 
                      key={request.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '14px',
                        backgroundColor: '#FAFAFA',
                        borderRadius: '12px',
                        border: '1px solid #F3F4F6',
                        gap: '14px'
                      }}
                    >
                      {/* Clickable Avatar + Info - navigates to user profile */}
                      <div
                        onClick={() => navigate(`/profile/${request.id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          flex: 1,
                          minWidth: 0,
                          cursor: 'pointer'
                        }}
                      >
                        {/* Avatar */}
                        <img 
                          src={request.avatar}
                          alt={request.name}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '12px',
                            objectFit: 'cover',
                            flexShrink: 0,
                            transition: 'transform 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        />
                        
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ 
                            margin: 0, 
                            fontSize: '14px', 
                            fontWeight: 600, 
                            color: '#111827',
                            transition: 'color 0.15s ease'
                          }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#5B4AE6'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#111827'}
                          >
                            {request.name}
                          </p>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6B7280' }}>
                            {request.school}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                            <span style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              fontWeight: 500,
                              borderRadius: '6px',
                              backgroundColor: '#E0E7FF',
                              color: '#4338CA'
                            }}>
                              {request.role}
                            </span>
                          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                            {request.requestedAt}
                          </span>
                        </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        <button
                          onClick={() => handleDeclineRequest(request.id)}
                          style={{
                            padding: '8px 14px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#6B7280',
                            backgroundColor: 'white',
                            border: '1px solid #E5E7EB',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#FEE2E2'
                            e.currentTarget.style.borderColor = '#FECACA'
                            e.currentTarget.style.color = '#DC2626'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white'
                            e.currentTarget.style.borderColor = '#E5E7EB'
                            e.currentTarget.style.color = '#6B7280'
                          }}
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleAcceptRequest(request.id)}
                          style={{
                            padding: '8px 14px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'white',
                            backgroundColor: '#059669',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            transition: 'background-color 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#047857'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                        >
                          Accept
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team Communication Section - MVP */}
            <div className="project-detail-section">
              <h3 className="section-title-desktop">Team Communication</h3>
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '16px', lineHeight: 1.5 }}>
                Primary communication happens off-platform for now. Join the team's preferred channels to collaborate.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {/* Discord Link */}
                <a
                  href="https://discord.gg/nested-nyc"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: '#5865F2',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    textDecoration: 'none',
                    transition: 'opacity 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                  </svg>
                  Open Discord
                </a>

                {/* GitHub Link */}
                <a
                  href="https://github.com/nested-nyc"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: '#24292F',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    textDecoration: 'none',
                    transition: 'opacity 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  View GitHub Repo
                </a>

                {/* Slack Link (secondary style) */}
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); alert('Slack invite link would go here') }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: '#F3F4F6',
                    color: '#374151',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    textDecoration: 'none',
                    border: '1px solid #E5E7EB',
                    transition: 'background-color 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#E5E7EB'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
                  </svg>
                  Join Slack
                </a>
              </div>
            </div>
          </div>

          {/* Right Column - Action Card */}
          <div className="project-detail-sidebar">
            <div className="project-cta-card">
              {/* Spots Left Indicator */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                paddingBottom: '20px', 
                borderBottom: '1px solid #E5E7EB',
                marginBottom: '20px'
              }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '14px',
                  backgroundColor: '#5B4AE6',
                  color: 'white',
                  fontSize: '24px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {project.spotsLeft || 0}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                    {project.spotsLeft === 1 ? 'Spot' : 'Spots'} left
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6B7280' }}>
                    Open positions
                  </p>
                </div>
              </div>

              {isOwner ? (
                /* Owner Actions */
                <>
                  {/* Primary: Edit Project */}
                  <button 
                    className="join-btn-desktop"
                    onClick={() => navigate(`/projects/${projectId}/edit`)}
                    style={{
                      width: '100%',
                      marginBottom: '12px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    Edit Project
                  </button>

                  {/* Secondary Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                    <button 
                      className="save-btn-desktop"
                      onClick={() => navigate(`/projects/${projectId}/invite`)}
                      style={{ width: '100%' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="8.5" cy="7" r="4"/>
                        <line x1="20" y1="8" x2="20" y2="14"/>
                        <line x1="23" y1="11" x2="17" y2="11"/>
                      </svg>
                      Invite Members
                    </button>
                    
                    <button 
                      className="save-btn-desktop"
                      onClick={() => navigate(`/projects/${projectId}/requests`)}
                      style={{ width: '100%' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                      </svg>
                      View Requests
                    </button>
                  </div>
                </>
              ) : (
                /* Non-Owner Actions */
                <>
                  {/* Primary CTA Button */}
                  <button
                    className={`join-btn-desktop ${isRequested ? 'requested' : ''}`}
                    onClick={() => !isRequested && setShowJoinModal(true)}
                    disabled={isRequested}
                    style={{
                      width: '100%',
                      marginBottom: isRequested ? '8px' : '12px',
                      opacity: isRequested ? 0.7 : 1,
                      cursor: isRequested ? 'default' : 'pointer',
                      backgroundColor: isRequested ? '#9CA3AF' : undefined
                    }}
                  >
                    {isRequested ? (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Request sent
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                          <circle cx="8.5" cy="7" r="4"/>
                          <line x1="20" y1="8" x2="20" y2="14"/>
                          <line x1="23" y1="11" x2="17" y2="11"/>
                        </svg>
                        Request to Join
                      </>
                    )}
                  </button>
                  
                  {/* Helper text after request sent */}
                  {isRequested && (
                    <p style={{
                      margin: 0,
                      marginBottom: '12px',
                      fontSize: '12px',
                      color: '#6B7280',
                      textAlign: 'center',
                      lineHeight: 1.4
                    }}>
                      The project owner will review your request.
                    </p>
                  )}

                  {/* Secondary Button */}
                  <button 
                    className={`save-btn-desktop ${isSaved ? 'saved' : ''}`}
                    onClick={() => setIsSaved(!isSaved)}
                    style={{
                      width: '100%',
                      marginBottom: '24px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                    {isSaved ? 'Saved' : 'Save for later'}
                  </button>
                </>
              )}

              {/* Metadata Section */}
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '16px', 
                paddingTop: '20px',
                borderTop: '1px solid #E5E7EB',
                marginBottom: '24px'
              }}>
                {/* Team Members */}
                <div className="quick-info-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <span>{project.team?.length || 0} team {project.team?.length === 1 ? 'member' : 'members'}</span>
                </div>
                
                {/* Status */}
                <div className="quick-info-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>Active</span>
                </div>
                
                {/* Location */}
                <div className="quick-info-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span>NYC area</span>
                </div>
              </div>

              {/* Share Section */}
              <div style={{
                paddingTop: '20px',
                borderTop: '1px solid #E5E7EB'
              }}>
                <h4 style={{ 
                  margin: 0, 
                  marginBottom: '12px', 
                  fontSize: '14px', 
                  fontWeight: 600, 
                  color: '#111827' 
                }}>
                  Share this project
                </h4>
                <div className="share-buttons">
                  <button 
                    className="share-btn" 
                    title="Copy link"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href)
                      // Could add toast notification here
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                  </button>
                  <button 
                    className="share-btn" 
                    title="Share on LinkedIn"
                    onClick={() => {
                      const url = encodeURIComponent(window.location.href)
                      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank')
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </button>
                  <button 
                    className="share-btn" 
                    title="Share on X (Twitter)"
                    onClick={() => {
                      const url = encodeURIComponent(window.location.href)
                      const text = encodeURIComponent(`Check out this project: ${project.title}`)
                      window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank')
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Join Request Modal - Desktop */}
      {showJoinModal && (
        <JoinRequestModal
          project={project}
          onClose={() => setShowJoinModal(false)}
          onSubmit={(formData) => {
            setIsRequested(true)
            setShowJoinModal(false)
          }}
        />
      )}
      </>
    )
  }

  // Mobile Layout (unchanged)
  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }}>
        {/* Hero Image Section */}
        <div style={{ position: 'relative', height: '280px', flexShrink: 0 }}>
          <img 
            src={project.image}
            alt={project.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
          
          {/* Back Button */}
          <button 
            onClick={() => navigate(-1)}
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
          
          {/* Bottom Gradient */}
          <div 
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '120px',
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)'
            }}
          />
          
          {/* Category Badge */}
          <div 
            style={{
              position: 'absolute',
              top: '48px',
              right: '20px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '20px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#5B4AE6',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            {project.category}
          </div>
          
          {/* Project Title Overlay */}
          <div 
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              right: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 
                style={{ 
                  margin: 0,
                  fontSize: '24px',
                  fontWeight: 700,
                  color: 'white'
                }}
              >
                {project.title}
              </h1>
              
              {/* Owner Badge - Mobile */}
              {isOwner && (
                <span 
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'white',
                    backgroundColor: 'rgba(5, 150, 105, 0.9)',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Owner
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Content Section */}
        <div style={{ padding: '20px' }}>
          {/* Schools + Spots Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {project.schools.map((school, idx) => (
                <span 
                  key={idx}
                  style={{
                    backgroundColor: '#5B4AE6',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 600,
                    padding: '5px 12px',
                    borderRadius: '20px'
                  }}
                >
                  {school}
                </span>
              ))}
            </div>
            <span 
              style={{
                backgroundColor: 'rgba(109, 93, 246, 0.1)',
                color: '#5B4AE6',
                fontSize: '12px',
                fontWeight: 600,
                padding: '5px 10px',
                borderRadius: '8px'
              }}
            >
              {project.spotsLeft} {project.spotsLeft === 1 ? 'spot' : 'spots'} left
            </span>
          </div>
          
          {/* About Section - Single source of truth for description */}
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
              About this project
            </h3>
            {project.description ? (
              <p style={{ 
                margin: 0, 
                marginTop: '8px', 
                fontSize: '14px', 
                color: '#666', 
                lineHeight: 1.6 
              }}>
                {project.description}
              </p>
            ) : (
              <p style={{ 
                margin: 0, 
                marginTop: '8px', 
                fontSize: '14px', 
                color: '#9CA3AF', 
                fontStyle: 'italic'
              }}>
                No project description provided yet.
              </p>
            )}
          </div>
          
          {/* Skills Needed */}
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
              Skills needed
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
              {project.skillsNeeded?.map((skill, index) => (
                <span 
                  key={index}
                  style={{
                    backgroundColor: '#FAFAFA',
                    color: '#231429',
                    border: '1px solid #E5E7EB',
                    fontSize: '13px',
                    fontWeight: 500,
                    padding: '8px 14px',
                    borderRadius: '20px'
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
          
          {/* Team Section */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
                Meet the team
              </h3>
              <span style={{ fontSize: '13px', color: '#ADAFBB' }}>
                {project.team?.length || 0} {(project.team?.length || 0) === 1 ? 'member' : 'members'}
              </span>
            </div>
            
            {/* Team Member Cards */}
            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {project.team?.map((member, index) => (
                <div 
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: '#FAFAFA',
                    borderRadius: '14px',
                    gap: '12px'
                  }}
                >
                  {/* Member Photo */}
                  <div 
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      overflow: 'hidden',
                      flexShrink: 0
                    }}
                  >
                    <img 
                      src={member.image}
                      alt={member.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  
                  {/* Member Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#231429' }}>
                      {member.name}
                    </p>
                    <p style={{ margin: 0, marginTop: '2px', fontSize: '12px', color: '#ADAFBB' }}>
                      {member.school}
                    </p>
                  </div>
                  
                  {/* Role Badge */}
                  <span 
                    style={{
                      backgroundColor: 'rgba(109, 93, 246, 0.1)',
                      color: '#5B4AE6',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: '12px',
                      flexShrink: 0
                    }}
                  >
                    {member.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Requests Section - Owner Only (Mobile) */}
          {isOwner && pendingRequests.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
                  Pending Requests
                </h3>
                <span style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#F59E0B',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderRadius: '10px'
                }}>
                  {pendingRequests.length} pending
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {pendingRequests.map((request) => (
                  <div 
                    key={request.id}
                    style={{
                      padding: '12px',
                      backgroundColor: '#FAFAFA',
                      borderRadius: '14px',
                      border: '1px solid #F3F4F6'
                    }}
                  >
                    {/* Top Row: Avatar + Info - clickable to navigate to profile */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                      <div
                        onClick={() => navigate(`/profile/${request.id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          flex: 1,
                          minWidth: 0,
                          cursor: 'pointer'
                        }}
                      >
                        <img 
                          src={request.avatar}
                          alt={request.name}
                          style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            objectFit: 'cover',
                            flexShrink: 0
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#231429' }}>
                            {request.name}
                          </p>
                          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#ADAFBB' }}>
                            {request.school}
                          </p>
                        </div>
                      </div>
                      <span style={{
                        padding: '3px 8px',
                        fontSize: '10px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        backgroundColor: '#E0E7FF',
                        color: '#4338CA',
                        flexShrink: 0
                      }}>
                        {request.role}
                      </span>
                    </div>
                    
                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleDeclineRequest(request.id)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#6B7280',
                          backgroundColor: 'white',
                          border: '1px solid #E5E7EB',
                          borderRadius: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => handleAcceptRequest(request.id)}
                        style={{
                          flex: 1,
                          padding: '10px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'white',
                          backgroundColor: '#059669',
                          border: 'none',
                          borderRadius: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Communication Section - MVP (Mobile) */}
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
              Team Communication
            </h3>
            <p style={{ 
              margin: 0, 
              marginTop: '8px', 
              marginBottom: '14px',
              fontSize: '13px', 
              color: '#6B7280', 
              lineHeight: 1.5 
            }}>
              Primary communication happens off-platform for now.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Discord */}
              <a
                href="https://discord.gg/nested-nyc"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  backgroundColor: '#5865F2',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '12px',
                  textDecoration: 'none'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                Open Discord
              </a>
              {/* GitHub */}
              <a
                href="https://github.com/nested-nyc"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 14px',
                  backgroundColor: '#24292F',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '12px',
                  textDecoration: 'none'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                View GitHub Repo
              </a>
            </div>
          </div>
        </div>
      </div>
      
      {/* Sticky Bottom CTA - Mobile Only */}
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
        {isOwner ? (
          /* Owner Actions - Mobile */
          <>
            {/* Edit Project Button - Full Width */}
            <button 
              onClick={() => navigate(`/projects/${projectId}/edit`)}
              style={{
                flex: 1,
                height: '52px',
                backgroundColor: '#5B4AE6',
                color: 'white',
                fontSize: '16px',
                fontWeight: 600,
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit Project
            </button>
          </>
        ) : (
          /* Non-Owner Actions - Mobile */
          <>
            {/* Save Button */}
            <button 
              onClick={() => setIsSaved(!isSaved)}
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                border: '1.5px solid #E5E7EB',
                backgroundColor: isSaved ? 'rgba(91, 74, 230, 0.1)' : 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill={isSaved ? '#5B4AE6' : 'none'} stroke={isSaved ? '#5B4AE6' : '#231429'} strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </button>
            
            {/* Request to Join Button */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={() => !isRequested && setShowJoinModal(true)}
                disabled={isRequested}
                style={{
                  width: '100%',
                  height: '52px',
                  backgroundColor: isRequested ? '#9CA3AF' : '#5B4AE6',
                  color: 'white',
                  fontSize: '16px',
                  fontWeight: 600,
                  borderRadius: '14px',
                  border: 'none',
                  cursor: isRequested ? 'default' : 'pointer',
                  opacity: isRequested ? 0.85 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isRequested ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Request sent
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="8.5" cy="7" r="4"/>
                      <line x1="20" y1="8" x2="20" y2="14"/>
                      <line x1="23" y1="11" x2="17" y2="11"/>
                    </svg>
                    Request to Join
                  </>
                )}
              </button>
              {isRequested && (
                <p style={{
                  margin: 0,
                  fontSize: '11px',
                  color: '#6B7280',
                  textAlign: 'center'
                }}>
                  The project owner will review your request.
                </p>
              )}
            </div>
          </>
        )}
      </div>
      
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

      {/* Join Request Modal - Mobile */}
      {showJoinModal && (
        <JoinRequestModal
          project={project}
          onClose={() => setShowJoinModal(false)}
          onSubmit={(formData) => {
            setIsRequested(true)
            setShowJoinModal(false)
          }}
        />
      )}
    </div>
  )
}

/**
 * JoinRequestModal - Fresh, Gen Z-focused modal for joining projects
 * Clean, spacious design with project name as hero element
 */
function JoinRequestModal({ project, onClose, onSubmit }) {
  const [selectedRole, setSelectedRole] = useState('')
  const [aboutYourself, setAboutYourself] = useState('')
  const [isRoleFocused, setIsRoleFocused] = useState(false)
  const [isTextareaFocused, setIsTextareaFocused] = useState(false)

  const isValid = selectedRole && aboutYourself.length >= 20 && aboutYourself.length <= 300
  const charCount = aboutYourself.length

  const handleSubmit = () => {
    if (isValid) {
      onSubmit({
        role: selectedRole,
        aboutYourself,
      })
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '24px',
        animation: 'modalFadeIn 0.2s ease-out',
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '28px',
          width: '100%',
          maxWidth: '420px',
          maxHeight: '85vh',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.25)',
          animation: 'modalSlideUp 0.3s ease-out',
        }}
      >
        {/* Close Button - Minimal ghost style */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.15s ease',
            zIndex: 10,
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Content with generous padding */}
        <div style={{ padding: '40px 36px 36px', overflowY: 'auto', maxHeight: '85vh' }}>

          {/* Hero Header - Project name is the star */}
          <div style={{ marginBottom: '32px', paddingRight: '32px' }}>
            <h2 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 700,
              color: '#18181B',
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
            }}>
              Join {project?.title}
            </h2>
            <p style={{
              margin: '10px 0 0 0',
              fontSize: '15px',
              color: '#71717A',
              fontWeight: 400,
            }}>
              Pitch yourself to the team
            </p>
          </div>

          {/* Role Selection - Chunky dropdown */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#71717A',
            }}>
              Select a role
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                onFocus={() => setIsRoleFocused(true)}
                onBlur={() => setIsRoleFocused(false)}
                style={{
                  width: '100%',
                  height: '56px',
                  padding: '0 52px 0 20px',
                  fontSize: '16px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: '16px',
                  backgroundColor: '#F4F4F5',
                  color: selectedRole ? '#18181B' : '#A1A1AA',
                  cursor: 'pointer',
                  appearance: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: isRoleFocused
                    ? '0 0 0 3px rgba(91, 74, 230, 0.2), inset 0 0 0 1px #5B4AE6'
                    : 'inset 0 0 0 1px transparent',
                  outline: 'none',
                }}
              >
                <option value="" disabled>Choose your role...</option>
                {(project?.roles || ['Frontend Developer', 'Backend Developer', 'UI/UX Designer', 'Product Manager', 'Marketing']).map((role, i) => (
                  <option key={i} value={role}>{role}</option>
                ))}
              </select>
              {/* Dropdown chevron */}
              <div
                style={{
                  position: 'absolute',
                  right: '20px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M4 6L8 10L12 6"
                    stroke={isRoleFocused ? '#5B4AE6' : '#A1A1AA'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Pitch Textarea - Inviting and spacious */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{
              display: 'block',
              marginBottom: '10px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#71717A',
            }}>
              Your pitch
            </label>
            <div style={{ position: 'relative' }}>
              <textarea
                value={aboutYourself}
                onChange={(e) => setAboutYourself(e.target.value)}
                onFocus={() => setIsTextareaFocused(true)}
                onBlur={() => setIsTextareaFocused(false)}
                placeholder="What excites you about this project? What would you bring to the team?"
                maxLength={300}
                style={{
                  width: '100%',
                  height: '140px',
                  padding: '18px 20px',
                  fontSize: '15px',
                  lineHeight: 1.6,
                  border: 'none',
                  borderRadius: '16px',
                  backgroundColor: '#F4F4F5',
                  color: '#18181B',
                  resize: 'none',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s ease',
                  boxShadow: isTextareaFocused
                    ? '0 0 0 3px rgba(91, 74, 230, 0.2), inset 0 0 0 1px #5B4AE6'
                    : 'inset 0 0 0 1px transparent',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Submit Button - Full width pill with structure in disabled state */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            style={{
              width: '100%',
              height: '56px',
              backgroundColor: isValid ? '#5B4AE6' : 'rgba(91, 74, 230, 0.12)',
              color: isValid ? '#FFFFFF' : 'rgba(91, 74, 230, 0.4)',
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: '9999px',
              border: 'none',
              cursor: isValid ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              boxShadow: isValid ? '0 4px 14px rgba(91, 74, 230, 0.4)' : 'none',
            }}
            onMouseEnter={(e) => {
              if (isValid) {
                e.currentTarget.style.backgroundColor = '#4F3ED9'
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(91, 74, 230, 0.5)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }
            }}
            onMouseLeave={(e) => {
              if (isValid) {
                e.currentTarget.style.backgroundColor = '#5B4AE6'
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(91, 74, 230, 0.4)'
                e.currentTarget.style.transform = 'translateY(0)'
              }
            }}
          >
            Send Request
          </button>
        </div>
      </div>

      {/* CSS Keyframes */}
      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}

export default ProfileDetailScreen
