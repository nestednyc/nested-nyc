import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { profileService } from '../services/profileService'

/**
 * MyProfileScreen - Standalone profile page
 * Accessed via top-right profile avatar
 * LinkedIn/Discord-style clean, professional design
 * Auto-saves on edit
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
  'Engineering', 'Design', 'Product', 'Data Science', 
  'Business', 'Marketing', 'Research', 'Arts & Media'
]

// What they're looking for (removed "Build a project")
const LOOKING_FOR = [
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

const STORAGE_KEY = 'nested_user_profile'

function MyProfileScreen() {
  const navigate = useNavigate()
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved' | 'saving' | 'unsaved'
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const saveTimeoutRef = useRef(null)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  // Default profile structure
  const getDefaultProfile = () => ({
    firstName: '',
    lastName: '',
    university: '',
    otherUniversity: '',
    fields: [],
    bio: '',
    lookingFor: [],
    skills: [],
    projects: [],
    links: { github: '', portfolio: '', linkedin: '', discord: '' }
  })

  // Load profile from localStorage (fallback)
  const loadProfileFromStorage = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return getDefaultProfile()
  }

  const [profile, setProfile] = useState(loadProfileFromStorage)

  // Fetch profile from Supabase on mount
  useEffect(() => {
    const fetchProfile = async () => {
      if (!isSupabaseConfigured()) {
        setLoading(false)
        return
      }

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }

        setCurrentUserId(user.id)
        const { data, error } = await profileService.getProfile(user.id)

        if (error) {
          console.warn('Could not fetch profile, using localStorage:', error.message)
          setLoading(false)
          return
        }

        if (data) {
          // Transform DB format to component format
          const transformedProfile = {
            firstName: data.first_name || '',
            lastName: data.last_name || '',
            university: data.university || '',
            otherUniversity: '',
            fields: data.fields || [],
            bio: data.bio || '',
            lookingFor: data.looking_for || [],
            skills: data.skills || [],
            projects: data.projects || [],
            links: data.links || { github: '', portfolio: '', linkedin: '', discord: '' }
          }
          setProfile(transformedProfile)
          setUniversityQuery(data.university || '')
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err)
      }
      setLoading(false)
    }

    fetchProfile()
  }, [])
  const [showUniversityDropdown, setShowUniversityDropdown] = useState(false)
  const [universityQuery, setUniversityQuery] = useState(profile.university || '')

  // Auto-save with debounce - saves to both localStorage and Supabase
  const saveProfile = useCallback((data) => {
    setSaveStatus('saving')
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

    saveTimeoutRef.current = setTimeout(async () => {
      // Always save to localStorage as fallback
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))

      // Save to Supabase if configured and user is authenticated
      if (currentUserId && isSupabaseConfigured()) {
        try {
          // Transform component format to DB format
          const dbProfile = {
            first_name: data.firstName,
            last_name: data.lastName,
            university: data.university,
            fields: data.fields,
            bio: data.bio,
            looking_for: data.lookingFor,
            skills: data.skills,
            projects: data.projects,
            links: data.links
          }

          const { error } = await profileService.updateProfile(currentUserId, dbProfile)
          if (error) {
            console.error('Failed to save profile to DB:', error)
          }
        } catch (err) {
          console.error('Failed to save profile to DB:', err)
        }
      }

      setSaveStatus('saved')
    }, 800)
  }, [currentUserId])

  // Update profile field and trigger auto-save
  const updateProfile = (field, value) => {
    setSaveStatus('unsaved')
    const updated = { ...profile, [field]: value }
    setProfile(updated)
    saveProfile(updated)
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target) &&
        inputRef.current && !inputRef.current.contains(e.target)
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
    setUniversityQuery(uni)
    updateProfile('university', uni)
    setShowUniversityDropdown(false)
  }

  const toggleField = (field) => {
    const newFields = profile.fields.includes(field)
      ? profile.fields.filter(f => f !== field)
      : [...profile.fields, field]
    updateProfile('fields', newFields)
  }

  const toggleLookingFor = (id) => {
    const newLooking = profile.lookingFor.includes(id)
      ? profile.lookingFor.filter(l => l !== id)
      : [...profile.lookingFor, id]
    updateProfile('lookingFor', newLooking)
  }

  const toggleSkill = (skill) => {
    const newSkills = profile.skills.includes(skill)
      ? profile.skills.filter(s => s !== skill)
      : profile.skills.length < 7 ? [...profile.skills, skill] : profile.skills
    updateProfile('skills', newSkills)
  }

  const addProject = () => {
    const newProjects = [...profile.projects, { name: '', description: '', link: '', role: '' }]
    updateProfile('projects', newProjects)
  }

  const updateProject = (index, field, value) => {
    const newProjects = profile.projects.map((p, i) => i === index ? { ...p, [field]: value } : p)
    updateProfile('projects', newProjects)
  }

  const removeProject = (index) => {
    const newProjects = profile.projects.filter((_, i) => i !== index)
    updateProfile('projects', newProjects)
  }

  const updateLink = (key, value) => {
    const newLinks = { ...profile.links, [key]: value }
    updateProfile('links', newLinks)
  }

  // Show loading state
  if (loading) {
    return (
      <div style={{
        height: '100%',
        backgroundColor: '#F9FAFB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #E5E7EB',
            borderTopColor: '#5B4AE6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p style={{ color: '#6B7280', fontSize: '14px' }}>Loading profile...</p>
        </div>
      </div>
    )
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              border: '1px solid #E5E7EB',
              backgroundColor: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
            My Profile
          </h1>
        </div>

        {/* Save Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: saveStatus === 'saved' ? '#059669' : saveStatus === 'saving' ? '#6B7280' : '#F59E0B'
        }}>
          {saveStatus === 'saving' && (
            <div style={{
              width: '12px',
              height: '12px',
              border: '2px solid #D1D5DB',
              borderTopColor: '#6B7280',
              borderRadius: '50%',
              animation: 'spin 0.6s linear infinite'
            }} />
          )}
          {saveStatus === 'saved' && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
          <span>{saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}</span>
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        paddingBottom: '40px'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>

          {/* ========== HEADER SECTION ========== */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            {/* Avatar + Name Row */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
              {/* Avatar */}
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '20px',
                  backgroundColor: '#F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #E5E7EB',
                  overflow: 'hidden'
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <button style={{
                  position: 'absolute',
                  bottom: '-4px',
                  right: '-4px',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#5B4AE6',
                  border: '2px solid white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </button>
              </div>

              {/* Name Fields */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <input
                    type="text"
                    value={profile.firstName}
                    onChange={(e) => updateProfile('firstName', e.target.value)}
                    placeholder="First name"
                    style={{
                      padding: '10px 12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: '1.5px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      backgroundColor: '#FAFAFA'
                    }}
                  />
                  <input
                    type="text"
                    value={profile.lastName}
                    onChange={(e) => updateProfile('lastName', e.target.value)}
                    placeholder="Last name"
                    style={{
                      padding: '10px 12px',
                      fontSize: '14px',
                      fontWeight: 600,
                      border: '1.5px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      backgroundColor: '#FAFAFA'
                    }}
                  />
                </div>

                {/* University */}
                <div style={{ position: 'relative' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={universityQuery}
                    onChange={(e) => {
                      setUniversityQuery(e.target.value)
                      updateProfile('university', '')
                      setShowUniversityDropdown(true)
                    }}
                    onFocus={() => setShowUniversityDropdown(true)}
                    placeholder="University"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: '13px',
                      border: profile.university ? '1.5px solid #5B4AE6' : '1.5px solid #E5E7EB',
                      borderRadius: '10px',
                      outline: 'none',
                      backgroundColor: profile.university ? 'rgba(91,74,230,0.04)' : '#FAFAFA',
                      boxSizing: 'border-box'
                    }}
                  />
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
                        maxHeight: '180px',
                        overflowY: 'auto',
                        zIndex: 50
                      }}
                    >
                      {filteredUniversities.slice(0, 6).map((uni) => (
                        <button
                          key={uni}
                          onClick={() => selectUniversity(uni)}
                          style={{
                            width: '100%',
                            padding: '10px 12px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid #F3F4F6',
                            textAlign: 'left',
                            fontSize: '13px',
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
              </div>
            </div>

            {/* Field Tags */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Fields of Interest
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {FIELDS.map(field => {
                  const isSelected = profile.fields.includes(field)
                  return (
                    <button
                      key={field}
                      onClick={() => toggleField(field)}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        borderRadius: '16px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#5B4AE6' : '#F3F4F6',
                        color: isSelected ? 'white' : '#374151'
                      }}
                    >
                      {field}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Bio */}
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Bio <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <textarea
                value={profile.bio || ''}
                onChange={(e) => updateProfile('bio', e.target.value.slice(0, 160))}
                placeholder="A brief intro about yourself..."
                rows={2}
                maxLength={160}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '13px',
                  border: '1.5px solid #E5E7EB',
                  borderRadius: '10px',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'inherit',
                  backgroundColor: '#FAFAFA',
                  boxSizing: 'border-box',
                  lineHeight: 1.4
                }}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#9CA3AF', textAlign: 'right' }}>
                {(profile.bio || '').length}/160
              </p>
            </div>
          </div>

          {/* ========== LOOKING FOR ========== */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, color: '#111827' }}>
              What I'm looking for
            </h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              {LOOKING_FOR.map(item => {
                const isSelected = profile.lookingFor.includes(item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleLookingFor(item.id)}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #5B4AE6' : '1.5px solid #E5E7EB',
                      backgroundColor: isSelected ? 'rgba(91,74,230,0.05)' : 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{item.icon}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: isSelected ? '#5B4AE6' : '#111827' }}>
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ========== SKILLS ========== */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#111827' }}>
                Skills
              </h3>
              <span style={{ fontSize: '12px', color: '#6B7280' }}>
                {profile.skills.length}/7
              </span>
            </div>

            {/* Selected Skills */}
            {profile.skills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                {profile.skills.map(skill => (
                  <span
                    key={skill}
                    onClick={() => toggleSkill(skill)}
                    style={{
                      padding: '5px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '14px',
                      backgroundColor: '#5B4AE6',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {skill} <span style={{ opacity: 0.7 }}>×</span>
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {SKILLS.filter(s => !profile.skills.includes(s)).map(skill => {
                const isDisabled = profile.skills.length >= 7
                return (
                  <button
                    key={skill}
                    onClick={() => !isDisabled && toggleSkill(skill)}
                    disabled={isDisabled}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 500,
                      borderRadius: '16px',
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
          </div>

          {/* ========== PROJECTS & WORK ========== */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '16px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#111827' }}>
              Projects & Work
            </h3>
            <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#6B7280' }}>
              Link things you've built or worked on
            </p>

            {/* Project Entries */}
            {profile.projects.map((project, index) => (
              <div
                key={index}
                style={{
                  padding: '14px',
                  backgroundColor: '#FAFAFA',
                  borderRadius: '10px',
                  marginBottom: '10px',
                  position: 'relative'
                }}
              >
                <button
                  onClick={() => removeProject(index)}
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
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
                    padding: '8px 10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: 'white',
                    marginBottom: '8px'
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
                    padding: '8px 10px',
                    fontSize: '12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: 'white',
                    marginBottom: '8px'
                  }}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px' }}>
                  <input
                    type="url"
                    value={project.link}
                    onChange={(e) => updateProject(index, 'link', e.target.value)}
                    placeholder="Link (GitHub, Figma, etc.)"
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      outline: 'none',
                      backgroundColor: 'white'
                    }}
                  />
                  <select
                    value={project.role}
                    onChange={(e) => updateProject(index, 'role', e.target.value)}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12px',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      outline: 'none',
                      backgroundColor: 'white',
                      color: project.role ? '#111827' : '#9CA3AF',
                      minWidth: '100px'
                    }}
                  >
                    <option value="">Role</option>
                    {ROLE_OPTIONS.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {/* Add Project Button */}
            <button
              onClick={addProject}
              style={{
                width: '100%',
                padding: '12px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#5B4AE6',
                backgroundColor: 'transparent',
                border: '2px dashed #E5E7EB',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add project
            </button>
          </div>

          {/* ========== LINKS ========== */}
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
          }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 700, color: '#111827' }}>
              Links
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* GitHub */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                </div>
                <input
                  type="url"
                  value={profile.links.github}
                  onChange={(e) => updateLink('github', e.target.value)}
                  placeholder="github.com/username"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: '13px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    backgroundColor: '#FAFAFA'
                  }}
                />
              </div>

              {/* Portfolio */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                </div>
                <input
                  type="url"
                  value={profile.links.portfolio}
                  onChange={(e) => updateLink('portfolio', e.target.value)}
                  placeholder="yoursite.com"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: '13px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    backgroundColor: '#FAFAFA'
                  }}
                />
              </div>

              {/* LinkedIn */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
                <input
                  type="url"
                  value={profile.links.linkedin}
                  onChange={(e) => updateLink('linkedin', e.target.value)}
                  placeholder="linkedin.com/in/username"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: '13px',
                    border: '1.5px solid #E5E7EB',
                    borderRadius: '10px',
                    outline: 'none',
                    backgroundColor: '#FAFAFA'
                  }}
                />
              </div>

              {/* Discord */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </div>
                <input
                  type="text"
                  value={profile.links.discord}
                  onChange={(e) => updateLink('discord', e.target.value)}
                  placeholder="username#1234"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: '13px',
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

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default MyProfileScreen
