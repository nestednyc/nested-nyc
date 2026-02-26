import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, getErrorMessage } from '../lib/supabase'
import { profileService } from '../services/profileService'
import { storageService } from '../services/storageService'
import { lookupService } from '../services/lookupService'

/**
 * AuthGateScreen - Modern 2-step signup + login
 * Connected to Supabase authentication
 */

function AuthGateScreen() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('signup') // 'signup' | 'login'
  const [signupStep, setSignupStep] = useState(1) // 1 | 2 | 3 | 4

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSignupStep(1) // Reset to step 1 when switching tabs
  }

  // Hide tabs during profile setup steps (3 & 4)
  const showTabs = signupStep <= 2

  return (
    <div style={{
      minHeight: '100%',
      background: 'linear-gradient(135deg, #FAFBFF 0%, #FFFFFF 50%, #F8F9FF 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
      position: 'relative',
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch'
    }}>
      {/* Purple Circle Background Accents - Behind everything */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        {/* Top-left large blur circle */}
        <div style={{
          position: 'absolute',
          top: '-120px',
          left: '-100px',
          width: '350px',
          height: '350px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 40%, rgba(139, 124, 246, 0.15), rgba(91, 74, 230, 0.04))',
          filter: 'blur(40px)'
        }} />

        {/* Top-right circle */}
        <div style={{
          position: 'absolute',
          top: '-80px',
          right: '-120px',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, rgba(167, 139, 250, 0.1), rgba(139, 124, 246, 0.02))',
          filter: 'blur(50px)'
        }} />

        {/* Bottom-left circle */}
        <div style={{
          position: 'absolute',
          bottom: '-140px',
          left: '-80px',
          width: '300px',
          height: '300px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 50% 50%, rgba(91, 74, 230, 0.1), rgba(167, 139, 250, 0.03))',
          filter: 'blur(45px)'
        }} />

        {/* Bottom-right small accent */}
        <div style={{
          position: 'absolute',
          bottom: '-60px',
          right: '-50px',
          width: '200px',
          height: '200px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 40% 40%, rgba(139, 124, 246, 0.12), rgba(91, 74, 230, 0.03))',
          filter: 'blur(35px)'
        }} />
      </div>

      {/* Card - Clean, minimal shadow */}
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
        padding: '32px 28px',
        animation: 'fadeUp 0.4s ease-out',
        position: 'relative',
        zIndex: 10,
        backdropFilter: 'blur(10px)'
      }}>
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(20px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes slideOut {
            from { opacity: 0; transform: translateX(-20px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}</style>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <span style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            color: '#5B4AE6'
          }}>
            NESTED
          </span>
        </div>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{
            margin: '0 0 6px 0',
            fontSize: '24px',
            fontWeight: 700,
            color: '#111827'
          }}>
            Welcome to Nested
          </h1>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#6B7280'
          }}>
            Build projects. Meet builders. Grow together.
          </p>
        </div>

        {/* Tabs - hidden during profile setup */}
        {showTabs && (
          <div style={{
            display: 'flex',
            backgroundColor: '#F3F4F6',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '24px'
          }}>
            {['signup', 'login'].map(tab => (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  backgroundColor: activeTab === tab ? '#FFFFFF' : 'transparent',
                  color: activeTab === tab ? '#111827' : '#6B7280',
                  boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                {tab === 'signup' ? 'Sign Up' : 'Log In'}
              </button>
            ))}
          </div>
        )}

        {/* Progress indicator for profile setup */}
        {!showTabs && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              {[1, 2, 3, 4].map(s => (
                <div
                  key={s}
                  style={{
                    width: s <= signupStep ? '24px' : '8px',
                    height: '8px',
                    borderRadius: '4px',
                    backgroundColor: s <= signupStep ? '#5B4AE6' : '#E5E7EB',
                    transition: 'all 0.3s ease'
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Forms */}
        {activeTab === 'signup' ? (
          <SignUpForm
            step={signupStep}
            setStep={setSignupStep}
            navigate={navigate}
            onSwitchToLogin={() => {
              setActiveTab('login')
              setSignupStep(1)
            }}
          />
        ) : (
          <LoginForm navigate={navigate} />
        )}
      </div>
    </div>
  )
}

// Profile setup options
const NYC_UNIVERSITIES = [
  'New York University (NYU)', 'Columbia University', 'Pace University',
  'Parsons School of Design', 'Pratt Institute', 'Fordham University',
  'The New School', 'Baruch College', 'City College of New York (CCNY)',
  'Brooklyn College', 'Hunter College', 'Queens College',
  'NYC College of Technology', 'John Jay College', 'Other'
]

const FIELDS = ['Engineering', 'Design', 'Product', 'Data Science', 'Business', 'Marketing', 'Research', 'Arts & Media']
const SKILLS = [
  'React', 'Python', 'JavaScript', 'TypeScript', 'Node.js', 'Backend', 'Frontend',
  'Full Stack', 'UI/UX', 'Figma', 'Product', 'Data', 'ML/AI', 'Mobile', 'Marketing'
]
const LOOKING_FOR = [
  { id: 'join', label: 'Join a project' },
  { id: 'cofounder', label: 'Find a co-founder' },
  { id: 'team', label: 'Build a team' },
  { id: 'learn', label: 'Learn & explore' }
]

/**
 * SignUpForm - 4-step signup with profile setup
 * Step 1: Email, Name
 * Step 2: Username, Password
 * Step 3: University, Interests
 * Step 4: Skills, Looking For
 */
function SignUpForm({ step, setStep, navigate, onSwitchToLogin }) {
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    confirmPassword: '',
    // Profile fields
    university: '',
    fields: [],
    skills: [],
    lookingFor: []
  })
  const [touched, setTouched] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailTakenError, setEmailTakenError] = useState(false)
  const [userId, setUserId] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const fileInputRef = useRef(null)

  // Lookup states for duplicate prevention
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [emailExists, setEmailExists] = useState(false)
  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameError, setUsernameError] = useState(null) // Format or availability error

  // Handle avatar file selection
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Please use JPG, PNG, GIF, or WebP images.')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image too large. Maximum size is 5MB.')
      return
    }

    setAvatarFile(file)
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => setAvatarPreview(e.target.result)
    reader.readAsDataURL(file)
    setError(null)
  }

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
    // Clear specific lookup errors when user types
    if (field === 'email') {
      setEmailExists(false)
      setEmailTakenError(false)
    }
    if (field === 'username') {
      setUsernameError(null)
    }
  }

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  // Check if email already exists when user leaves email field
  const handleEmailBlur = async () => {
    setTouched(prev => ({ ...prev, email: true }))

    // Only check if email is valid format and .edu
    if (!form.email || !form.email.toLowerCase().endsWith('.edu')) {
      return
    }

    setCheckingEmail(true)
    setEmailExists(false)
    setEmailTakenError(false)

    try {
      const { exists } = await lookupService.checkEmailExists(form.email)
      if (exists) {
        setEmailExists(true)
        setEmailTakenError(true)
      }
    } catch (err) {
      console.error('Email lookup error:', err)
    } finally {
      setCheckingEmail(false)
    }
  }

  // Check username format and availability
  const handleUsernameBlur = async () => {
    setTouched(prev => ({ ...prev, username: true }))

    if (!form.username) {
      setUsernameError(null)
      return
    }

    // First validate format
    const formatCheck = lookupService.validateUsernameFormat(form.username)
    if (!formatCheck.valid) {
      setUsernameError(formatCheck.error)
      return
    }

    setCheckingUsername(true)
    setUsernameError(null)

    try {
      const { available, error } = await lookupService.checkUsernameAvailable(form.username)
      if (error && error.message !== 'Lookup failed') {
        setUsernameError(error.message)
      } else if (!available) {
        setUsernameError('This username is already taken')
      }
    } catch (err) {
      console.error('Username lookup error:', err)
    } finally {
      setCheckingUsername(false)
    }
  }

  const toggleArrayItem = (field, item) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }))
  }

  // Step 1 validation
  const emailError = useMemo(() => {
    if (!form.email) return null
    if (!form.email.toLowerCase().endsWith('.edu')) {
      return 'Only verified university emails are allowed'
    }
    return null
  }, [form.email])

  // Step 2 validation
  const passwordValid = form.password.length >= 6 && /[A-Z]/.test(form.password)
  const confirmValid = form.confirmPassword && form.password === form.confirmPassword

  // Step 1 -> Step 2
  const handleContinue = (e) => {
    e.preventDefault()
    setStep(2)
  }

  // Step 2 -> Step 3 (Create account in Supabase)
  const handleCreateAccount = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setEmailTakenError(false)

    // Validate passwords match before calling Supabase
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      setIsLoading(false)
      return
    }

    // Validate username is set and not taken
    if (!form.username) {
      setError('Please choose a username.')
      setIsLoading(false)
      return
    }
    if (usernameError) {
      setError(usernameError)
      setIsLoading(false)
      return
    }

    try {
      const { data, error: signUpError } = await authService.signUpWithEmailPassword(
        form.email,
        form.password
      )

      // Handle specific error cases
      if (signUpError) {
        const errorMsg = signUpError.message?.toLowerCase() || ''

        // If user already exists, try signing in (handles back-button case where account was already created)
        if (errorMsg.includes('already registered') || signUpError.code === 'USER_EXISTS' || errorMsg.includes('user already registered')) {
          const { data: signInData, error: signInError } = await authService.signInWithEmailPassword(
            form.email,
            form.password
          )

          if (!signInError && signInData?.user?.id) {
            setUserId(signInData.user.id)
            setStep(3)
            setIsLoading(false)
            return
          }

          // Sign-in failed — wrong password or different account
          setEmailTakenError(true)
          setIsLoading(false)
          return
        }

        // Rate limit - account was likely created, try to sign in
        if (errorMsg.includes('security') || errorMsg.includes('rate limit')) {
          const { data: signInData, error: signInError } = await authService.signInWithEmailPassword(
            form.email,
            form.password
          )

          if (!signInError && signInData?.user?.id) {
            setUserId(signInData.user.id)
            setStep(3)
            setIsLoading(false)
            return
          }

          setError('Please wait a moment before trying again.')
          setIsLoading(false)
          return
        }

        setError(getErrorMessage(signUpError))
        setIsLoading(false)
        return
      }

      // Store user ID for profile creation
      if (data?.user?.id) {
        setUserId(data.user.id)
      }

      // Move to profile setup
      setStep(3)
    } catch (err) {
      console.error('Signup error:', err)
      setError('Failed to create account. Please try again.')
    }
    setIsLoading(false)
  }

  // Step 3 -> Step 4
  const handleProfileContinue = (e) => {
    e.preventDefault()
    if (form.university && form.fields.length > 0) {
      setStep(4)
    }
  }

  // Step 4 -> Complete (Save profile and navigate)
  const handleComplete = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      let avatarUrl = null

      // Upload avatar if selected
      if (avatarFile && userId) {
        const { url, error: uploadError } = await storageService.uploadAvatar(userId, avatarFile)
        if (uploadError) {
          console.error('Avatar upload error:', uploadError)
        } else {
          avatarUrl = url
        }
      }

      // Save profile to localStorage first (as fallback)
      const profileData = {
        firstName: form.firstName,
        lastName: form.lastName,
        university: form.university,
        fields: form.fields,
        skills: form.skills,
        lookingFor: form.lookingFor,
        avatar: avatarUrl || avatarPreview, // Use preview as fallback
        bio: '',
        links: { github: '', portfolio: '', linkedin: '', discord: '' }
      }
      localStorage.setItem('nested_user_profile', JSON.stringify(profileData))

      // Get user ID — prefer stored userId, fall back to current auth session
      let uid = userId
      if (!uid) {
        const { data: { user } } = await authService.getUser()
        uid = user?.id
      }

      // Save to Supabase (upsert in case trigger hasn't run yet)
      if (uid) {
        const { error: saveErr } = await profileService.upsertProfile(uid, {
          first_name: form.firstName,
          last_name: form.lastName,
          username: form.username || null,
          university: form.university,
          fields: form.fields,
          skills: form.skills,
          looking_for: form.lookingFor,
          avatar: avatarUrl,
          onboarding_completed: true
        })
        if (saveErr) console.error('Profile save error:', saveErr)
      }

      // Clear tutorial flag so new user sees welcome popup
      localStorage.removeItem('nested_tutorial_seen')

      // Navigate to app
      navigate('/discover')
    } catch (err) {
      console.error('Profile save error:', err)
      // Still navigate even if DB save fails - localStorage is backup
      navigate('/discover')
    }
    setIsLoading(false)
  }

  if (step === 1) {
    return (
      <form onSubmit={handleContinue} style={{ animation: 'slideOut 0.25s ease-out' }}>
        {/* Email */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>School email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => handleChange('email', e.target.value)}
            onBlur={handleEmailBlur}
            placeholder="you@university.edu"
            style={inputStyle(touched.email && (emailError || emailExists))}
          />
          {touched.email && emailError && (
            <div style={errorStyle}>{emailError}</div>
          )}
          {checkingEmail && (
            <div style={hintStyle}>Checking email...</div>
          )}
        </div>

        {/* Email already registered banner */}
        {emailExists && (
          <div style={{
            marginBottom: '16px',
            padding: '14px 16px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #F59E0B',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '18px' }}>&#9888;&#65039;</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#92400E', fontWeight: 500 }}>
                This email is already registered.
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#A16207' }}>
                Try{' '}
                <button
                  type="button"
                  onClick={() => {
                    setEmailExists(false)
                    setEmailTakenError(false)
                    onSwitchToLogin()
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    color: '#B45309',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  logging in
                </button>
                {' '}instead.
              </p>
            </div>
          </div>
        )}

        {/* Name row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>First name</label>
            <input
              type="text"
              value={form.firstName}
              onChange={e => handleChange('firstName', e.target.value)}
              placeholder="First"
              style={inputStyle(false)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Last name</label>
            <input
              type="text"
              value={form.lastName}
              onChange={e => handleChange('lastName', e.target.value)}
              placeholder="Last"
              style={inputStyle(false)}
            />
          </div>
        </div>

        {/* Continue */}
        <button type="submit" onClick={(e) => { e.preventDefault(); handleContinue(e); }} style={primaryButtonStyle}>
          Continue
        </button>
      </form>
    )
  }

  // Step 2
  if (step === 2) {
    return (
      <form onSubmit={handleCreateAccount} style={{ animation: 'slideIn 0.25s ease-out' }}>
      {/* Username */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Username</label>
        <input
          type="text"
          value={form.username}
          onChange={e => handleChange('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          onBlur={handleUsernameBlur}
          placeholder="Choose a username"
          style={inputStyle(touched.username && usernameError, touched.username && form.username && !usernameError && !checkingUsername)}
        />
        {checkingUsername && (
          <div style={hintStyle}>Checking availability...</div>
        )}
        {touched.username && usernameError && (
          <div style={errorStyle}>{usernameError}</div>
        )}
        {touched.username && form.username && !usernameError && !checkingUsername && (
          <div style={successStyle}>
            <CheckIcon /> Username available
          </div>
        )}
      </div>

      {/* Password */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Create password</label>
        <input
          type="password"
          value={form.password}
          onChange={e => handleChange('password', e.target.value)}
          onBlur={() => handleBlur('password')}
          placeholder="6+ characters, 1 uppercase"
          style={inputStyle(false, touched.password && passwordValid)}
        />
        {touched.password && form.password && (
          <div style={passwordValid ? successStyle : hintStyle}>
            {passwordValid ? (
              <>
                <CheckIcon /> Password is valid
              </>
            ) : (
              'Min 6 characters, 1 uppercase'
            )}
          </div>
        )}
      </div>

      {/* Confirm Password */}
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Confirm password</label>
        <input
          type="password"
          value={form.confirmPassword}
          onChange={e => handleChange('confirmPassword', e.target.value)}
          onBlur={() => handleBlur('confirmPassword')}
          placeholder="Re-enter password"
          style={inputStyle(false, touched.confirmPassword && confirmValid)}
        />
        {touched.confirmPassword && form.confirmPassword && (
          <div style={confirmValid ? successStyle : errorStyle}>
            {confirmValid ? (
              <>
                <CheckIcon /> Passwords match
              </>
            ) : (
              'Passwords do not match'
            )}
          </div>
        )}
      </div>

      {/* Email taken banner */}
      {emailTakenError && (
        <div style={{
          marginBottom: '16px',
          padding: '14px 16px',
          backgroundColor: '#FEF3C7',
          border: '1px solid #F59E0B',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#92400E', fontWeight: 500 }}>
              This email is already registered.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#A16207' }}>
              Try{' '}
              <button
                type="button"
                onClick={() => {
                  setEmailTakenError(false)
                  setError(null)
                  onSwitchToLogin()
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: '#B45309',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                logging in
              </button>
              {' '}instead.
            </p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && !emailTakenError && (
        <div style={{ ...errorStyle, marginBottom: '16px', padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Buttons */}
      <button type="submit" onClick={(e) => { e.preventDefault(); handleCreateAccount(e); }} style={primaryButtonStyle} disabled={isLoading}>
        {isLoading ? 'Creating...' : 'Create Account'}
      </button>
      <button
        type="button"
        onClick={() => { setStep(1); setEmailTakenError(false); }}
        style={textButtonStyle}
        disabled={isLoading}
      >
        Back
      </button>
    </form>
    )
  }

  // Step 3: University & Interests
  if (step === 3) {
    return (
      <form onSubmit={handleProfileContinue} style={{ animation: 'slideIn 0.25s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>Almost there!</h3>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6B7280' }}>Tell us about yourself</p>
        </div>

        {/* Avatar Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              backgroundColor: avatarPreview ? 'transparent' : '#F3F4F6',
              border: '3px dashed #D1D5DB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              overflow: 'hidden',
              transition: 'all 0.2s',
              backgroundImage: avatarPreview ? `url(${avatarPreview})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            {!avatarPreview && (
              <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
                <div style={{ fontSize: '28px', marginBottom: '2px' }}>📷</div>
                <div style={{ fontSize: '11px', fontWeight: 500 }}>Add Photo</div>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
          {avatarPreview && (
            <button
              type="button"
              onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
              style={{
                marginTop: '8px',
                fontSize: '12px',
                color: '#6B7280',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Remove photo
            </button>
          )}
          <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '6px' }}>Optional</p>
        </div>

        {error && (
          <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '8px', color: '#DC2626', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {/* University */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Your University</label>
          <select
            value={form.university}
            onChange={e => handleChange('university', e.target.value)}
            style={{ ...inputStyle(false), cursor: 'pointer' }}
          >
            <option value="">Select university</option>
            {NYC_UNIVERSITIES.map(uni => (
              <option key={uni} value={uni}>{uni}</option>
            ))}
          </select>
        </div>

        {/* Interests/Fields */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>What are you into? <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(pick 1-3)</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {FIELDS.map(field => (
              <button
                key={field}
                type="button"
                onClick={() => toggleArrayItem('fields', field)}
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: form.fields.includes(field) ? '#5B4AE6' : '#F3F4F6',
                  color: form.fields.includes(field) ? '#FFFFFF' : '#374151'
                }}
              >
                {field}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          style={{
            ...primaryButtonStyle,
            opacity: form.university && form.fields.length > 0 ? 1 : 0.5
          }}
          disabled={!form.university || form.fields.length === 0}
        >
          Continue
        </button>
        <button type="button" onClick={() => setStep(2)} style={textButtonStyle}>
          Back
        </button>
      </form>
    )
  }

  // Step 4: Skills & Looking For
  if (step === 4) {
    return (
      <form onSubmit={handleComplete} style={{ animation: 'slideIn 0.25s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚀</div>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>Last step!</h3>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#6B7280' }}>Help us match you with the right projects</p>
        </div>

        {/* Skills */}
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Your Skills <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(pick a few)</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SKILLS.map(skill => (
              <button
                key={skill}
                type="button"
                onClick={() => toggleArrayItem('skills', skill)}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: form.skills.includes(skill) ? '#10B981' : '#F3F4F6',
                  color: form.skills.includes(skill) ? '#FFFFFF' : '#374151'
                }}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>

        {/* Looking For */}
        <div style={{ marginBottom: '20px' }}>
          <label style={labelStyle}>What are you looking for?</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {LOOKING_FOR.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleArrayItem('lookingFor', item.id)}
                style={{
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: `2px solid ${form.lookingFor.includes(item.id) ? '#5B4AE6' : '#E5E7EB'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backgroundColor: form.lookingFor.includes(item.id) ? '#F5F3FF' : '#FFFFFF',
                  color: form.lookingFor.includes(item.id) ? '#5B4AE6' : '#374151',
                  textAlign: 'left'
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ ...errorStyle, marginBottom: '16px', padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          style={{
            ...primaryButtonStyle,
            opacity: form.skills.length > 0 && form.lookingFor.length > 0 ? 1 : 0.5
          }}
          disabled={isLoading || form.skills.length === 0 || form.lookingFor.length === 0}
        >
          {isLoading ? 'Setting up...' : "Let's Go! 🎉"}
        </button>
        <button type="button" onClick={() => setStep(3)} style={textButtonStyle} disabled={isLoading}>
          Back
        </button>
      </form>
    )
  }
}

/**
 * LoginForm - Simple login with Supabase
 */
function LoginForm({ navigate }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [touched, setTouched] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  const emailError = useMemo(() => {
    if (!form.email) return null
    if (!form.email.toLowerCase().endsWith('.edu')) {
      return 'Please use a .edu email'
    }
    return null
  }, [form.email])

  const handleSubmit = async (e) => {
    e.preventDefault()
    console.log('[DEBUG] handleSubmit (login) called', { email: form.email, passwordLen: form.password.length })
    setIsLoading(true)
    setError(null)

    try {
      console.log('[DEBUG] Calling authService.signInWithEmailPassword...')
      const { data, error: signInError } = await authService.signInWithEmailPassword(
        form.email,
        form.password
      )
      console.log('[DEBUG] signIn result:', { data, error: signInError })

      if (signInError) {
        setError(getErrorMessage(signInError))
        setIsLoading(false)
        return
      }

      // Success - navigate to app
      navigate('/discover')
    } catch (err) {
      setError('Failed to sign in. Please try again.')
    }
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} style={{ animation: 'slideOut 0.25s ease-out' }}>
      {/* Email */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>School email</label>
        <input
          type="email"
          value={form.email}
          onChange={e => handleChange('email', e.target.value)}
          onBlur={() => handleBlur('email')}
          placeholder="you@university.edu"
          style={inputStyle(touched.email && emailError)}
        />
        {touched.email && emailError && (
          <div style={errorStyle}>{emailError}</div>
        )}
      </div>

      {/* Password */}
      <div style={{ marginBottom: '20px' }}>
        <label style={labelStyle}>Password</label>
        <input
          type="password"
          value={form.password}
          onChange={e => handleChange('password', e.target.value)}
          placeholder="Enter password"
          style={inputStyle(false)}
        />
      </div>

      {/* Error */}
      {error && (
        <div style={{ ...errorStyle, marginBottom: '16px', padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '8px' }}>
          {error}
        </div>
      )}

      {/* Submit */}
      <button type="submit" onClick={(e) => { e.preventDefault(); handleSubmit(e); }} style={primaryButtonStyle} disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Log In'}
      </button>
    </form>
  )
}

// Shared styles
const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px'
}

const inputStyle = (hasError, hasSuccess = false) => ({
  width: '100%',
  height: '46px',
  padding: '0 14px',
  fontSize: '15px',
  fontFamily: 'inherit',
  border: `1.5px solid ${hasError ? '#EF4444' : hasSuccess ? '#10B981' : '#E5E7EB'}`,
  borderRadius: '10px',
  outline: 'none',
  backgroundColor: '#FAFAFA',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s, background-color 0.2s'
})

const errorStyle = {
  fontSize: '12px',
  color: '#EF4444',
  marginTop: '6px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
}

const successStyle = {
  fontSize: '12px',
  color: '#10B981',
  marginTop: '6px',
  display: 'flex',
  alignItems: 'center',
  gap: '4px'
}

const hintStyle = {
  fontSize: '12px',
  color: '#9CA3AF',
  marginTop: '6px'
}

const primaryButtonStyle = {
  width: '100%',
  height: '48px',
  backgroundColor: '#5B4AE6',
  color: 'white',
  fontSize: '15px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'transform 0.1s, opacity 0.2s'
}

const textButtonStyle = {
  width: '100%',
  height: '40px',
  backgroundColor: 'transparent',
  color: '#6B7280',
  fontSize: '14px',
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
  marginTop: '8px'
}

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

export default AuthGateScreen
