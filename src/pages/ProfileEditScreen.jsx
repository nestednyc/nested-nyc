import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { profileService } from '../services/profileService'
import { storageService } from '../services/storageService'

/**
 * ProfileEditScreen - Compact form-only edit experience
 * Grouped into cards to minimize scrolling
 * Required fields: University, Interests, Looking For
 * Save redirects to /profile/:userId
 */

const NYC_UNIVERSITIES = [
  'New York University (NYU)', 'Columbia University', 'Pace University',
  'Parsons School of Design', 'Pratt Institute', 'Fordham University',
  'The New School', 'Baruch College', 'City College of New York (CCNY)',
  'Brooklyn College', 'Hunter College', 'Queens College',
  'NYC College of Technology', 'John Jay College', 'Other NYC school'
]

const FIELDS = ['Engineering', 'Design', 'Product', 'Data Science', 'Business', 'Marketing', 'Research', 'Arts & Media']
const LOOKING_FOR = [
  { id: 'join', label: 'Join a project' },
  { id: 'cofounder', label: 'Co-founder' },
]
// Skills = roles/disciplines (what you do). Tech Stack = tools/frameworks (what you use).
const SKILLS = [
  'Frontend', 'Backend', 'Full Stack', 'Mobile', 'DevOps',
  'UI/UX', 'Product Design', 'Graphic Design',
  'Product', 'Project Mgmt', 'Strategy',
  'Data', 'Data Analysis', 'ML/AI', 'Research',
  'Marketing', 'Growth', 'Content', 'Sales', 'BD',
  'Writing', 'Video', 'Photography'
]
const TECH_STACK_OPTIONS = [
  'React', 'JavaScript', 'TypeScript', 'Python', 'Node.js', 'Next.js', 'Vue', 'Swift',
  'Kotlin', 'Go', 'Rust', 'Figma', 'Supabase', 'Vercel', 'GitHub', 'VS Code',
  'Docker', 'AWS', 'Firebase', 'PostgreSQL', 'MongoDB', 'Web3'
]
const ROLES = ['Frontend', 'Backend', 'Full Stack', 'Designer', 'PM', 'Data', 'Marketing', 'Other']

const STORAGE_KEY = 'nested_user_profile'

function ProfileEditScreen() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showErrors, setShowErrors] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [currentUserId, setCurrentUserId] = useState(null)
  // Each slot is either null (empty) or { url: string, file: File|null }.
  // url is either an existing public URL (no upload needed) or a data: URL
  // preview for newly-picked files (uploaded on save).
  const [photoSlots, setPhotoSlots] = useState([null, null, null])
  // Which slot is the file-picker targeting right now — set just before opening.
  const [activeSlotIdx, setActiveSlotIdx] = useState(null)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)
  const photoInputRef = useRef(null)

  // Check if this is first-time setup (profile not yet complete)
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false)

  // Default profile structure
  const getDefaultProfile = () => ({
    firstName: '',
    lastName: '',
    university: '',
    fields: [],
    bio: '',
    lookingFor: [],
    skills: [],
    techStack: [],
    projects: [],
    avatar: '',
    photos: [],
    links: { github: '', portfolio: '', linkedin: '', discord: '', instagram: '', twitter: '' }
  })

  const loadProfileFromStorage = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return getDefaultProfile()
  }

  const [profile, setProfile] = useState(getDefaultProfile)
  const [showDropdown, setShowDropdown] = useState(false)
  const [uniQuery, setUniQuery] = useState('')

  // Helper to apply profile data to all related state
  const applyProfileData = (profileData, isFromDb = false) => {
    setProfile(prev => ({ ...getDefaultProfile(), ...profileData }))
    setUniQuery(profileData.university || '')
    // Hydrate photo slots from `photos` (post-migration) with fallback to
    // single `avatar` for legacy rows. Pad to 3 slots so each render has a
    // stable index.
    const existing = Array.isArray(profileData.photos) && profileData.photos.length > 0
      ? profileData.photos
      : (profileData.avatar ? [profileData.avatar] : [])
    const padded = [0, 1, 2].map(i => existing[i] ? { url: existing[i], file: null } : null)
    setPhotoSlots(padded)
  }

  // Fetch profile from Supabase on mount
  useEffect(() => {
    const fetchProfile = async () => {
      // Check localStorage first for first-time setup detection
      const saved = localStorage.getItem(STORAGE_KEY)
      setIsFirstTimeSetup(!saved)

      if (!isSupabaseConfigured()) {
        // Fall back to localStorage
        if (saved) {
          try {
            const parsed = JSON.parse(saved)
            applyProfileData(parsed)
          } catch (e) {}
        }
        setLoading(false)
        return
      }

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          // Fall back to localStorage for non-authenticated users
          if (saved) {
            try {
              const parsed = JSON.parse(saved)
              applyProfileData(parsed)
            } catch (e) {}
          }
          setLoading(false)
          return
        }

        setCurrentUserId(user.id)
        const { data, error } = await profileService.getProfile(user.id)

        if (error) {
          console.warn('Could not fetch profile:', error.message)
          // Fall back to localStorage
          if (saved) {
            try {
              const parsed = JSON.parse(saved)
              applyProfileData(parsed)
            } catch (e) {}
          }
          setLoading(false)
          return
        }

        if (data) {
          console.log('Loaded profile from DB:', data) // Debug log
          // Check if this is first-time setup based on DB
          setIsFirstTimeSetup(!data.onboarding_completed)

          // Transform DB format to component format
          const transformedProfile = {
            firstName: data.first_name || '',
            lastName: data.last_name || '',
            university: data.university || '',
            fields: data.fields || [],
            bio: data.bio || '',
            lookingFor: data.looking_for || [],
            skills: data.skills || [],
            techStack: data.tech_stack || [],
            projects: data.projects || [],
            avatar: data.avatar || '',
            photos: Array.isArray(data.photos) ? data.photos : [],
            links: {
              github: '', portfolio: '', linkedin: '', discord: '', instagram: '', twitter: '',
              ...(data.links || {})
            }
          }
          applyProfileData(transformedProfile)
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err)
      }
      setLoading(false)
    }

    fetchProfile()
  }, [])

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const update = (field, value) => setProfile(p => ({ ...p, [field]: value }))
  const toggleArray = (field, item, max = 99) => {
    const arr = profile[field] || []
    if (arr.includes(item)) update(field, arr.filter(i => i !== item))
    else if (arr.length < max) update(field, [...arr, item])
  }

  const updateProject = (idx, key, val) => {
    const projects = (profile.projects || []).map((p, i) => i === idx ? { ...p, [key]: val } : p)
    update('projects', projects)
  }
  const addProject = () => update('projects', [...profile.projects, { name: '', description: '', link: '', role: '' }])
  const removeProject = (idx) => update('projects', profile.projects.filter((_, i) => i !== idx))

  const updateLink = (key, val) => update('links', { ...profile.links, [key]: val })

  // Open the hidden file picker and remember which slot we're targeting.
  const openPhotoPicker = (idx) => {
    setActiveSlotIdx(idx)
    // Reset value so picking the same file twice re-fires onChange.
    if (photoInputRef.current) photoInputRef.current.value = ''
    photoInputRef.current?.click()
  }

  // Remove a photo from a slot (no upload happens; state-only until save).
  const removePhotoSlot = (idx) => {
    setPhotoSlots(prev => prev.map((s, i) => i === idx ? null : s))
  }

  // Handle a freshly-picked file from the file input.
  const handlePhotoSelected = async (e) => {
    const file = e.target.files?.[0]
    const idx = activeSlotIdx
    setActiveSlotIdx(null)
    if (!file || idx === null) return

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      alert('Please use JPG, PNG, GIF, or WebP images.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image too large. Maximum size is 5MB.')
      return
    }

    // Show preview immediately via data URL; actual upload happens on save.
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPhotoSlots(prev => prev.map((s, i) => i === idx ? { url: ev.target.result, file } : s))
    }
    reader.readAsDataURL(file)
  }

  // Validation - required fields
  const errors = useMemo(() => {
    const e = {}
    if (!profile.university || profile.university.trim() === '') {
      e.university = 'University is required'
    }
    if (!profile.fields || profile.fields.length === 0) {
      e.fields = 'Select at least one interest'
    }
    if (!profile.lookingFor || profile.lookingFor.length === 0) {
      e.lookingFor = 'Select what you\'re looking for'
    }
    return e
  }, [profile])

  const isFormValid = Object.keys(errors).length === 0

  const handleSave = async () => {
    // Show errors if form is invalid
    if (!isFormValid) {
      setShowErrors(true)
      return
    }

    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    // Upload any pending photo files sequentially. Sequential (not parallel)
    // is deliberate — on flaky mobile networks a single failure shouldn't
    // wipe the other slots. If one fails we drop just that slot from the
    // saved array and keep going.
    const workingSlots = [...photoSlots]
    const finalPhotos = []
    for (let i = 0; i < workingSlots.length; i++) {
      const slot = workingSlots[i]
      if (!slot) continue
      if (slot.file && currentUserId) {
        const { url, error: uploadError } = await storageService.uploadProfilePhoto(currentUserId, slot.file, i)
        if (uploadError || !url) {
          console.error(`Photo upload failed for slot ${i}:`, uploadError)
          continue
        }
        finalPhotos.push(url)
        workingSlots[i] = { url, file: null }
      } else if (slot.url && !slot.url.startsWith('data:')) {
        finalPhotos.push(slot.url)
      }
    }
    setPhotoSlots(workingSlots)

    const avatarUrl = finalPhotos[0] || null

    // Update profile with new photo data
    const updatedProfile = { ...profile, avatar: avatarUrl, photos: finalPhotos }

    // Always save to localStorage as fallback
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfile))

    // Save to Supabase if configured and user is authenticated
    if (currentUserId && isSupabaseConfigured()) {
      try {
        // Transform component format to DB format
        const dbProfile = {
          first_name: updatedProfile.firstName,
          last_name: updatedProfile.lastName,
          university: updatedProfile.university,
          fields: updatedProfile.fields,
          bio: updatedProfile.bio,
          looking_for: updatedProfile.lookingFor,
          skills: updatedProfile.skills,
          tech_stack: updatedProfile.techStack,
          projects: updatedProfile.projects,
          avatar: avatarUrl,
          photos: finalPhotos,
          links: updatedProfile.links,
          onboarding_completed: true
        }

        console.log('[ProfileEdit] Saving to Supabase. userId:', currentUserId, 'payload:', dbProfile)

        // Use upsert so it works whether the row exists or not
        const { data, error } = await profileService.upsertProfile(currentUserId, dbProfile)

        console.log('[ProfileEdit] Supabase response:', { data, error })

        if (error) {
          console.error('[ProfileEdit] Supabase save failed:', error)
          setSaveError(error.message || 'Failed to save profile. Please try again.')
          setSaving(false)
          return
        }

        if (!data) {
          console.warn('[ProfileEdit] No data returned from upsert — RLS may be blocking the write.')
          setSaveError('Profile may not have saved. Check your Supabase RLS policies.')
          setSaving(false)
          return
        }

        console.log('[ProfileEdit] Save successful:', data)
      } catch (err) {
        console.error('[ProfileEdit] Unexpected error saving profile:', err)
        setSaveError(err.message || 'Unexpected error saving profile.')
        setSaving(false)
        return
      }
    }

    setSaveSuccess(true)
    setTimeout(() => navigate('/profile/me'), 600)
  }

  const filteredUnis = uniQuery
    ? NYC_UNIVERSITIES.filter(u => u.toLowerCase().includes(uniQuery.toLowerCase()))
    : NYC_UNIVERSITIES

  // ── Style objects ──

  const cardStyle = {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid #E5E7EB'
  }

  const labelStyle = {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '6px',
    display: 'block'
  }

  const requiredLabelStyle = {
    ...labelStyle,
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#FAFAFA'
  }

  const errorInputStyle = {
    ...inputStyle,
    borderColor: '#DC2626'
  }

  const chipStyle = (selected) => ({
    padding: '7px 16px',
    fontSize: '13px',
    fontWeight: 500,
    borderRadius: '9999px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: selected ? '#6366F1' : '#F3F4F6',
    color: selected ? 'white' : '#374151',
    transition: 'all 0.15s ease'
  })

  const errorStyle = {
    fontSize: '12px',
    color: '#DC2626',
    marginTop: '6px'
  }

  const sectionHeadingStyle = {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#111827'
  }

  const RequiredBadge = () => (
    <span style={{
      fontSize: '10px',
      fontWeight: 600,
      color: '#DC2626',
      backgroundColor: '#FEE2E2',
      padding: '2px 6px',
      borderRadius: '4px'
    }}>Required</span>
  )

  // Show loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
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
            borderTopColor: '#6366F1',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p style={{ color: '#6B7280', fontSize: '14px' }}>Loading profile...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px',
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {!isFirstTimeSetup && (
            <button onClick={() => navigate(-1)} style={{
              width: '36px', height: '36px', borderRadius: '10px', border: '1px solid #E5E7EB',
              backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </button>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#111827' }}>
              {isFirstTimeSetup ? 'Complete Your Profile' : 'Edit Profile'}
            </h1>
            {isFirstTimeSetup && (
              <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#6B7280' }}>
                Fill in the required fields to continue
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            backgroundColor: '#6366F1',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1
          }}
        >
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#FEF2F2',
          borderBottom: '1px solid #FECACA',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" flexShrink={0}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: '14px', color: '#DC2626', flex: 1 }}>{saveError}</span>
          <button onClick={() => setSaveError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: '18px', lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Save success banner */}
      {saveSuccess && (
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#F0FDF4',
          borderBottom: '1px solid #BBF7D0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span style={{ fontSize: '14px', color: '#16A34A' }}>Profile updated successfully!</span>
        </div>
      )}

      {/* Content - Two Column Layout */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Basic Info Card */}
            <div style={cardStyle}>
              <h3 style={{ ...sectionHeadingStyle, marginBottom: '16px' }}>Basic Info</h3>

              {/* Photo Gallery — up to 3 slots. Slot 0 is the primary photo
                  and becomes the avatar shown everywhere else in the app. */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
                  {[0, 1, 2].map(idx => {
                    const slot = photoSlots[idx]
                    return (
                      <div key={idx} style={{ position: 'relative' }}>
                        <div
                          onClick={() => openPhotoPicker(idx)}
                          style={{
                            width: '88px',
                            height: '88px',
                            borderRadius: '14px',
                            backgroundColor: slot ? 'transparent' : '#F9FAFB',
                            border: slot ? '2px solid #6366F1' : '2px dashed #D1D5DB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            backgroundImage: slot ? `url(${slot.url})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        >
                          {!slot && (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
                              <line x1="12" y1="5" x2="12" y2="19"/>
                              <line x1="5" y1="12" x2="19" y2="12"/>
                            </svg>
                          )}
                        </div>
                        {idx === 0 && slot && (
                          <div style={{
                            position: 'absolute', top: '4px', left: '4px',
                            padding: '2px 6px', borderRadius: '4px',
                            backgroundColor: 'rgba(99, 102, 241, 0.92)', color: 'white',
                            fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px',
                            textTransform: 'uppercase', pointerEvents: 'none'
                          }}>Primary</div>
                        )}
                        {slot && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removePhotoSlot(idx) }}
                            aria-label="Remove photo"
                            style={{
                              position: 'absolute', top: '-6px', right: '-6px',
                              width: '22px', height: '22px', borderRadius: '50%',
                              backgroundColor: 'white', border: '1px solid #E5E7EB',
                              cursor: 'pointer', display: 'flex', alignItems: 'center',
                              justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                              padding: 0, fontSize: '14px', lineHeight: 1, color: '#6B7280'
                            }}
                          >×</button>
                        )}
                      </div>
                    )
                  })}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handlePhotoSelected}
                  style={{ display: 'none' }}
                />
                <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF' }}>
                  Up to 3 photos. First slot is your primary photo (shown as avatar everywhere). JPG, PNG, GIF or WebP. Max 5MB each.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input type="text" value={profile.firstName} onChange={e => update('firstName', e.target.value)} placeholder="First" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input type="text" value={profile.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Last" style={inputStyle} />
                </div>
              </div>

              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <label style={requiredLabelStyle}>
                  University <RequiredBadge />
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={uniQuery}
                  onChange={e => { setUniQuery(e.target.value); update('university', ''); setShowDropdown(true) }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search university..."
                  style={showErrors && errors.university ? errorInputStyle : { ...inputStyle, borderColor: profile.university ? '#6366F1' : '#E5E7EB' }}
                />
                {showErrors && errors.university && (
                  <div style={errorStyle}>{errors.university}</div>
                )}
                {showDropdown && filteredUnis.length > 0 && (
                  <div ref={dropdownRef} style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '2px',
                    backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E5E7EB',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '160px', overflowY: 'auto', zIndex: 50
                  }}>
                    {filteredUnis.slice(0, 5).map(uni => (
                      <button key={uni} onClick={() => { setUniQuery(uni); update('university', uni); setShowDropdown(false) }}
                        style={{ width: '100%', padding: '10px 12px', backgroundColor: 'transparent', border: 'none',
                          borderBottom: '1px solid #F3F4F6', textAlign: 'left', fontSize: '13px', color: '#111827', cursor: 'pointer' }}>
                        {uni}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <label style={labelStyle}>Bio (optional)</label>
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                    {(profile.bio || '').length}/120
                  </span>
                </div>
                <textarea
                  value={profile.bio || ''}
                  onChange={e => update('bio', e.target.value.slice(0, 120))}
                  placeholder="Building X · Looking for cofounder"
                  rows={2}
                  style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }}
                />
              </div>
            </div>

            {/* Interests */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <h3 style={sectionHeadingStyle}>Interests</h3>
                <RequiredBadge />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {FIELDS.map(f => (
                  <button key={f} onClick={() => toggleArray('fields', f)} style={chipStyle(profile.fields.includes(f))}>{f}</button>
                ))}
              </div>
              {showErrors && errors.fields && (
                <div style={errorStyle}>{errors.fields}</div>
              )}
            </div>

            {/* Looking For */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <h3 style={sectionHeadingStyle}>Looking For</h3>
                <RequiredBadge />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                {LOOKING_FOR.map(item => {
                  const sel = (profile.lookingFor || []).includes(item.id)
                  return (
                    <button key={item.id} onClick={() => toggleArray('lookingFor', item.id)} style={{
                      flex: 1, padding: '14px', borderRadius: '10px', border: sel ? '2px solid #6366F1' : '1px solid #E5E7EB',
                      backgroundColor: sel ? 'rgba(99,102,241,0.06)' : 'white', cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: '6px'
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: sel ? '#6366F1' : '#111827' }}>{item.label}</span>
                    </button>
                  )
                })}
              </div>
              {showErrors && errors.lookingFor && (
                <div style={errorStyle}>{errors.lookingFor}</div>
              )}
            </div>

            {/* Skills */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={sectionHeadingStyle}>Skills</h3>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>{(profile.skills || []).length}/7</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {SKILLS.map(s => (
                  <button key={s} onClick={() => toggleArray('skills', s, 7)} style={chipStyle((profile.skills || []).includes(s))}>{s}</button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Tech Stack */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <h3 style={sectionHeadingStyle}>Tech Stack</h3>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>{(profile.techStack || []).length}/12</span>
              </div>
              <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#9CA3AF' }}>
                Optional — shown on your public profile
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {TECH_STACK_OPTIONS.map(t => (
                  <button key={t} onClick={() => toggleArray('techStack', t, 12)} style={chipStyle((profile.techStack || []).includes(t))}>{t}</button>
                ))}
              </div>
              <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#9CA3AF' }}>
                Select technologies you work with to display on your profile
              </p>
            </div>

            {/* Links */}
            <div style={cardStyle}>
              <h3 style={{ ...sectionHeadingStyle, marginBottom: '14px' }}>Links</h3>

              {[
                { key: 'github', placeholder: 'github.com/username', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                )},
                { key: 'portfolio', placeholder: 'yoursite.com', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                )},
                { key: 'linkedin', placeholder: 'linkedin.com/in/username', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                )},
                { key: 'discord', placeholder: 'username#1234', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                )},
                { key: 'instagram', placeholder: '@username or instagram.com/username', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                )},
                { key: 'twitter', placeholder: '@username or x.com/username', icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                )}
              ].map(({ key, placeholder, icon }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {icon}
                  </div>
                  <input type={key === 'discord' ? 'text' : 'url'} value={profile.links?.[key] || ''} onChange={e => updateLink(key, e.target.value)}
                    placeholder={placeholder} style={{ ...inputStyle, flex: 1 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileEditScreen
