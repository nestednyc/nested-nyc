import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { getMyProjects, getSavedProjects } from '../utils/projectData'

/**
 * MatchesScreen - My Projects (Saved/Joined)
 * Nested NYC – Student-only project network
 * 
 * Specs:
 * - Header: "My Projects" title with sort icon
 * - Description text
 * - Grid of project cards with title, category, school badges
 * - Join indicator on cards
 * - Bottom navigation
 * - User-created projects from localStorage
 */

function MatchesScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [activeProjects, setActiveProjects] = useState([])
  const [savedProjects, setSavedProjects] = useState([])

  // Load projects from centralized store
  useEffect(() => {
    setActiveProjects(getMyProjects())
    setSavedProjects(getSavedProjects())
  }, [])

  // Show success toast if coming from project creation
  useEffect(() => {
    if (location.state?.projectCreated) {
      setSuccessMessage(`"${location.state.projectName}" created!`)
      setShowSuccessToast(true)
      // Clear state to prevent showing again on refresh
      window.history.replaceState({}, document.title)
      // Refresh projects list
      setActiveProjects(getMyProjects())
      // Hide toast after 3 seconds
      const timer = setTimeout(() => setShowSuccessToast(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [location.state])

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div 
        style={{ 
          paddingTop: '32px',
          paddingLeft: '40px',
          paddingRight: '40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px'
        }}
      >
        <div>
          <h1 
            style={{ 
              margin: 0,
              fontSize: '24px',
              fontWeight: 700,
              color: '#111827'
            }}
          >
            My Projects
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6B7280' }}>
            Your workspace for building and collaborating
          </p>
        </div>
        
        {/* New Project Button */}
        <button 
          onClick={() => navigate('/create-project')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: '#5B4AE6',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '12px',
            border: 'none',
            cursor: 'pointer',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4A3CD4'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5B4AE6'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Project
        </button>
      </div>
      
      {/* Content - Scrollable */}
      <div 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          paddingBottom: '100px',
          paddingLeft: '40px',
          paddingRight: '40px'
        }}
      >
        {/* Projects Grid - 2 columns for focused workspace */}
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '20px'
          }}
          className="projects-grid"
        >
          {/* Create Project Card - Always first */}
          <div 
            onClick={() => navigate('/create-project')}
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              border: '2px dashed #E5E7EB',
              padding: '28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              minHeight: '200px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#5B4AE6'
              e.currentTarget.style.backgroundColor = 'rgba(91, 74, 230, 0.02)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#E5E7EB'
              e.currentTarget.style.backgroundColor = 'white'
            }}
          >
            {/* Plus Icon */}
            <div 
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                backgroundColor: 'rgba(91, 74, 230, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </div>
            
            {/* Text */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#5B4AE6' }}>
                Create Project
              </p>
              <p style={{ margin: 0, marginTop: '4px', fontSize: '13px', color: '#9CA3AF' }}>
                Start something new
              </p>
            </div>
          </div>

          {/* Project Cards */}
          {activeProjects.map(project => (
            <div 
              key={project.id}
              style={{
                backgroundColor: 'white',
                borderRadius: '16px',
                border: '1px solid #EAECF0',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                minHeight: '200px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
              }}
              onClick={() => navigate(`/projects/${project.id}`)}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)'
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.borderColor = '#D1D5DB'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.03)'
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.borderColor = '#EAECF0'
              }}
            >
              {/* Top Row: Icon + Title */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                {/* Project Icon/Avatar */}
                <div 
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(91, 74, 230, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                </div>
                
                {/* Title + Description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
                    {project.title}
                  </p>
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
                    {project.description || project.tagline || 'Building something awesome'}
                  </p>
                </div>
              </div>
              
              {/* Metadata Row: Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {/* Role Badge */}
                {project.isOwner && (
                  <span 
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#5B4AE6',
                      backgroundColor: 'rgba(91, 74, 230, 0.08)',
                      padding: '5px 12px',
                      borderRadius: '10px'
                    }}
                  >
                    Owner
                  </span>
                )}
                {!project.isOwner && project.joined && (
                  <span 
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#6B7280',
                      backgroundColor: '#F3F4F6',
                      padding: '5px 12px',
                      borderRadius: '10px'
                    }}
                  >
                    Member
                  </span>
                )}
                
                {/* School Badge */}
                {(project.school || (project.schools && project.schools[0])) && (
                  <span 
                    style={{
                      fontSize: '11px',
                      fontWeight: 500,
                      color: '#6B7280',
                      backgroundColor: '#F3F4F6',
                      padding: '5px 12px',
                      borderRadius: '10px'
                    }}
                  >
                    {project.school || project.schools[0]}
                  </span>
                )}
                
                {/* Status Badge */}
                <span 
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#059669',
                    backgroundColor: 'rgba(5, 150, 105, 0.08)',
                    padding: '5px 12px',
                    borderRadius: '10px'
                  }}
                >
                  Active
                </span>
              </div>
              
              {/* Spacer to push button to bottom */}
              <div style={{ flex: 1 }} />
              
              {/* Open Button - Bottom Right */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #F3F4F6' }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/projects/${project.id}`)
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#5B4AE6',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '10px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.stopPropagation()
                    e.currentTarget.style.backgroundColor = '#4A3CD4'
                  }}
                  onMouseLeave={(e) => {
                    e.stopPropagation()
                    e.currentTarget.style.backgroundColor = '#5B4AE6'
                  }}
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Saved Section */}
        {savedProjects.length > 0 && (
          <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid #F0F1F3' }}>
            <p style={{ margin: 0, marginBottom: '20px', fontSize: '13px', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Saved for later
            </p>
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '20px' 
              }}
              className="projects-grid"
            >
              {savedProjects.map(project => (
                <div 
                  key={project.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    border: '1px solid #EAECF0',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    minHeight: '200px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                  }}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.06)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.borderColor = '#D1D5DB'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.03)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.borderColor = '#EAECF0'
                  }}
                >
                  {/* Top Row: Icon + Title */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    {/* Project Icon/Avatar */}
                    <div 
                      style={{
                        width: '52px',
                        height: '52px',
                        borderRadius: '14px',
                        backgroundColor: 'rgba(91, 74, 230, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                        <line x1="12" y1="22.08" x2="12" y2="12"/>
                      </svg>
                    </div>
                    
                    {/* Title + Description */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
                        {project.title}
                      </p>
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
                        {project.description || project.category || 'Saved project'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Metadata Row: Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {/* School Badge */}
                    {project.school && (
                      <span 
                        style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          color: '#6B7280',
                          backgroundColor: '#F3F4F6',
                          padding: '5px 12px',
                          borderRadius: '10px'
                        }}
                      >
                        {project.school}
                      </span>
                    )}
                    
                    {/* Saved Badge */}
                    <span 
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#9CA3AF',
                        backgroundColor: '#F3F4F6',
                        padding: '5px 12px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#9CA3AF" stroke="none">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                      </svg>
                      Saved
                    </span>
                  </div>
                  
                  {/* Spacer to push button to bottom */}
                  <div style={{ flex: 1 }} />
                  
                  {/* Open Button - Bottom Right */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid #F3F4F6' }}>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/projects/${project.id}`)
                      }}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: 'transparent',
                        color: '#5B4AE6',
                        fontSize: '13px',
                        fontWeight: 600,
                        borderRadius: '10px',
                        border: '1.5px solid #5B4AE6',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.stopPropagation()
                        e.currentTarget.style.backgroundColor = 'rgba(91, 74, 230, 0.08)'
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation()
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }}
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Bottom Navigation */}
      <BottomNav />
      
      {/* Join Modal */}
      {showJoinModal && (
        <JoinModal onClose={() => setShowJoinModal(false)} />
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div 
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#10B981',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'slideUp 0.3s ease'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 12l2 2 4-4"/>
            <circle cx="12" cy="12" r="10"/>
          </svg>
          {successMessage}
        </div>
      )}
      
      <style>{`
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

/**
 * JoinModal - "You're In!" project join confirmation
 */
function JoinModal({ onClose }) {
  const navigate = useNavigate()
  
  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(35, 20, 41, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '40px'
      }}
    >
      {/* Project + User photos */}
      <div style={{ display: 'flex', position: 'relative', marginBottom: '32px' }}>
        <div 
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid white',
            marginRight: '-20px',
            zIndex: 1
          }}
        >
          <img 
            src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&h=200&fit=crop"
            alt="Project"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div 
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid white'
          }}
        >
          <img 
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop"
            alt="You"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>
      
      {/* Title */}
      <h2 
        style={{ 
          margin: 0,
          fontSize: '32px',
          fontWeight: 700,
          color: '#5B4AE6',
          textAlign: 'center'
        }}
      >
        You're In! 🚀
      </h2>
      
      {/* Description */}
      <p 
        style={{ 
          margin: 0,
          marginTop: '12px',
          fontSize: '14px',
          color: 'rgba(255,255,255,0.7)',
          textAlign: 'center'
        }}
      >
        You've joined the project team
      </p>
      
      {/* Buttons */}
      <div style={{ width: '100%', marginTop: '40px' }}>
        <button 
          onClick={() => { onClose(); navigate('/chat/project') }}
          style={{
            width: '100%',
            height: '56px',
            backgroundColor: '#5B4AE6',
            color: 'white',
            fontSize: '16px',
            fontWeight: 700,
            borderRadius: '15px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Open chat
        </button>
        
        <button 
          onClick={onClose}
          style={{
            width: '100%',
            height: '56px',
            backgroundColor: 'transparent',
            color: '#5B4AE6',
            fontSize: '16px',
            fontWeight: 700,
            borderRadius: '15px',
            border: '1px solid rgba(109, 93, 246, 0.2)',
            cursor: 'pointer',
            marginTop: '16px'
          }}
        >
          Keep browsing
        </button>
      </div>
    </div>
  )
}

export default MatchesScreen

