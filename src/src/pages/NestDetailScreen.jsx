import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getNestById, DEMO_CURRENT_USER_ID } from '../utils/nestData'

/**
 * NestDetailScreen - Nest/Community Detail View
 * Nested NYC – Student-only project network
 * 
 * Desktop: Two-column layout (content left, CTA right)
 * Mobile: Single column with sticky bottom CTA
 */

function NestDetailScreen() {
  const navigate = useNavigate()
  const { nestId } = useParams()
  const [isDesktop, setIsDesktop] = useState(false)
  const [isRequested, setIsRequested] = useState(false)
  const [nest, setNest] = useState(null)
  const [loading, setLoading] = useState(true)

  // Responsive check
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  
  // Load nest by ID
  useEffect(() => {
    if (nestId) {
      const foundNest = getNestById(nestId)
      setNest(foundNest)
    }
    setLoading(false)
  }, [nestId])

  // Check if current user is the nest owner
  const isOwner = nest?.isOwner || nest?.ownerId === DEMO_CURRENT_USER_ID

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

  // Nest not found state
  if (!nest) {
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
          Nest not found
        </h2>
        <p style={{ margin: '8px 0 24px 0', fontSize: '14px', color: '#6B7280' }}>
          This nest may have been removed or the link is incorrect.
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
          Browse Nests
        </button>
      </div>
    )
  }

  // Desktop Layout
  if (isDesktop) {
    return (
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
            Back to nests
          </button>
        </div>

        <div className="project-detail-layout">
          {/* Left Column - Main Content */}
          <div className="project-detail-main">
            {/* Nest Header */}
            <div className="project-detail-header-text">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
                {/* Nest Image */}
                <div 
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '18px',
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
                
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h1 className="project-detail-title-text" style={{ margin: 0 }}>{nest.name}</h1>
                    
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
                  
                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                    {nest.tags?.map((tag, idx) => (
                      <span 
                        key={idx}
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#5B4AE6',
                          backgroundColor: 'rgba(91, 74, 230, 0.1)',
                          padding: '6px 12px',
                          borderRadius: '12px'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* About Section */}
            <div className="project-detail-section">
              <h3 className="section-title-desktop">About this Nest</h3>
              <p className="project-description-desktop" style={{ lineHeight: '1.8', marginBottom: 0 }}>
                {nest.description}
              </p>
            </div>

            {/* Member Highlights Section */}
            <div className="project-detail-section">
              <div className="team-header-desktop">
                <h3 className="section-title-desktop">Members</h3>
                <span className="team-count-desktop">
                  {nest.members} {nest.members === 1 ? 'member' : 'members'}
                </span>
              </div>
              
              {/* Member Avatars */}
              {nest.memberAvatars && nest.memberAvatars.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
                  <div style={{ display: 'flex' }}>
                    {nest.memberAvatars.slice(0, 5).map((avatar, idx) => (
                      <div 
                        key={idx}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          border: '2px solid white',
                          marginLeft: idx > 0 ? '-10px' : 0
                        }}
                      >
                        <img 
                          src={avatar}
                          alt="Member"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ))}
                  </div>
                  {nest.members > 5 && (
                    <span style={{ fontSize: '13px', color: '#6B7280' }}>
                      +{nest.members - 5} more
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Activity Section */}
            <div className="project-detail-section">
              <h3 className="section-title-desktop">Recent Activity</h3>
              <div style={{ 
                padding: '20px', 
                backgroundColor: '#F9FAFB', 
                borderRadius: '12px',
                textAlign: 'center'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" style={{ margin: '0 auto 8px' }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
                  Join the nest to see activity and participate in discussions
                </p>
              </div>
            </div>
          </div>

          {/* Right Column - Action Card */}
          <div className="project-detail-sidebar">
            <div className="project-cta-card">
              {/* Members Count */}
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
                  fontSize: '20px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                    {nest.members} Members
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#6B7280' }}>
                    Active community
                  </p>
                </div>
              </div>

              {isOwner ? (
                /* Owner Actions */
                <>
                  {/* Primary: Manage Nest */}
                  <button 
                    className="join-btn-desktop"
                    onClick={() => navigate(`/nests/${nestId}/manage`)}
                    style={{
                      width: '100%',
                      marginBottom: '12px'
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                    Manage Nest
                  </button>

                  {/* Secondary Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
                    <button 
                      className="save-btn-desktop"
                      onClick={() => navigate(`/nests/${nestId}/edit`)}
                      style={{ width: '100%' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Edit Nest
                    </button>
                    
                    <button 
                      className="save-btn-desktop"
                      onClick={() => navigate(`/nests/${nestId}/requests`)}
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
                    
                    <button 
                      className="save-btn-desktop"
                      onClick={() => navigate(`/nests/${nestId}/invite`)}
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
                  </div>
                </>
              ) : (
                /* Non-Owner Actions */
                <>
                  {/* Primary CTA Button */}
                  <button 
                    className={`join-btn-desktop ${isRequested ? 'requested' : ''}`}
                    onClick={() => !isRequested && setIsRequested(true)}
                    disabled={isRequested}
                    style={{
                      width: '100%',
                      marginBottom: isRequested ? '8px' : '24px',
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
                        Join Nest
                      </>
                    )}
                  </button>
                  
                  {/* Helper text after request sent */}
                  {isRequested && (
                    <p style={{
                      margin: 0,
                      marginBottom: '24px',
                      fontSize: '12px',
                      color: '#6B7280',
                      textAlign: 'center',
                      lineHeight: 1.4
                    }}>
                      The nest owner will review your request.
                    </p>
                  )}
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
                {/* Members */}
                <div className="quick-info-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                  <span>{nest.members} members</span>
                </div>
                
                {/* Topics */}
                <div className="quick-info-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                  <span>{nest.tags?.join(', ')}</span>
                </div>
                
                {/* Status */}
                <div className="quick-info-item">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span>Active</span>
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
                  Share this nest
                </h4>
                <div className="share-buttons">
                  <button 
                    className="share-btn" 
                    title="Copy link"
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href)
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
                      const text = encodeURIComponent(`Check out ${nest.name} on Nested!`)
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
    )
  }

  // Mobile Layout
  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '100px' }}>
        {/* Hero Image Section */}
        <div style={{ position: 'relative', height: '220px', flexShrink: 0 }}>
          <img 
            src={nest.image}
            alt={nest.name}
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
          
          {/* Nest Title Overlay */}
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
                {nest.name}
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
          {/* Tags + Members Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {nest.tags?.map((tag, idx) => (
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
                  {tag}
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
              {nest.members} members
            </span>
          </div>
          
          {/* About Section */}
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
              About this Nest
            </h3>
            <p style={{ 
              margin: 0, 
              marginTop: '8px', 
              fontSize: '14px', 
              color: '#666', 
              lineHeight: 1.6 
            }}>
              {nest.description}
            </p>
          </div>
          
          {/* Members Section */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#231429' }}>
                Members
              </h3>
              <span style={{ fontSize: '13px', color: '#ADAFBB' }}>
                {nest.members} total
              </span>
            </div>
            
            {/* Member Avatars */}
            {nest.memberAvatars && nest.memberAvatars.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <div style={{ display: 'flex' }}>
                  {nest.memberAvatars.slice(0, 5).map((avatar, idx) => (
                    <div 
                      key={idx}
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        border: '2px solid white',
                        marginLeft: idx > 0 ? '-8px' : 0
                      }}
                    >
                      <img 
                        src={avatar}
                        alt="Member"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ))}
                </div>
                {nest.members > 5 && (
                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                    +{nest.members - 5} more
                  </span>
                )}
              </div>
            )}
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
            {/* Edit Button */}
            <button 
              onClick={() => navigate(`/nests/${nestId}/edit`)}
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
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            
            {/* Manage Nest Button */}
            <button 
              onClick={() => navigate(`/nests/${nestId}/manage`)}
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
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Manage Nest
            </button>
          </>
        ) : (
          /* Non-Owner Actions - Mobile */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button 
              onClick={() => !isRequested && setIsRequested(true)}
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
                  Join Nest
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
                The nest owner will review your request.
              </p>
            )}
          </div>
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
    </div>
  )
}

export default NestDetailScreen
