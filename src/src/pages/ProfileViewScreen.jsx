import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

/**
 * ProfileViewScreen - Public read-only profile view
 * LinkedIn/Handshake style layout
 * Edit button only shows for profile owner
 */

const STORAGE_KEY = 'nested_user_profile'
const CURRENT_USER_ID = 'current-user' // For demo

const LOOKING_FOR_LABELS = {
  join: { label: 'Join a project', icon: '🤝' },
  cofounder: { label: 'Co-founder', icon: '🚀' },
}

function ProfileViewScreen() {
  const navigate = useNavigate()
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  
  const isOwner = userId === CURRENT_USER_ID

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setProfile(JSON.parse(saved))
    } catch (e) {}
  }, [userId])

  if (!profile) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>Profile not found</p>
      </div>
    )
  }

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unnamed User'
  const hasProjects = profile.projects && profile.projects.length > 0 && profile.projects.some(p => p.name)
  const hasLinks = profile.links && Object.values(profile.links).some(v => v)

  return (
    <div style={{ height: '100%', backgroundColor: '#F9FAFB', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate(-1)} style={{
            width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E5E7EB',
            backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>Profile</h1>
        </div>
        {isOwner && (
          <button onClick={() => navigate('/profile/edit')} style={{
            padding: '8px 16px', fontSize: '13px', fontWeight: 600, backgroundColor: '#5B4AE6',
            color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'
          }}>
            Edit Profile
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 260px', gap: '16px' }}>
          
          {/* MAIN COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Profile Header Card */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid #E5E7EB',
              display: 'flex',
              gap: '16px'
            }}>
              {/* Avatar */}
              <div style={{
                width: '72px', height: '72px', borderRadius: '16px', backgroundColor: '#F3F4F6',
                border: '2px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>

              <div style={{ flex: 1 }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700, color: '#111827' }}>{fullName}</h2>
                {profile.university && (
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6B7280' }}>
                    📍 {profile.university}
                  </p>
                )}
                {profile.fields && profile.fields.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {profile.fields.map(f => (
                      <span key={f} style={{
                        padding: '3px 8px', fontSize: '11px', fontWeight: 500, borderRadius: '10px',
                        backgroundColor: '#EEF2FF', color: '#5B4AE6'
                      }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #E5E7EB'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>About</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: 1.5 }}>{profile.bio}</p>
              </div>
            )}

            {/* Looking For */}
            {profile.lookingFor && profile.lookingFor.length > 0 && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #E5E7EB'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Looking For</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {profile.lookingFor.map(id => {
                    const item = LOOKING_FOR_LABELS[id]
                    if (!item) return null
                    return (
                      <span key={id} style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
                        backgroundColor: '#F3F4F6', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#374151'
                      }}>
                        <span>{item.icon}</span>
                        {item.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Projects */}
            {hasProjects && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #E5E7EB'
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Projects & Work</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {profile.projects.filter(p => p.name).map((proj, idx) => (
                    <div key={idx} style={{
                      padding: '12px',
                      backgroundColor: '#FAFAFA',
                      borderRadius: '10px',
                      border: '1px solid #F3F4F6'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                        <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>{proj.name}</h4>
                        {proj.role && (
                          <span style={{
                            padding: '2px 6px', fontSize: '10px', fontWeight: 500, borderRadius: '6px',
                            backgroundColor: '#E0E7FF', color: '#4338CA'
                          }}>{proj.role}</span>
                        )}
                      </div>
                      {proj.description && (
                        <p style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#6B7280', lineHeight: 1.4 }}>{proj.description}</p>
                      )}
                      {proj.link && (
                        <a href={proj.link.startsWith('http') ? proj.link : `https://${proj.link}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '12px', color: '#5B4AE6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          View project
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #E5E7EB'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Skills</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {profile.skills.map(s => (
                    <span key={s} style={{
                      padding: '4px 8px', fontSize: '11px', fontWeight: 500, borderRadius: '10px',
                      backgroundColor: '#F3F4F6', color: '#374151'
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {hasLinks && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #E5E7EB'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Links</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {profile.links.github && (
                    <a href={profile.links.github.startsWith('http') ? profile.links.github : `https://${profile.links.github}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                      GitHub
                    </a>
                  )}
                  {profile.links.portfolio && (
                    <a href={profile.links.portfolio.startsWith('http') ? profile.links.portfolio : `https://${profile.links.portfolio}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                      Portfolio
                    </a>
                  )}
                  {profile.links.linkedin && (
                    <a href={profile.links.linkedin.startsWith('http') ? profile.links.linkedin : `https://${profile.links.linkedin}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      LinkedIn
                    </a>
                  )}
                  {profile.links.discord && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                      {profile.links.discord}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Connect CTA (for non-owners) */}
            {!isOwner && (
              <button style={{
                width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600,
                backgroundColor: '#5B4AE6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer'
              }}>
                Connect
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileViewScreen
