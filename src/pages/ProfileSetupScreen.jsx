import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { completeOnboarding } from '../App'

/**
 * ProfileSetupScreen - Single-page profile creation
 * GitHub/Indie Hacker style - optimized for project collaboration
 * 
 * NOT a LinkedIn/Handshake resume profile
 * Focus: "This is someone I could build a project with"
 */

// NYC Universities only
const NYC_UNIVERSITIES = [
  'New York University (NYU)',
  'Columbia University',
  'Pace University',
  'Parsons School of Design',
  'Pratt Institute',
  'Fordham University',
  'The New School',
  'Baruch College',
  'City College of New York (CCNY)',
  'Brooklyn College',
  'Hunter College',
  'Queens College',
  'NYC College of Technology (City Tech)',
  'John Jay College',
  'Other NYC school'
]

// Fields of interest
const FIELDS = [
  { id: 'engineering', label: 'Engineering' },
  { id: 'design', label: 'Design' },
  { id: 'product', label: 'Product' },
  { id: 'data', label: 'Data Science' },
  { id: 'business', label: 'Business' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'research', label: 'Research' },
  { id: 'arts', label: 'Arts & Media' },
]

// What they're looking for
const LOOKING_FOR = [
  { id: 'build', label: 'Build a project', icon: '🔨' },
  { id: 'join', label: 'Join a project', icon: '🤝' },
  { id: 'cofounder', label: 'Co-founder', icon: '🚀' },
]

// Skills
const SKILLS = [
  'React', 'Python', 'JavaScript', 'TypeScript', 'Node.js',
  'Backend', 'Frontend', 'Full Stack', 'UI/UX', 'Figma',
  'Product', 'Data', 'ML/AI', 'Mobile', 'Marketing',
  'Business', 'Strategy', 'Research', 'Writing', 'Video'
]

// Role options for projects
const ROLE_OPTIONS = [
  'Frontend', 'Backend', 'Full Stack', 'Designer', 'PM', 'Data', 'Marketing', 'Other'
]

function ProfileSetupScreen() {
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    university: '',
    otherUniversity: '',
    fields: [],
    lookingFor: [],
    skills: [],
    projects: [],
    links: {
      github: '',
      portfolio: '',
      linkedin: '',
      discord: ''
    }
  })

  // University dropdown state
  const [showUniversityDropdown, setShowUniversityDropdown] = useState(false)
  const [universityQuery, setUniversityQuery] = useState('')

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowUniversityDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter universities
  const filteredUniversities = universityQuery
    ? NYC_UNIVERSITIES.filter(u => u.toLowerCase().includes(universityQuery.toLowerCase()))
    : NYC_UNIVERSITIES

  const selectUniversity = (uni) => {
    setFormData(prev => ({ ...prev, university: uni, otherUniversity: '' }))
    setUniversityQuery(uni)
    setShowUniversityDropdown(false)
  }

  const toggleField = (fieldId) => {
    setFormData(prev => ({
      ...prev,
      fields: prev.fields.includes(fieldId)
        ? prev.fields.filter(f => f !== fieldId)
        : [...prev.fields, fieldId]
    }))
  }

  const toggleLookingFor = (id) => {
    setFormData(prev => ({
      ...prev,
      lookingFor: prev.lookingFor.includes(id)
        ? prev.lookingFor.filter(l => l !== id)
        : [...prev.lookingFor, id]
    }))
  }

  const toggleSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : prev.skills.length < 5 ? [...prev.skills, skill] : prev.skills
    }))
  }

  const addProject = () => {
    setFormData(prev => ({
      ...prev,
      projects: [...prev.projects, { name: '', description: '', link: '', role: '' }]
    }))
  }

  const updateProject = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      projects: prev.projects.map((p, i) => i === index ? { ...p, [field]: value } : p)
    }))
  }

  const removeProject = (index) => {
    setFormData(prev => ({
      ...prev,
      projects: prev.projects.filter((_, i) => i !== index)
    }))
  }

  const updateLink = (key, value) => {
    setFormData(prev => ({
      ...prev,
      links: { ...prev.links, [key]: value }
    }))
  }

  const isFormValid = formData.firstName.trim() && 
    formData.lastName.trim() && 
    formData.university &&
    formData.fields.length > 0 &&
    formData.lookingFor.length > 0 &&
    formData.skills.length > 0

  const handleSave = async () => {
    if (!isFormValid) return

    setIsSaving(true)

    // Save to localStorage for demo
    localStorage.setItem('nested_user_profile', JSON.stringify(formData))
    
    // Mark onboarding complete
    completeOnboarding()

    await new Promise(resolve => setTimeout(resolve, 500))

    setIsSaving(false)
    setShowSuccess(true)

    setTimeout(() => {
      navigate('/discover')
    }, 800)
  }

  return (
    <div style={{
      height: '100%',
      backgroundColor: '#F9FAFB',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
            Create your profile
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#6B7280' }}>
            Help others know what you can build together
          </p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        paddingBottom: '20px',
        WebkitOverflowScrolling: 'touch'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>

          {/* ========== SECTION 1: BASIC IDENTITY ========== */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
              Basic Info <span style={{ color: '#EF4444' }}>*</span>
            </h2>

            {/* Name Row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  First name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Alex"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '14px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#FAFAFA'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Last name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Chen"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '14px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#FAFAFA'
                  }}
                />
              </div>
            </div>

            {/* University */}
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                University
              </label>
              <input
                ref={inputRef}
                type="text"
                value={universityQuery}
                onChange={(e) => {
                  setUniversityQuery(e.target.value)
                  setFormData(prev => ({ ...prev, university: '' }))
                  setShowUniversityDropdown(true)
                }}
                onFocus={() => setShowUniversityDropdown(true)}
                placeholder="Search NYC universities..."
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  paddingRight: '40px',
                  fontSize: '14px',
                  border: formData.university ? '1.5px solid #5B4AE6' : '1.5px solid #E5E7EB',
                  borderRadius: '10px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: formData.university ? 'rgba(91,74,230,0.04)' : '#FAFAFA'
                }}
              />
              {formData.university && (
                <div style={{ position: 'absolute', right: '14px', top: '36px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              )}

              {showUniversityDropdown && filteredUniversities.length > 0 && (
                <div
                  ref={dropdownRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    borderRadius: '10px',
                    border: '1px solid #E5E7EB',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 50
                  }}
                >
                  {filteredUniversities.map((uni) => (
                    <button
                      key={uni}
                      onClick={() => selectUniversity(uni)}
                      style={{
                        width: '100%',
                        padding: '12px 14px',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid #F3F4F6',
                        textAlign: 'left',
                        fontSize: '14px',
                        color: '#111827',
                        cursor: 'pointer'
                      }}
                    >
                      {uni}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Other University Text Input */}
            {formData.university === 'Other NYC school' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  School name
                </label>
                <input
                  type="text"
                  value={formData.otherUniversity}
                  onChange={(e) => setFormData(prev => ({ ...prev, otherUniversity: e.target.value }))}
                  placeholder="Enter your school name"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '14px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#FAFAFA'
                  }}
                />
              </div>
            )}

            {/* Fields of Interest */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                Fields of interest
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {FIELDS.map(field => {
                  const isSelected = formData.fields.includes(field.id)
                  return (
                    <button
                      key={field.id}
                      onClick={() => toggleField(field.id)}
                      style={{
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 500,
                        borderRadius: '20px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#5B4AE6' : '#F3F4F6',
                        color: isSelected ? 'white' : '#374151'
                      }}
                    >
                      {field.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ========== SECTION 2: LOOKING FOR ========== */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
              What are you looking for? <span style={{ color: '#EF4444' }}>*</span>
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6B7280' }}>
              Select all that apply
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {LOOKING_FOR.map(item => {
                const isSelected = formData.lookingFor.includes(item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleLookingFor(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      borderRadius: '12px',
                      border: isSelected ? '2px solid #5B4AE6' : '1.5px solid #E5E7EB',
                      backgroundColor: isSelected ? 'rgba(91,74,230,0.05)' : 'white',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: '20px' }}>{item.icon}</span>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#5B4AE6' : '#111827' }}>
                      {item.label}
                    </span>
                    {isSelected && (
                      <div style={{ marginLeft: 'auto' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ========== SECTION 3: SKILLS ========== */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
              Skills <span style={{ color: '#EF4444' }}>*</span>
            </h2>
            <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#6B7280' }}>
              Select up to 5 skills
            </p>

            {/* Selected Skills */}
            {formData.skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {formData.skills.map(skill => (
                  <span
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '13px',
                      fontWeight: 600,
                      borderRadius: '16px',
                      backgroundColor: '#5B4AE6',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {skill}
                    <span style={{ fontSize: '14px' }}>×</span>
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {SKILLS.filter(s => !formData.skills.includes(s)).map(skill => {
                const isDisabled = formData.skills.length >= 5
                return (
                  <button
                    key={skill}
                    onClick={() => !isDisabled && toggleSkill(skill)}
                    disabled={isDisabled}
                    style={{
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: 500,
                      borderRadius: '20px',
                      border: 'none',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      backgroundColor: '#F3F4F6',
                      color: isDisabled ? '#D1D5DB' : '#374151',
                      opacity: isDisabled ? 0.5 : 1
                    }}
                  >
                    {skill}
                  </button>
                )
              })}
            </div>

            <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#9CA3AF' }}>
              {formData.skills.length}/5 selected
            </p>
          </div>

          {/* ========== SECTION 4: PROJECTS & WORK ========== */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
              Projects & Work
            </h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#6B7280' }}>
              Link things you've built or worked on — class projects, side projects, startups.
            </p>

            {/* Project Entries */}
            {formData.projects.map((project, index) => (
              <div
                key={index}
                style={{
                  padding: '16px',
                  backgroundColor: '#FAFAFA',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  position: 'relative'
                }}
              >
                <button
                  onClick={() => removeProject(index)}
                  style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>

                <input
                  type="text"
                  value={project.name}
                  onChange={(e) => updateProject(index, 'name', e.target.value)}
                  placeholder="Project name"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '14px',
                    fontWeight: 600,
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: 'white',
                    marginBottom: '10px'
                  }}
                />

                <input
                  type="text"
                  value={project.description}
                  onChange={(e) => updateProject(index, 'description', e.target.value.slice(0, 120))}
                  placeholder="One-line description (max 120 chars)"
                  maxLength={120}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '13px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: 'white',
                    marginBottom: '10px'
                  }}
                />

                <input
                  type="url"
                  value={project.link}
                  onChange={(e) => updateProject(index, 'link', e.target.value)}
                  placeholder="Link (GitHub, Figma, demo, etc.)"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '13px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: 'white',
                    marginBottom: '10px'
                  }}
                />

                <select
                  value={project.role}
                  onChange={(e) => updateProject(index, 'role', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: '13px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: 'white',
                    color: project.role ? '#111827' : '#9CA3AF'
                  }}
                >
                  <option value="">Role (optional)</option>
                  {ROLE_OPTIONS.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
            ))}

            {/* Add Project Button */}
            <button
              onClick={addProject}
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '14px',
                fontWeight: 600,
                color: '#5B4AE6',
                backgroundColor: 'transparent',
                border: '2px dashed #E5E7EB',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add a project
            </button>
          </div>

          {/* ========== SECTION 5: LINKS ========== */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <h2 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700, color: '#111827' }}>
              Links
            </h2>
            <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#6B7280' }}>
              Optional — help others find your work
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* GitHub */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#374151">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                </div>
                <input
                  type="url"
                  value={formData.links.github}
                  onChange={(e) => updateLink('github', e.target.value)}
                  placeholder="github.com/username"
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    fontSize: '14px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    backgroundColor: '#FAFAFA'
                  }}
                />
              </div>

              {/* Portfolio */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </div>
                <input
                  type="url"
                  value={formData.links.portfolio}
                  onChange={(e) => updateLink('portfolio', e.target.value)}
                  placeholder="yoursite.com"
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    fontSize: '14px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    backgroundColor: '#FAFAFA'
                  }}
                />
              </div>

              {/* LinkedIn */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#374151">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
                <input
                  type="url"
                  value={formData.links.linkedin}
                  onChange={(e) => updateLink('linkedin', e.target.value)}
                  placeholder="linkedin.com/in/username"
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    fontSize: '14px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    backgroundColor: '#FAFAFA'
                  }}
                />
              </div>

              {/* Discord */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#374151">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  value={formData.links.discord}
                  onChange={(e) => updateLink('discord', e.target.value)}
                  placeholder="username#1234"
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    fontSize: '14px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    backgroundColor: '#FAFAFA'
                  }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        flexShrink: 0,
        padding: '16px 20px',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom, 32px))',
        backgroundColor: 'white',
        borderTop: '1px solid #E5E7EB'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <button
            onClick={handleSave}
            disabled={!isFormValid || isSaving}
            style={{
              width: '100%',
              height: '54px',
              backgroundColor: showSuccess ? '#059669' : !isFormValid ? '#D1D5DB' : '#5B4AE6',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: '14px',
              border: 'none',
              cursor: !isFormValid || isSaving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: isFormValid && !isSaving ? '0 4px 14px rgba(91, 74, 230, 0.35)' : 'none'
            }}
          >
            {isSaving ? (
              <>
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite'
                }} />
                Saving...
              </>
            ) : showSuccess ? (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Profile Saved
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Save Profile
              </>
            )}
          </button>

          {!isFormValid && (
            <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#9CA3AF', textAlign: 'center' }}>
              Complete all required fields to continue
            </p>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default ProfileSetupScreen
