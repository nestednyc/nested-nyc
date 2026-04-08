import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProjectById, DEMO_CURRENT_USER_ID, saveProjectEdits } from '../utils/projectData'
import { deleteProject } from '../utils/projectStorage'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Role options
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

const ROLE_ID_TO_LABEL = {
  'frontend': 'Frontend Dev',
  'backend': 'Backend Dev',
  'fullstack': 'Full Stack',
  'designer': 'UI/UX Designer',
  'data': 'Data Science',
  'ml': 'ML/AI',
  'mobile': 'Mobile Dev',
  'pm': 'Product Manager',
  'marketing': 'Marketing',
  'business': 'Business/Strategy',
}

const COMMITMENTS = [
  { id: 'side-project', label: 'Side Project', description: 'Few hours per week', hours: '5-10 hrs/week' },
  { id: 'serious', label: 'Serious Build', description: 'Significant time commitment', hours: '15-25 hrs/week' },
  { id: 'startup', label: 'Startup Mode', description: 'Full dedication', hours: '30+ hrs/week' },
]

function getCommitmentFromProject(project) {
  if (project.commitment) return project.commitment
  const cat = (project.category || '').toLowerCase()
  if (cat.includes('startup')) return 'startup'
  if (cat.includes('side') || cat.includes('project')) return 'side-project'
  return 'side-project'
}

function getRawProjectId(projectId) {
  if (!projectId) return null
  if (projectId.startsWith('user-')) {
    const raw = projectId.replace('user-', '')
    return parseInt(raw) || raw
  }
  return projectId
}

function EditProjectScreen() {
  const navigate = useNavigate()
  const { projectId } = useParams()

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    roles: [],
    commitment: 'side-project',
    university: '',
    spotsLeft: 0,
  })

  useEffect(() => {
    async function loadProject() {
      if (!projectId) {
        setError('No project ID provided.')
        setLoading(false)
        return
      }

      const foundProject = getProjectById(projectId)

      if (!foundProject) {
        setError('Project not found. It may have been deleted or the link is incorrect.')
        setLoading(false)
        return
      }

      // Ownership check: isOwner flag, demo user match, OR real Supabase user match
      let currentUserId = null
      if (isSupabaseConfigured() && supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          currentUserId = user?.id || null
        } catch {
          // Ignore auth errors — fallback to demo check
        }
      }

      const isOwner =
        foundProject.isOwner === true ||
        foundProject.ownerId === DEMO_CURRENT_USER_ID ||
        (currentUserId && (foundProject.ownerId === currentUserId || foundProject.owner_id === currentUserId))

      if (!isOwner) {
        setError('You do not have permission to edit this project.')
        setLoading(false)
        return
      }

      setProject(foundProject)

      const existingRoles = (foundProject.skillsNeeded || [])
        .map(skill => ROLE_LABEL_TO_ID[skill] || null)
        .filter(Boolean)

      setFormData({
        title: foundProject.title || '',
        description: foundProject.description || '',
        roles: existingRoles.length > 0 ? [...new Set(existingRoles)] : [],
        commitment: getCommitmentFromProject(foundProject),
        university: foundProject.school || foundProject.university || (foundProject.schools?.[0]) || '',
        spotsLeft: foundProject.spotsLeft ?? 0,
      })

      setLoading(false)
    }

    loadProject()
  }, [projectId])

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

    const edits = {
      description: formData.description,
      skillsNeeded: formData.roles.map(r => ROLE_ID_TO_LABEL[r] || r),
      commitment: formData.commitment,
      title: formData.title,
      name: formData.title,
      university: formData.university,
      school: formData.university,
      spotsLeft: Number(formData.spotsLeft) || 0,
    }

    saveProjectEdits(projectId, edits)

    await new Promise(resolve => setTimeout(resolve, 400))

    setIsSaving(false)
    setShowSuccess(true)

    setTimeout(() => {
      navigate(`/projects/${projectId}`)
    }, 800)
  }

  const handleDelete = async () => {
    setIsDeleting(true)

    const rawId = getRawProjectId(projectId)
    deleteProject(rawId)

    await new Promise(resolve => setTimeout(resolve, 300))

    navigate('/discover', { replace: true })
  }

  // Loading
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
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // Error / not found / unauthorized
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
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          backgroundColor: '#FEF2F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '20px'
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
          {error || 'Project not found'}
        </h2>
        <p style={{ margin: '8px 0 24px', fontSize: '14px', color: '#6B7280' }}>
          {error?.includes('permission') ? 'Only the project owner can edit this project.' : 'This project may have been removed or the link is incorrect.'}
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 20px',
              backgroundColor: 'white',
              color: '#374151',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '10px',
              border: '1.5px solid #E5E7EB',
              cursor: 'pointer'
            }}
          >
            Go Back
          </button>
          <button
            onClick={() => navigate('/discover')}
            style={{
              padding: '10px 20px',
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
      </div>
    )
  }

  return (
    <div style={{ height: '100%', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }}>
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
          ) : 'Save'}
        </button>
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px 60px' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>

          {/* Title */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
              Project Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Give your project a name"
              maxLength={60}
              style={{
                width: '100%',
                padding: '12px 14px',
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

          {/* Description */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
              About this project
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Describe what your project is about, the problem it solves, and what makes it exciting..."
              maxLength={500}
              style={{
                width: '100%',
                minHeight: '130px',
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
            <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#9CA3AF', textAlign: 'right' }}>
              {formData.description.length}/500
            </p>
          </div>

          {/* Roles / Tags */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>
              Looking for
            </label>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6B7280' }}>
              Select the roles you need for your project
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
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
                      backgroundColor: isSelected ? `${role.color}18` : 'white',
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
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Commitment Level */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>
              Commitment Level
            </label>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#6B7280' }}>
              How much time should collaborators expect to commit?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#5B4AE6' : '#111827' }}>
                        {commit.label}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>
                        {commit.hours}
                      </span>
                    </div>
                    <span style={{ fontSize: '13px', color: '#6B7280' }}>{commit.description}</span>
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

          {/* Location / School */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
              School / Location
            </label>
            <input
              type="text"
              value={formData.university}
              onChange={(e) => updateField('university', e.target.value)}
              placeholder="e.g. NYU, Columbia, NYC"
              maxLength={60}
              style={{
                width: '100%',
                padding: '12px 14px',
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

          {/* Spots Available */}
          <div style={{ marginBottom: '32px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
              Spots Available
            </label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 6].map(n => {
                const isSelected = formData.spotsLeft === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => updateField('spotsLeft', n)}
                    style={{
                      width: '48px',
                      height: '48px',
                      fontSize: '16px',
                      fontWeight: 700,
                      borderRadius: '12px',
                      border: `1.5px solid ${isSelected ? '#5B4AE6' : '#E5E7EB'}`,
                      backgroundColor: isSelected ? 'rgba(91, 74, 230, 0.08)' : '#FAFAFA',
                      color: isSelected ? '#5B4AE6' : '#374151',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Danger Zone - Delete */}
          <div style={{
            borderTop: '1px solid #FEE2E2',
            paddingTop: '24px'
          }}>
            <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#EF4444' }}>
              Danger Zone
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'white',
                color: '#EF4444',
                fontSize: '14px',
                fontWeight: 600,
                borderRadius: '12px',
                border: '1.5px solid #FCA5A5',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
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
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '28px 24px',
            maxWidth: '360px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#FEF2F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#111827' }}>
              Delete this project?
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: '14px', color: '#6B7280', lineHeight: 1.5 }}>
              This will permanently remove <strong>{project.title}</strong> from Discover and My Projects. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '12px',
                  border: '1.5px solid #E5E7EB',
                  cursor: isDeleting ? 'default' : 'pointer',
                  opacity: isDeleting ? 0.5 : 1
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
                  backgroundColor: isDeleting ? '#FCA5A5' : '#EF4444',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  borderRadius: '12px',
                  border: 'none',
                  cursor: isDeleting ? 'default' : 'pointer',
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
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite'
                    }} />
                    Deleting
                  </>
                ) : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default EditProjectScreen
