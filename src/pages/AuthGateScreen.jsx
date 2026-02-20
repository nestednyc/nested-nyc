import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * AuthGateScreen - Modern 2-step signup + login
 * Frontend only, no redirects, no backend
 */

function AuthGateScreen() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('signup') // 'signup' | 'login'
  const [signupStep, setSignupStep] = useState(1) // 1 | 2

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSignupStep(1) // Reset to step 1 when switching tabs
  }

  return (
    <div style={{
      minHeight: '100%',
      background: 'linear-gradient(135deg, #FAFBFF 0%, #FFFFFF 50%, #F8F9FF 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      position: 'relative',
      overflow: 'hidden'
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

        {/* Tabs */}
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

        {/* Forms */}
        {activeTab === 'signup' ? (
          <SignUpForm step={signupStep} setStep={setSignupStep} navigate={navigate} />
        ) : (
          <LoginForm navigate={navigate} />
        )}
      </div>
    </div>
  )
}

/**
 * SignUpForm - 2-step signup
 */
function SignUpForm({ step, setStep, navigate }) {
  const [form, setForm] = useState({
    email: '',
    firstName: '',
    lastName: '',
    username: '',
    password: '',
    confirmPassword: ''
  })
  const [touched, setTouched] = useState({})

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }))
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

  const handleContinue = (e) => {
    e.preventDefault()
    console.log('Step 1 complete:', { email: form.email, firstName: form.firstName, lastName: form.lastName })
    setStep(2)
  }

  const handleCreateAccount = (e) => {
    e.preventDefault()
    console.log('Account created:', form)
    navigate('/discover')
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
            onBlur={() => handleBlur('email')}
            placeholder="you@university.edu"
            style={inputStyle(touched.email && emailError)}
          />
          {touched.email && emailError && (
            <div style={errorStyle}>{emailError}</div>
          )}
        </div>

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
        <button type="submit" style={primaryButtonStyle}>
          Continue
        </button>
      </form>
    )
  }

  // Step 2
  return (
    <form onSubmit={handleCreateAccount} style={{ animation: 'slideIn 0.25s ease-out' }}>
      {/* Username */}
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyle}>Username</label>
        <input
          type="text"
          value={form.username}
          onChange={e => handleChange('username', e.target.value.toLowerCase())}
          placeholder="Choose a username"
          style={inputStyle(false)}
        />
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

      {/* Buttons */}
      <button type="submit" style={primaryButtonStyle}>
        Create Account
      </button>
      <button
        type="button"
        onClick={() => setStep(1)}
        style={textButtonStyle}
      >
        Back
      </button>
    </form>
  )
}

/**
 * LoginForm - Simple login
 */
function LoginForm({ navigate }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [touched, setTouched] = useState({})

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
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

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Login clicked:', form)
    navigate('/discover')
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

      {/* Submit */}
      <button type="submit" style={primaryButtonStyle}>
        Log In
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
