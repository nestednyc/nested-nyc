import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, getErrorMessage } from '../lib/supabase'

/**
 * OrgSignupScreen
 * Dedicated signup path for organizations (universities, student clubs, etc.).
 * No .edu validation — orgs use institutional addresses of any domain.
 * On success, routes to /onboarding/org for org-profile setup.
 */
function OrgSignupScreen() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' })
  const [touched, setTouched] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emailTakenError, setEmailTakenError] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setError(null)
    if (field === 'email') setEmailTakenError(false)
  }

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }))
  }

  const emailError = useMemo(() => {
    if (!form.email) return null
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return 'Please enter a valid email address'
    }
    return null
  }, [form.email])

  const passwordValid = form.password.length >= 6 && /[A-Z]/.test(form.password)
  const confirmValid = form.confirmPassword && form.password === form.confirmPassword
  const canSubmit = !emailError && form.email && passwordValid && confirmValid

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setIsLoading(true)
    setError(null)
    setEmailTakenError(false)

    try {
      const { data, error: signUpError } = await authService.signUpAsOrg(form.email, form.password)

      if (signUpError) {
        const msg = signUpError.message?.toLowerCase() || ''
        if (signUpError.code === 'USER_EXISTS' || msg.includes('already registered')) {
          setEmailTakenError(true)
          setIsLoading(false)
          return
        }
        setError(getErrorMessage(signUpError))
        setIsLoading(false)
        return
      }

      if (data?.needsEmailConfirmation) {
        setNeedsConfirmation(true)
        setIsLoading(false)
        return
      }

      navigate('/onboarding/org')
    } catch (err) {
      setError('Failed to create account. Please try again.')
      setIsLoading(false)
    }
  }

  if (needsConfirmation) {
    return (
      <ScreenShell>
        <Header />
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📬</div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: '#111827' }}>
            Check your inbox
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#6B7280', lineHeight: 1.5 }}>
            We sent a confirmation link to <strong>{form.email}</strong>.
            Open it to finish setting up your organization.
          </p>
        </div>
        <button onClick={() => navigate('/auth')} style={textButtonStyle}>
          Back to sign in
        </button>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell>
      <Header />

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Work email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            placeholder="events@yourorg.com"
            style={inputStyle(touched.email && (emailError || emailTakenError))}
          />
          {touched.email && emailError && <div style={errorStyle}>{emailError}</div>}
        </div>

        {emailTakenError && (
          <div style={bannerStyle}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#92400E', fontWeight: 500 }}>
                This email is already registered.
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#A16207' }}>
                <button
                  type="button"
                  onClick={() => navigate('/auth')}
                  style={bannerLinkStyle}
                >
                  Sign in instead
                </button>
              </p>
            </div>
          </div>
        )}

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
              {passwordValid ? '✓ Password is valid' : 'Min 6 characters, 1 uppercase'}
            </div>
          )}
        </div>

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
              {confirmValid ? '✓ Passwords match' : 'Passwords do not match'}
            </div>
          )}
        </div>

        {error && !emailTakenError && (
          <div style={{ ...errorStyle, marginBottom: '16px', padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '8px' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          style={{ ...primaryButtonStyle, opacity: canSubmit ? 1 : 0.5 }}
          disabled={isLoading || !canSubmit}
        >
          {isLoading ? 'Creating organization account…' : 'Create organization account'}
        </button>

        <button type="button" onClick={() => navigate('/auth')} style={textButtonStyle}>
          Back to student sign-up
        </button>
      </form>
    </ScreenShell>
  )
}

function Header() {
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.15em', color: '#5B4AE6' }}>
          NESTED · FOR ORGS
        </span>
      </div>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 700, color: '#111827' }}>
          Bring your events to Nested
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#6B7280', lineHeight: 1.5 }}>
          Universities and student orgs — post events under your own brand.
        </p>
      </div>
    </>
  )
}

function ScreenShell({ children }) {
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
      overflow: 'auto'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
        padding: '32px 28px',
        position: 'relative',
        zIndex: 10
      }}>
        {children}
      </div>
    </div>
  )
}

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
  boxSizing: 'border-box'
})

const errorStyle = {
  fontSize: '12px',
  color: '#EF4444',
  marginTop: '6px'
}

const successStyle = {
  fontSize: '12px',
  color: '#10B981',
  marginTop: '6px'
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
  cursor: 'pointer'
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

const bannerStyle = {
  marginBottom: '16px',
  padding: '14px 16px',
  backgroundColor: '#FEF3C7',
  border: '1px solid #F59E0B',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px'
}

const bannerLinkStyle = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: '#B45309',
  fontWeight: 600,
  textDecoration: 'underline',
  cursor: 'pointer',
  fontSize: '13px'
}

export default OrgSignupScreen
