import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProjectByIdAsync, updateProjectAsync, deleteProjectAsync, getCurrentUserId, DEMO_CURRENT_USER_ID } from '../utils/projectData'

/**
 * EditProjectScreen - Edit project details
 * Allows owners to update: title, description, roles, commitment, spots available
 * Includes delete functionality with confirmation modal
 * Owner-only access with proper permission checks
 */

// Role options (matching CreateProjectScreen)
const ROLES = [
  { id: 'frontend', label: 'Frontend Dev', color: '#3B82F6' },
  { id: 'backend', label: 'Backend Dev', color: '#10B981' },
  { id: 'fullstack', label: 'Full Stack', color: '#8B5CF6' },
  { id: 'designer', label: 'UI/UX Designer', color: '#EC4899' },
  { id: 'data', label: 'Data Science', color: '#F59E0B' },
  { id: 'ml', label: 'ML/AI', color: '#6366F1' },
  { id: 'mobile', label: 'Mobile Dev', color: '#14B8A6' },
  { id: 'pm', label: 'Product Manager', color: '#EF4444' },
  { id: 'marketing', label: 'Marketing', color: '#F97316' },
  { id: 'business', label: 'Business/Strategy', color: '#84CC16' },
]

// Commitment options
const COMMITMENTS = [
  { id: 'side-project', label: 'Side Project', description: 'Few hours per week', hours: '5-10 hrs/week' },
  { id: 'serious', label: 'Serious Build', description: 'Significant time commitment', hours: '15-25 hrs/week' },
  { id: 'startup', label: 'Startup Mode', description: 'Full dedication', hours: '30+ hrs/week' },
]

// Map skillsNeeded labels back to role IDs
const ROLE_LABEL_TO_ID = {
  'Frontend Dev': 'frontend',
  'Backend Dev': 'backend',
  'Full Stack': 'fullstack',
  'UI/UX Designer': 'designer',
  'Data Science': 'data',
  'ML/AI': 'ml',
  'Mobile Dev': 'mobile',
  'Product Manager': 'pm',
  'Marketing': 'marketing',
  'Business/Strategy': 'business',
  'React': 'frontend',
  'D3.js': 'frontend',
  'Data Viz': 'data',
  'Python': 'backend',
  'Node.js': 'backend',
  'APIs': 'backend',
  'React Native': 'mobile',
  'UI/UX': 'designer',
  'Firebase': 'backend',
}

// Derive commitment from category string or commitment field
function resolveCommitment(project) {
  if (project.commitment) return project.commitment
  const cat = (project.category || '').toLowerCase()
  if (cat.includes('startup')) return 'startup'
  if (cat.includes('side') || cat.includes('project')) return 'side-project'
  return 'side-project'
}

function EditProjectScreen() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    roles: [],
    commitment: 'side-project',
    spotsLeft: 0,
  })

  // Load project data (async - supports Supabase)
  useEffect(() => {
    let cancelled = false

    async function loadProject() {
      if (!projectId) {
        setError('No project ID provided')
        setLoading(false)
        return
      }

      try {
        const foundProject = await getProjectByIdAsync(projectId)

        if (cancelled) return

        if (!foundProject) {
          setError('Project not found')
          setLoading(false)
          return
        }

        // Check ownership
        const currentUserId = await getCurrentUserId()
        const isOwner = foundProject.isOwner ||
          foundProject.ownerId === currentUserId ||
          foundProject.ownerId === DEMO_CURRENT_USER_ID

        if (!isOwner) {
          setError('unauthorized')
          setLoading(false)
          return
        }

        setProject(foundProject)

        // Pre-fill form with existing data
        const existingRoles = (foundProject.skillsNeeded || [])
          .map(skill => ROLE_LABEL_TO_ID[skill] || null)
          .filter(Boolean)

        setFormData({
          title: foundProject.title || '',
          description: foundProject.description || '',
          roles: existingRoles.length > 0 ? [...new Set(existingRoles)] : [],
          commitment: resolveCommitment(foundProject),
          spotsLeft: foundProject.spotsLeft || 0,
        })
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading project for edit:', err)
          setError('Failed to load project')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadProject()
    return () => { cancelled = true }
  }, [projectId, navigate])

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const toggleRole = (roleId) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(roleId)
        ? prev.roles.filter(r => r !== roleId)
        : [...prev.roles, roleId]
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      // Map role IDs back to display labels for skillsNeeded
      const roleIdToLabel = {}
      ROLES.forEach(r => { roleIdToLabel[r.id] = r.label })

      // Build updates object
      const updates = {
        name: formData.title,
        description: formData.description,
        roles: formData.roles,
        skills: formData.roles.map(r => roleIdToLabel[r] || r),
        commitment: formData.commitment,
        spotsLeft: formData.spotsLeft,
      }

      const { error: saveError } = await updateProjectAsync(projectId, updates)

      if (saveError) {
        console.error('Error saving project:', saveError)
        alert('Failed to save changes. Please try again.')
        setIsSaving(false)
        return
      }

      setIsSaving(false)
      setShowSuccess(true)

      // Navigate back after showing success
      setTimeout(() => {
        navigate(`/projects/${projectId}`)
      }, 800)
    } catch (err) {
      console.error('Error saving project:', err)
      alert('Failed to save changes. Please try again.')
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const { error: deleteError } = await deleteProjectAsync(projectId)

      if (deleteError) {
        console.error('Error deleting project:', deleteError)
        alert('Failed to delete project. Please try again.')
        setIsDeleting(false)
        setShowDeleteModal(false)
        return
      }

      // Navigate to discover after deletion
      navigate('/discover', { replace: true })
    } catch (err) {
      console.error('Error deleting project:', err)
      alert('Failed to delete project. Please try again.')
      setIsDeleting(false)
      setShowDeleteModal(false)
    }
  }

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

  // Unauthorized state
  if (error === 'unauthorized') {
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
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#FEF2F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
          Unauthorized
        </h2>
        <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6B7280' }}>
          Only the project owner can edit this project.
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{
            marginTop: '20px',
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
          Go Back
        </button>
      </div>
    )
  }

  // Error / not found state
  if (error || !project) {
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
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: '#FEF2F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '16px'
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
          {error || 'Project not found'}
        </h2>
        <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#6B7280' }}>
          We couldn't load this project. It may have been deleted or you may not have access.
        </p>
        <button
          onClick={() => navigate('/discover')}
          style={{
            marginTop: '20px',
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
          Go to Discover
        </button>
      </div>
    )
  }

  return (
    <div style={{
      height: '100%',
      backgroundColor: 'white',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            color: '#6B7280'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Cancel
        </button>

        <h1 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111827' }}>
          Edit Project
        </h1>

        <button
          onClick={handleSave}
          disabled={isSaving || showSuccess}
          style={{
            padding: '8px 16px',
            backgroundColor: showSuccess ? '#059669' : '#5B4AE6',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            cursor: isSaving || showSuccess ? 'default' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minWidth: '80px',
            justifyContent: 'center'
          }}
        >
          {isSaving ? (
            <>
              <div style={{
                width: '14px',
                height: '14px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite'
              }} />
              Saving
            </>
          ) : showSuccess ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Saved
            </>
          ) : (
            'Save'
          )}
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 20px',
        paddingBottom: '40px'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Project Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '32px',
            padding: '16px',
            backgroundColor: '#FAFAFA',
            borderRadius: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(91, 74, 230, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
                Editing
              </p>
              <h2 style={{ margin: '2px 0 0 0', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                {project.title}
              </h2>
            </div>
          </div>

          {/* Title Section */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '8px'
            }}>
              Project Name
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Give your project a name"
              maxLength={80}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '14px',
                color: '#111827',
                backgroundColor: '#FAFAFA',
                border: '1.5px solid #E5E7EB',
                borderRadius: '12px',
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
          </div>

          {/* About Section */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '8px'
            }}>
              About this project
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe what your project is about, the problem it solves, and what makes it exciting..."
              maxLength={500}
              style={{
                width: '100%',
                minHeight: '140px',
                padding: '14px',
                fontSize: '14px',
                color: '#111827',
                backgroundColor: '#FAFAFA',
                border: '1.5px solid #E5E7EB',
                borderRadius: '12px',
                resize: 'vertical',
                lineHeight: 1.6,
                outline: 'none',
                boxSizing: 'border-box',
                fontFamily: 'inherit'
              }}
            />
            <p style={{
              margin: '6px 0 0 0',
              fontSize: '12px',
              color: '#9CA3AF',
              textAlign: 'right'
            }}>
              {formData.description.length}/500
            </p>
          </div>

          {/* Roles Section */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '6px'
            }}>
              Looking for
            </label>
            <p style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              color: '#6B7280'
            }}>
              Select the roles you need for your project
            </p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
              {ROLES.map(role => {
                const isSelected = formData.roles.includes(role.id)
                return (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => toggleRole(role.id)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: 500,
                      borderRadius: '20px',
                      border: `1.5px solid ${isSelected ? role.color : '#E5E7EB'}`,
                      backgroundColor: isSelected ? `${role.color}15` : 'white',
                      color: isSelected ? role.color : '#4B5563',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {role.label}
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Commitment Level Section */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '6px'
            }}>
              Commitment Level
            </label>
            <p style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              color: '#6B7280'
            }}>
              How much time should collaborators expect to commit?
            </p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              {COMMITMENTS.map(commit => {
                const isSelected = formData.commitment === commit.id
                return (
                  <button
                    key={commit.id}
                    type="button"
                    onClick={() => updateField('commitment', commit.id)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      textAlign: 'left',
                      backgroundColor: isSelected ? 'rgba(91, 74, 230, 0.05)' : '#FAFAFA',
                      border: `1.5px solid ${isSelected ? '#5B4AE6' : '#E5E7EB'}`,
                      borderRadius: '12px',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: isSelected ? '#5B4AE6' : '#111827'
                      }}>
                        {commit.label}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#6B7280'
                      }}>
                        {commit.hours}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '13px',
                      color: '#6B7280'
                    }}>
                      {commit.description}
                    </span>
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '14px',
                        right: '14px',
                        width: '20px',
                        height: '20px',
                        backgroundColor: '#5B4AE6',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Spots Available */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: 600,
              color: '#111827',
              marginBottom: '6px'
            }}>
              Spots Available
            </label>
            <p style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              color: '#6B7280'
            }}>
              How many people can still join?
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                type="button"
                onClick={() => updateField('spotsLeft', Math.max(0, formData.spotsLeft - 1))}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  border: '1.5px solid #E5E7EB',
                  backgroundColor: 'white',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#6B7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                -
              </button>
              <span style={{
                fontSize: '20px',
                fontWeight: 700,
                color: '#111827',
                minWidth: '32px',
                textAlign: 'center'
              }}>
                {formData.spotsLeft}
              </span>
              <button
                type="button"
                onClick={() => updateField('spotsLeft', Math.min(20, formData.spotsLeft + 1))}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  border: '1.5px solid #E5E7EB',
                  backgroundColor: 'white',
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#6B7280',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                +
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div style={{
            marginTop: '40px',
            padding: '20px',
            borderRadius: '12px',
            border: '1.5px solid #FEE2E2',
            backgroundColor: '#FEF2F2'
          }}>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '14px',
              fontWeight: 600,
              color: '#991B1B'
            }}>
              Danger Zone
            </h3>
            <p style={{
              margin: '0 0 16px 0',
              fontSize: '13px',
              color: '#6B7280'
            }}>
              Permanently delete this project and all associated data.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#EF4444',
                color: 'white',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              Delete Project
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '28px',
            maxWidth: '400px',
            width: '100%',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#FEE2E2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </div>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '18px',
              fontWeight: 700,
              color: '#111827'
            }}>
              Delete Project?
            </h3>
            <p style={{
              margin: '0 0 24px 0',
              fontSize: '14px',
              color: '#6B7280',
              lineHeight: 1.5
            }}>
              Are you sure you want to delete <strong>{project.title}</strong>? This action cannot be undone. All project data and team members will be removed.
            </p>
            <div style={{
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#F3F4F6',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '10px',
                  border: 'none',
                  cursor: isDeleting ? 'default' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#EF4444',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '10px',
                  border: 'none',
                  cursor: isDeleting ? 'default' : 'pointer',
                  opacity: isDeleting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                {isDeleting ? (
                  <>
                    <div style={{
                      width: '14px',
                      height: '14px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite'
                    }} />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default EditProjectScreen
