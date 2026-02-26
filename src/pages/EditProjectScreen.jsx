import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getProjectByIdAsync, DEMO_CURRENT_USER_ID, saveProjectEdits } from '../utils/projectData'
import { projectService } from '../services/projectService'

/**
 * EditProjectScreen - Edit project details
 * Allows owners to update: description, roles, commitment level
 * Pre-filled with existing project data
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

// Commitment options (ongoing commitments only - no hackathon)
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
  // Common variations
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

// Derive commitment from category
function getCommitmentFromCategory(category) {
  const cat = (category || '').toLowerCase()
  if (cat.includes('hackathon')) return 'hackathon'
  if (cat.includes('startup')) return 'startup'
  if (cat.includes('side') || cat.includes('project')) return 'side-project'
  return 'side-project'
}

function EditProjectScreen() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    description: '',
    roles: [],
    commitment: 'side-project',
  })

  // Load project data
  useEffect(() => {
    async function loadProject() {
      if (projectId) {
        const foundProject = await getProjectByIdAsync(projectId)
        if (foundProject) {
          // Check ownership
          const isOwner = foundProject.isOwner || foundProject.ownerId === DEMO_CURRENT_USER_ID
          if (!isOwner) {
            navigate(-1)
            return
          }

          setProject(foundProject)

          // Pre-fill form with existing data
          const existingRoles = (foundProject.skillsNeeded || [])
            .map(skill => ROLE_LABEL_TO_ID[skill] || null)
            .filter(Boolean)

          setFormData({
            description: foundProject.description || '',
            roles: existingRoles.length > 0 ? [...new Set(existingRoles)] : [],
            commitment: getCommitmentFromCategory(foundProject.category),
          })
        }
        setLoading(false)
      }
    }
    loadProject()
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

    // Map role IDs back to display labels for skillsNeeded
    const roleIdToLabel = {
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

    // Prepare the edits to save
    const edits = {
      description: formData.description,
      skillsNeeded: formData.roles.map(r => roleIdToLabel[r] || r),
      commitment: formData.commitment,
    }

    // Save edits — Supabase for real projects, localStorage for demo
    if (project?.isSupabaseProject) {
      const { error } = await projectService.updateProject(projectId, {
        description: edits.description,
        skills: edits.skillsNeeded,
        commitment: edits.commitment,
      })
      if (error) {
        console.error('Failed to save project:', error)
        alert('Failed to save changes. Please try again.')
        setIsSaving(false)
        return
      }
    } else {
      saveProjectEdits(projectId, edits)
    }

    setIsSaving(false)
    setShowSuccess(true)

    // Navigate back after showing success
    setTimeout(() => {
      navigate(`/projects/${projectId}`)
    }, 800)
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

  // Project not found
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
        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
          Project not found
        </h2>
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
          Go Back
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
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>
                {project.title}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6B7280' }}>
                {project.category}
              </p>
            </div>
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
        </div>
      </div>

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
