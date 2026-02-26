import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProjectByIdAsync } from '../utils/projectData'
import { projectService } from '../services/projectService'
import { getInitialsAvatar } from '../utils/avatarUtils'

/**
 * ManageRequestsScreen - View and manage pending join requests
 * Route: /projects/:projectId/requests
 */

function ManageRequestsScreen() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    async function load() {
      const found = await getProjectByIdAsync(projectId)
      setProject(found)
      console.log('[ManageRequests] Project loaded:', { id: projectId, isSupabase: found?.isSupabaseProject, isOwner: found?.isOwner, title: found?.title })

      if (found?.isSupabaseProject) {
        const { data, error } = await projectService.getPendingRequests(projectId)
        console.log('[ManageRequests] Pending requests response:', { data, error, count: data?.length })
        setRequests((data || []).map(req => ({
          id: req.id,
          name: req.name || 'Team Member',
          school: req.school || '',
          role: req.role || 'Team Member',
          avatar: req.image || getInitialsAvatar(req.name || 'Team Member'),
          message: req.message || '',
          createdAt: req.joined_at
        })))
      } else {
        console.log('[ManageRequests] Not a Supabase project - no pending requests to fetch')
      }

      setLoading(false)
    }
    load()
  }, [projectId])

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Recently'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1 day ago'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 14) return '1 week ago'
    return `${Math.floor(diffDays / 7)} weeks ago`
  }

  const handleAccept = async (requestId) => {
    setActionLoading(requestId)
    const { error } = await projectService.approveRequest(requestId)
    if (error) {
      alert('Failed to approve request. Please try again.')
    } else {
      setRequests(prev => prev.filter(r => r.id !== requestId))
    }
    setActionLoading(null)
  }

  const handleDecline = async (requestId) => {
    setActionLoading(requestId)
    const { error } = await projectService.rejectRequest(requestId)
    if (error) {
      alert('Failed to decline request. Please try again.')
    } else {
      setRequests(prev => prev.filter(r => r.id !== requestId))
    }
    setActionLoading(null)
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
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>Manage Requests</h1>
          {project && <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>{project.title}</p>}
        </div>
        {requests.length > 0 && (
          <span style={{
            marginLeft: 'auto',
            padding: '4px 10px',
            fontSize: '12px',
            fontWeight: 600,
            backgroundColor: '#EEF2FF',
            color: '#5B4AE6',
            borderRadius: '12px'
          }}>
            {requests.length} pending
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {requests.length === 0 ? (
            /* Empty State */
            <div style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '48px 24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid #E5E7EB',
              textAlign: 'center'
            }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700, color: '#111827' }}>No pending requests</h3>
              <p style={{ margin: 0, fontSize: '14px', color: '#6B7280', lineHeight: 1.5 }}>
                When people request to join your project, they'll appear here.
              </p>
              <button
                onClick={() => navigate(`/projects/${projectId}/invite`)}
                style={{
                  marginTop: '20px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#5B4AE6',
                  backgroundColor: '#EEF2FF',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer'
                }}
              >
                Invite Members
              </button>
            </div>
          ) : (
            /* Request Cards */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {requests.map(req => (
                <div
                  key={req.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '14px',
                    padding: '16px 20px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    border: '1px solid #E5E7EB',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Top row: Avatar + Info + Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {/* Avatar */}
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '14px', overflow: 'hidden', flexShrink: 0
                    }}>
                      <img
                        src={req.avatar}
                        alt={req.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827' }}>{req.name}</p>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
                        {req.school && (
                          <span style={{ fontSize: '12px', color: '#6B7280' }}>{req.school}</span>
                        )}
                        <span style={{
                          padding: '2px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '6px',
                          backgroundColor: '#EEF2FF', color: '#5B4AE6'
                        }}>
                          {req.role}
                        </span>
                      </div>
                      <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#9CA3AF' }}>
                        Requested {formatTimeAgo(req.createdAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                      <button
                        onClick={() => handleAccept(req.id)}
                        disabled={actionLoading === req.id}
                        style={{
                          padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                          color: 'white', backgroundColor: '#5B4AE6', border: 'none',
                          borderRadius: '8px', cursor: actionLoading === req.id ? 'not-allowed' : 'pointer',
                          opacity: actionLoading === req.id ? 0.6 : 1
                        }}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDecline(req.id)}
                        disabled={actionLoading === req.id}
                        style={{
                          padding: '8px 16px', fontSize: '13px', fontWeight: 600,
                          color: '#6B7280', backgroundColor: '#F3F4F6', border: 'none',
                          borderRadius: '8px', cursor: actionLoading === req.id ? 'not-allowed' : 'pointer',
                          opacity: actionLoading === req.id ? 0.6 : 1
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  </div>

                  {/* Application message */}
                  {req.message && (
                    <div style={{
                      padding: '12px 14px',
                      backgroundColor: '#F9FAFB',
                      borderRadius: '10px',
                      border: '1px solid #F3F4F6'
                    }}>
                      <p style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Application
                      </p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
                        {req.message}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ManageRequestsScreen
