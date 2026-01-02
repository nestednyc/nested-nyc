import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, getErrorMessage, isSupabaseConfigured } from '../lib/supabase'
import { getEmailValidationError, isEduEmail } from '../utils/emailValidation'
import { useOnboarding } from '../context/OnboardingContext'

/**
 * SignInScreen - Simple sign in for returning users
 * 
 * - Email + password sign in
 * - "Forgot your password?" sends a one-time login link
 */

function SignInScreen() {
  const navigate = useNavigate()
  const { hasOnboarded } = useOnboarding()
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSendingLink, setIsSendingLink] = useState(false)
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false)
  const [hasBlurred, setHasBlurred] = useState(false)

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    if (error) setError('')
    if (forgotPasswordSent) setForgotPasswordSent(false)
  }

  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    if (error) setError('')
  }

  const handleEmailBlur = () => {
    setHasBlurred(true)
    const validationError = getEmailValidationError(email)
    if (validationError) {
      setError(validationError)
    }
  }

  const handleSignIn = async () => {
    setError('')
    
    // Validate email
    const validationError = getEmailValidationError(email)
    if (validationError) {
      setError(validationError)
      return
    }

    // Check password
    if (!password.trim()) {
      setError('Please enter your password')
      return
    }

    if (!isSupabaseConfigured()) {
      setError('Authentication service is not configured.')
      return
    }

    setIsLoading(true)

    try {
      const { data, error: authError } = await authService.signInWithEmailPassword(email, password)

      if (authError) {
        setError(getErrorMessage(authError))
        setIsLoading(false)
        return
      }

      // Success - App.jsx handles redirect
      setIsLoading(false)
    } catch (err) {
      console.error('Sign in error:', err)
      setError(getErrorMessage(err))
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setError('')
    
    // Validate email
    const validationError = getEmailValidationError(email)
    if (validationError) {
      setError(validationError)
      return
    }

    if (!isSupabaseConfigured()) {
      setError('Authentication service is not configured.')
      return
    }

    setIsSendingLink(true)

    try {
      const { error: authError } = await authService.sendMagicLink(email)

      if (authError) {
        setError(getErrorMessage(authError))
        setIsSendingLink(false)
        return
      }

      // Success - show confirmation
      setForgotPasswordSent(true)
      setIsSendingLink(false)
    } catch (err) {
      console.error('Forgot password error:', err)
      setError(getErrorMessage(err))
      setIsSendingLink(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading && !isSendingLink) {
      handleSignIn()
    }
  }

  const getBorderColor = () => {
    if (error && hasBlurred) return '#5B4AE6'
    if (email && isEduEmail(email)) return '#4CAF50'
    return '#E8E6EA'
  }

  const canSubmit = email && password && !error && !isLoading && !isSendingLink

  return (
    <div 
      className="flex flex-col h-full bg-white relative"
      style={{ paddingLeft: '40px', paddingRight: '40px' }}
    >
      {/* Back Button */}
      <div style={{ paddingTop: '50px' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            border: '1px solid #E8E6EA',
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <svg width="10" height="16" viewBox="0 0 12 20" fill="none">
            <path d="M10 2L2 10L10 18" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Header Section */}
      <div style={{ paddingTop: '30px' }}>
        <h1 
          style={{ 
            fontSize: '34px',
            fontWeight: 700,
            color: '#5B4AE6',
            margin: 0
          }}
        >
          Welcome back
        </h1>
        
        <p 
          style={{ 
            margin: 0,
            marginTop: '10px',
            fontSize: '14px',
            lineHeight: 1.5,
            color: '#ADAFBB'
          }}
        >
          Sign in with your university email
        </p>
      </div>
      
      {/* Email Input */}
      <div style={{ marginTop: '30px' }}>
        <label 
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: '#ADAFBB',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          University Email
        </label>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '58px',
            borderRadius: '15px',
            border: `2px solid ${getBorderColor()}`,
            overflow: 'hidden',
            transition: 'border-color 0.2s ease',
            backgroundColor: error && hasBlurred ? '#FFF5F5' : 'white'
          }}
        >
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingLeft: '16px',
              paddingRight: '12px',
              height: '100%'
            }}
          >
            <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
              <path 
                d="M18 0H2C0.9 0 0 0.9 0 2V14C0 15.1 0.9 16 2 16H18C19.1 16 20 15.1 20 14V2C20 0.9 19.1 0 18 0ZM18 4L10 9L2 4V2L10 7L18 2V4Z" 
                fill="#5B4AE6"
              />
            </svg>
          </div>
          
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            onBlur={handleEmailBlur}
            onKeyPress={handleKeyPress}
            placeholder="you@university.edu"
            disabled={isLoading || isSendingLink}
            style={{
              flex: 1,
              height: '100%',
              paddingRight: '16px',
              fontSize: '14px',
              color: '#231429',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              opacity: isLoading || isSendingLink ? 0.6 : 1
            }}
          />
        </div>
        
        {/* Valid email indicator */}
        {email && isEduEmail(email) && !error && (
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#4CAF50"/>
              <path d="M8 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: '12px', color: '#4CAF50', fontWeight: 500 }}>
              Valid university email
            </span>
          </div>
        )}
      </div>

      {/* Password Input */}
      <div style={{ marginTop: '16px' }}>
        <label 
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: '#ADAFBB',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          Password
        </label>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '58px',
            borderRadius: '15px',
            border: '2px solid #E8E6EA',
            overflow: 'hidden',
            backgroundColor: 'white'
          }}
        >
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingLeft: '16px',
              paddingRight: '12px',
              height: '100%'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="#5B4AE6" strokeWidth="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="#5B4AE6" strokeWidth="2"/>
            </svg>
          </div>
          
          <input
            type="password"
            value={password}
            onChange={handlePasswordChange}
            onKeyPress={handleKeyPress}
            placeholder="Enter your password"
            disabled={isLoading || isSendingLink}
            style={{
              flex: 1,
              height: '100%',
              paddingRight: '16px',
              fontSize: '14px',
              color: '#231429',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              opacity: isLoading || isSendingLink ? 0.6 : 1
            }}
          />
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div 
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: '#FFF5F5',
            borderRadius: '12px',
            border: '1px solid #FFE5E5',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}
        >
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="none" 
            style={{ flexShrink: 0, marginTop: '2px' }}
          >
            <circle cx="12" cy="12" r="10" stroke="#5B4AE6" strokeWidth="2" fill="none"/>
            <path d="M12 8v4M12 16h.01" stroke="#5B4AE6" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          
          <p 
            style={{
              margin: 0,
              fontSize: '13px',
              lineHeight: 1.5,
              color: '#5B4AE6',
              flex: 1
            }}
          >
            {error}
          </p>
        </div>
      )}

      {/* Forgot Password Success Message */}
      {forgotPasswordSent && (
        <div 
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: '#F0FDF4',
            borderRadius: '12px',
            border: '1px solid #BBF7D0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              style={{ flexShrink: 0, marginTop: '2px' }}
            >
              <circle cx="12" cy="12" r="10" fill="#22C55E"/>
              <path d="M8 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            
            <p 
              style={{
                margin: 0,
                fontSize: '13px',
                lineHeight: 1.5,
                color: '#16A34A',
                flex: 1
              }}
            >
              One-time login link sent. Check your email and click the link to sign in.
            </p>
          </div>
          <p 
            style={{
              margin: 0,
              marginTop: '8px',
              fontSize: '11px',
              color: '#9CA3AF',
              paddingLeft: '30px'
            }}
          >
            Password reset will be available soon.
          </p>
        </div>
      )}
      
      {/* Sign In Button */}
      <button 
        onClick={handleSignIn}
        disabled={!canSubmit}
        style={{
          marginTop: '24px',
          width: '100%',
          height: '56px',
          backgroundColor: canSubmit ? '#5B4AE6' : '#E8E6EA',
          color: canSubmit ? 'white' : '#ADAFBB',
          fontSize: '16px',
          fontWeight: 700,
          borderRadius: '15px',
          border: 'none',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        {isLoading ? (
          <>
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none"
              style={{ animation: 'spin 1s linear infinite' }}
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeDashoffset="32">
                <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite"/>
              </circle>
            </svg>
            Signing in...
          </>
        ) : (
          'Sign in'
        )}
      </button>

      {/* Forgot Password */}
      <button
        onClick={handleForgotPassword}
        disabled={!email || isSendingLink || isLoading}
        style={{
          marginTop: '16px',
          width: '100%',
          padding: '12px',
          backgroundColor: 'transparent',
          color: isSendingLink ? '#ADAFBB' : '#6B7280',
          fontSize: '14px',
          fontWeight: 500,
          border: 'none',
          cursor: !email || isSendingLink ? 'default' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          opacity: !email ? 0.5 : 1
        }}
      >
        {isSendingLink ? (
          <>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none"
              style={{ animation: 'spin 1s linear infinite' }}
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="32">
                <animate attributeName="stroke-dasharray" dur="2s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                <animate attributeName="stroke-dashoffset" dur="2s" values="0;-16;-32;-32" repeatCount="indefinite"/>
              </circle>
            </svg>
            Sending link...
          </>
        ) : (
          'Forgot your password?'
        )}
      </button>
      
      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Create account link */}
      <div 
        style={{ 
          paddingBottom: '40px',
          textAlign: 'center'
        }}
      >
        <span style={{ fontSize: '14px', color: '#ADAFBB' }}>
          Don't have an account?{' '}
        </span>
        <button 
          onClick={() => navigate('/signup')}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            fontSize: '14px',
            fontWeight: 600,
            color: '#5B4AE6',
            cursor: 'pointer',
            padding: 0
          }}
        >
          Create one
        </button>
      </div>
      
      {/* Home Indicator */}
      <div 
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: '8px' }}
      >
        <div 
          style={{
            width: '134px',
            height: '5px',
            backgroundColor: '#000000',
            borderRadius: '100px'
          }}
        />
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default SignInScreen
