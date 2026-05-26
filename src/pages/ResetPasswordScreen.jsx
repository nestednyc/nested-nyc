import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, getErrorMessage } from '../lib/supabase'
import { resolvePostAuthRoute } from '../utils/authHelpers'

/**
 * ResetPasswordScreen - Set a new password after clicking reset link
 *
 * Flow:
 * 1. User clicks the reset link in email → lands here with #access_token=...&type=recovery
 * 2. Supabase (detectSessionInUrl: true) parses hash and sets a recovery session
 * 3. We wait for PASSWORD_RECOVERY event or existing recovery session
 * 4. User enters new password → updatePassword → /discover
 *
 * Edge cases:
 * - No session + no recovery indicator → "link expired"
 * - Error in URL hash (e.g. expired) → show error state
 */
function ResetPasswordScreen() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [sessionError, setSessionError] = useState(null)

  useEffect(() => {
    let isMounted = true

    const { data: { subscription } = { subscription: null } } =
      authService.onAuthStateChange((event, session) => {
        if (!isMounted) return
        if (event === 'PASSWORD_RECOVERY' && session) {
          setSessionReady(true)
        }
      }) || {}

    const check = async () => {
      // Read hash first — Supabase strips it after detectSessionInUrl processes it
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const isRecoveryUrl = hashParams.get('type') === 'recovery'
      const errorParam = hashParams.get('error')
      const errorDesc = hashParams.get('error_description')

      if (errorParam) {
        if (isMounted) {
          setSessionError(decodeURIComponent(errorDesc || 'This link is invalid or has expired.'))
        }
        return
      }

      // Give detectSessionInUrl a moment to process the hash
      await new Promise(r => setTimeout(r, 600))
      if (!isMounted) return

      const { data } = await authService.getSession()
      if (data?.session) {
        setSessionReady(true)
      } else if (!isRecoveryUrl) {
        setSessionError('This reset link is invalid or has expired. Please request a new one.')
      }
      // else: hash had recovery type but no session yet — auth listener will fire
    }
    check()

    return () => {
      isMounted = false
      subscription?.unsubscribe?.()
    }
  }, [])

  const passwordError = (() => {
    if (!password) return null
    if (password.length < 6) return 'Password must be at least 6 characters'
    return null
  })()

  const confirmError = (() => {
    if (!confirmPassword) return null
    if (password !== confirmPassword) return 'Passwords do not match'
    return null
  })()

  const canSubmit = password && confirmPassword && !passwordError && !confirmError

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setIsLoading(true)
    setError(null)

    const { error: updateError } = await authService.updatePassword(password)

    if (updateError) {
      setIsLoading(false)
      setError(getErrorMessage(updateError))
      return
    }

    const target = await resolvePostAuthRoute()
    navigate(target === '/auth' ? '/discover' : target, { replace: true })
  }

  if (!sessionReady && !sessionError) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #E8E6EA',
            borderTopColor: '#5B4AE6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }}/>
          <p style={{ fontSize: '14px', color: '#6B7280', textAlign: 'center', margin: 0 }}>
            Verifying reset link...
          </p>
        </div>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </div>
    )
  }

  if (sessionError) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '12px' }}>
            Link expired
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px', lineHeight: 1.5 }}>
            {sessionError}
          </p>
          <button onClick={() => navigate('/forgot-password')} style={primaryButtonStyle}>
            Request a new link
          </button>
          <button onClick={() => navigate('/auth')} style={textButtonStyle}>
            Back to sign in
          </button>
        </div>
        <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      </div>
    )
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
          Set a new password
        </h1>
        <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px', lineHeight: 1.5 }}>
          Choose a password you'll remember. Minimum 6 characters.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>New password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null) }}
              placeholder="Enter new password"
              style={inputStyle(!!passwordError)}
              autoFocus
            />
            {passwordError && <div style={errorStyle}>{passwordError}</div>}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => { setConfirmPassword(e.target.value); setError(null) }}
              placeholder="Re-enter password"
              style={inputStyle(!!confirmError)}
            />
            {confirmError && <div style={errorStyle}>{confirmError}</div>}
          </div>

          {error && (
            <div style={{ ...errorStyle, marginBottom: '16px', padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '8px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{ ...primaryButtonStyle, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
            disabled={isLoading || !canSubmit}
          >
            {isLoading ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </div>
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  )
}

const containerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  minHeight: '100%',
  padding: '40px 20px',
  backgroundColor: '#FFFFFF',
  boxSizing: 'border-box'
}

const cardStyle = {
  width: '100%',
  maxWidth: '400px',
  backgroundColor: '#FFFFFF',
  borderRadius: '16px',
  padding: '32px 28px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(91,74,230,0.06)',
  animation: 'fadeUp 0.3s ease-out',
  boxSizing: 'border-box'
}

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px'
}

const inputStyle = (hasError) => ({
  width: '100%',
  height: '46px',
  padding: '0 14px',
  fontSize: '15px',
  fontFamily: 'inherit',
  border: `1.5px solid ${hasError ? '#EF4444' : '#E5E7EB'}`,
  borderRadius: '10px',
  outline: 'none',
  backgroundColor: '#FAFAFA',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s'
})

const errorStyle = {
  fontSize: '12px',
  color: '#EF4444',
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
  transition: 'opacity 0.2s'
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

export default ResetPasswordScreen
