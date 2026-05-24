import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, getErrorMessage } from '../lib/supabase'

/**
 * ForgotPasswordScreen - 3-step OTP password reset (all on same screen)
 *
 * Step 1 (email):    enter .edu email → sendPasswordReset → Supabase emails 6-digit code
 * Step 2 (code):     enter 6-digit code → verifyPasswordResetOtp → recovery session set
 * Step 3 (password): enter new password → updatePassword → navigate to /discover
 *
 * Code-based (not link-based) because email scanners (Gmail/Outlook safety prefetch)
 * consume single-use Supabase links before the user can click them.
 */
function ForgotPasswordScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const codeRefs = useRef([])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  const emailError = useMemo(() => {
    if (!email) return null
    if (!email.toLowerCase().endsWith('.edu')) return 'Please use a .edu email'
    return null
  }, [email])

  const codeString = code.join('')
  const passwordError = password && password.length < 6 ? 'Password must be at least 6 characters' : null
  const confirmError = confirmPassword && password !== confirmPassword ? 'Passwords do not match' : null
  const canSubmitPassword = password && confirmPassword && !passwordError && !confirmError

  const sendCode = async () => {
    setIsLoading(true)
    setError(null)
    const { error: resetError } = await authService.sendPasswordReset(email)
    setIsLoading(false)
    if (resetError) {
      setError(getErrorMessage(resetError))
      return false
    }
    setResendCooldown(30)
    return true
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    setEmailTouched(true)
    if (!email || emailError) return
    const ok = await sendCode()
    if (ok) {
      setStep('code')
      setTimeout(() => codeRefs.current[0]?.focus(), 100)
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0 || isLoading) return
    setCode(['', '', '', '', '', ''])
    setError(null)
    await sendCode()
    setTimeout(() => codeRefs.current[0]?.focus(), 50)
  }

  const handleCodeChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(0, 1)
    const next = [...code]
    next[index] = digit
    setCode(next)
    setError(null)
    if (digit && index < 5) {
      codeRefs.current[index + 1]?.focus()
    }
  }

  const handleCodePaste = (e) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = [...code]
    pasted.split('').forEach((d, i) => { if (i < 6) next[i] = d })
    setCode(next)
    setError(null)
    const nextEmpty = next.findIndex(c => !c)
    codeRefs.current[nextEmpty === -1 ? 5 : nextEmpty]?.focus()
  }

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus()
    }
  }

  const handleCodeSubmit = async (e) => {
    e.preventDefault()
    if (codeString.length !== 6) return
    setIsLoading(true)
    setError(null)
    const { error: verifyError } = await authService.verifyPasswordResetOtp(email, codeString)
    setIsLoading(false)
    if (verifyError) {
      setError(getErrorMessage(verifyError))
      return
    }
    setStep('password')
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmitPassword) return
    setIsLoading(true)
    setError(null)
    const { error: updateError } = await authService.updatePassword(password)
    if (updateError) {
      setIsLoading(false)
      setError(getErrorMessage(updateError))
      return
    }
    navigate('/discover', { replace: true })
  }

  const handleBack = () => {
    if (step === 'email') navigate('/auth')
    else if (step === 'code') { setStep('email'); setError(null) }
    // password step has no back — recovery already consumed
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {step !== 'password' && (
          <button onClick={handleBack} style={backLinkStyle}>
            ← Back{step === 'email' ? ' to sign in' : ''}
          </button>
        )}

        {step === 'email' && (
          <>
            <h1 style={headingStyle}>Forgot password?</h1>
            <p style={subheadingStyle}>
              Enter your .edu email and we'll send you a 6-digit code.
            </p>
            <form onSubmit={handleEmailSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>School email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError(null) }}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="you@university.edu"
                  style={inputStyle(emailTouched && !!emailError)}
                  autoFocus
                />
                {emailTouched && emailError && <div style={errorStyle}>{emailError}</div>}
              </div>
              {error && <div style={errorBoxStyle}>{error}</div>}
              <button type="submit" style={primaryButtonStyle} disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send code'}
              </button>
            </form>
          </>
        )}

        {step === 'code' && (
          <>
            <h1 style={headingStyle}>Enter the code</h1>
            <p style={subheadingStyle}>
              We sent a 6-digit code to <strong style={{ color: '#111827' }}>{email}</strong>.
            </p>
            <form onSubmit={handleCodeSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={el => codeRefs.current[i] = el}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleCodeChange(i, e.target.value)}
                      onKeyDown={e => handleCodeKeyDown(i, e)}
                      onPaste={i === 0 ? handleCodePaste : undefined}
                      style={otpInputStyle(!!error)}
                    />
                  ))}
                </div>
              </div>
              {error && <div style={errorBoxStyle}>{error}</div>}
              <button
                type="submit"
                style={{ ...primaryButtonStyle, opacity: codeString.length === 6 ? 1 : 0.5, cursor: codeString.length === 6 && !isLoading ? 'pointer' : 'not-allowed' }}
                disabled={isLoading || codeString.length !== 6}
              >
                {isLoading ? 'Verifying...' : 'Verify code'}
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || isLoading}
                style={{ ...textButtonStyle, opacity: resendCooldown > 0 ? 0.5 : 1, cursor: resendCooldown > 0 || isLoading ? 'not-allowed' : 'pointer' }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't get it? Resend code"}
              </button>
            </form>
          </>
        )}

        {step === 'password' && (
          <>
            <h1 style={headingStyle}>Set a new password</h1>
            <p style={subheadingStyle}>
              Choose a password you'll remember. Minimum 6 characters.
            </p>
            <form onSubmit={handlePasswordSubmit}>
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
              {error && <div style={errorBoxStyle}>{error}</div>}
              <button
                type="submit"
                style={{ ...primaryButtonStyle, opacity: canSubmitPassword ? 1 : 0.5, cursor: canSubmitPassword && !isLoading ? 'pointer' : 'not-allowed' }}
                disabled={isLoading || !canSubmitPassword}
              >
                {isLoading ? 'Updating...' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
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

const backLinkStyle = {
  background: 'transparent',
  border: 'none',
  color: '#6B7280',
  fontSize: '14px',
  fontWeight: 500,
  cursor: 'pointer',
  padding: 0,
  marginBottom: '20px'
}

const headingStyle = {
  fontSize: '24px',
  fontWeight: 700,
  color: '#111827',
  margin: '0 0 8px'
}

const subheadingStyle = {
  fontSize: '14px',
  color: '#6B7280',
  margin: '0 0 24px',
  lineHeight: 1.5
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

const otpInputStyle = (hasError) => ({
  flex: '1 1 0',
  minWidth: 0,
  height: '54px',
  fontSize: '22px',
  fontWeight: 600,
  fontFamily: 'ui-monospace, SF Mono, Menlo, monospace',
  textAlign: 'center',
  padding: 0,
  border: `1.5px solid ${hasError ? '#EF4444' : '#E5E7EB'}`,
  borderRadius: '10px',
  outline: 'none',
  backgroundColor: '#FAFAFA',
  color: '#111827',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s'
})

const errorStyle = {
  fontSize: '12px',
  color: '#EF4444',
  marginTop: '6px'
}

const errorBoxStyle = {
  fontSize: '13px',
  color: '#EF4444',
  marginBottom: '16px',
  padding: '12px',
  backgroundColor: '#FEF2F2',
  borderRadius: '8px'
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

export default ForgotPasswordScreen
