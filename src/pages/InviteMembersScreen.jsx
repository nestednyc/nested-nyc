import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProjectByIdAsync } from '../utils/projectData'

/**
 * InviteMembersScreen - Share project link to invite members
 * Route: /projects/:projectId/invite
 */

function InviteMembersScreen() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function load() {
      const found = await getProjectByIdAsync(projectId)
      setProject(found)
      setLoading(false)
    }
    load()
  }, [projectId])

  const projectUrl = `${window.location.origin}/projects/${projectId}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(projectUrl)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = projectUrl
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#F9FAFB' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #E5E7EB', borderTopColor: '#5B4AE6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', backgroundColor: '#F9FAFB', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0
      }}>
        <button onClick={() => navigate(-1)} style={{
          width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #E5E7EB',
          backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Invite Members</h1>
          {project && <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>{project.title}</p>}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          {/* Share Link Section */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            border: '1px solid #E5E7EB',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', backgroundColor: '#EEF2FF',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>Share project link</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>Anyone with this link can view and request to join</p>
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}>
              <div style={{
                flex: 1,
                padding: '12px 14px',
                backgroundColor: '#F9FAFB',
                borderRadius: '10px',
                border: '1px solid #E5E7EB',
                fontSize: '13px',
                color: '#6B7280',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {projectUrl}
              </div>
              <button
                onClick={handleCopyLink}
                style={{
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'white',
                  backgroundColor: copied ? '#10B981' : '#5B4AE6',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {copied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Copied!
                  </>
                ) : (
                  'Copy Link'
                )}
              </button>
            </div>
          </div>

          {/* Social Share */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            border: '1px solid #E5E7EB'
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600, color: '#111827' }}>Share on social</h3>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  const url = encodeURIComponent(projectUrl)
                  window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank')
                }}
                style={{
                  padding: '10px 18px', fontSize: '13px', fontWeight: 500,
                  color: '#374151', backgroundColor: '#F3F4F6', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
              </button>
              <button
                onClick={() => {
                  const url = encodeURIComponent(projectUrl)
                  const text = encodeURIComponent(`Check out this project: ${project?.title || ''}`)
                  window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank')
                }}
                style={{
                  padding: '10px 18px', fontSize: '13px', fontWeight: 500,
                  color: '#374151', backgroundColor: '#F3F4F6', border: 'none',
                  borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                X / Twitter
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default InviteMembersScreen
