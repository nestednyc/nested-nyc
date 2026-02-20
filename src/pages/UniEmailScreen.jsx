import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, getErrorMessage, isSupabaseConfigured } from '../lib/supabase'
import { getEmailValidationError, isEduEmail } from '../utils/emailValidation'
import { lookupService } from '../services/lookupService'

/**
 * UniEmailScreen - University Email + Password Sign Up
 * 
 * This is the sign-up form where new users create an account with:
 * - .edu email address (validated)
 * - Password (min 6 characters)
 * - Confirm password
 * 
 * On successful sign-up:
 * - If email confirmation is required: show VerifyScreen
 * - If auto-confirmed: proceed to onboarding (/profile)
 */

function UniEmailScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasBlurredEmail, setHasBlurredEmail] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [emailExists, setEmailExists] = useState(false)

  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    if (error) setError('')
    setEmailExists(false)
  }

  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    if (error) setError('')
  }

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value)
    if (error) setError('')
  }

  const handleEmailBlur = async () => {
    setHasBlurredEmail(true)
    const validationError = getEmailValidationError(email)
    if (validationError) {
      setError(validationError)
      return
    }

    // Only check existence if email is valid .edu format
    if (!email || !isEduEmail(email)) {
      return
    }

    setCheckingEmail(true)
    setEmailExists(false)

    try {
      const { exists } = await lookupService.checkEmailExists(email)
      if (exists) {
        setEmailExists(true)
      }
    } catch (err) {
      console.error('Email lookup error:', err)
    } finally {
      setCheckingEmail(false)
    }
  }

  const handleContinue = async () => {
    setError('')
    
    // Validate email
    const validationError = getEmailValidationError(email)
    if (validationError) {
      setError(validationError)
      return
    }

    // Validate password
    if (!password) {
      setError('Please enter a password')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    // Validate confirm password
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Check Supabase configuration
    if (!isSupabaseConfigured()) {
      setError('Authentication service is not configured. Please contact support.')
      return
    }

    setIsLoading(true)

    try {
      const { data, error: authError } = await authService.signUpWithEmailPassword(email, password)

      if (authError) {
        console.error('Auth error:', authError)
        setError(getErrorMessage(authError))
        setIsLoading(false)
        return
      }

      // Check if email confirmation is required
      if (data?.needsEmailConfirmation) {
        // User needs to verify email - go to verify screen
        navigate('/verify', { state: { email, isSignUp: true } })
      } else if (data?.session) {
        // User is signed in (auto-confirmed) - go to onboarding
        navigate('/profile', { replace: true })
      } else {
        // Fallback - go to verify screen
        navigate('/verify', { state: { email, isSignUp: true } })
      }
    } catch (err) {
      console.error('Unexpected error during signup:', err)
      setError(getErrorMessage(err))
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleContinue()
    }
  }

  // Determine input border color based on validation state
  const getEmailBorderColor = () => {
    if (error && hasBlurredEmail && error.toLowerCase().includes('email')) {
      return '#5B4AE6'
    }
    if (email && isEduEmail(email)) {
      return '#4CAF50'
    }
    return '#E8E6EA'
  }

  const canSubmit = email && password && confirmPassword && !isLoading

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
          Create account
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
          Use your .edu email to verify you're a real student
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
            border: `2px solid ${getEmailBorderColor()}`,
            overflow: 'hidden',
            transition: 'border-color 0.2s ease',
            backgroundColor: error && hasBlurredEmail && error.toLowerCase().includes('email') ? '#FFF5F5' : 'white'
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
            disabled={isLoading}
            style={{
              flex: 1,
              height: '100%',
              paddingRight: '16px',
              fontSize: '14px',
              color: '#231429',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              opacity: isLoading ? 0.6 : 1
            }}
          />
        </div>
        
        {/* Valid email indicator */}
        {email && isEduEmail(email) && !error && !emailExists && (
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
        {checkingEmail && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#9CA3AF' }}>
            Checking email...
          </div>
        )}
      </div>

      {/* Email already registered banner */}
      {emailExists && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px 16px',
            backgroundColor: '#FEF3C7',
            border: '1px solid #F59E0B',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}
        >
          <span style={{ fontSize: '18px', flexShrink: 0 }}>&#9888;&#65039;</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#92400E', fontWeight: 500 }}>
              This email is already registered.
            </p>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#A16207' }}>
              Try{' '}
              <button
                type="button"
                onClick={() => navigate('/signin')}
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
                signing in
              </button>
              {' '}instead.
            </p>
          </div>
        </div>
      )}

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
            placeholder="At least 6 characters"
            disabled={isLoading}
            style={{
              flex: 1,
              height: '100%',
              paddingRight: '16px',
              fontSize: '14px',
              color: '#231429',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              opacity: isLoading ? 0.6 : 1
            }}
          />
        </div>
      </div>

      {/* Confirm Password Input */}
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
          Confirm Password
        </label>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '58px',
            borderRadius: '15px',
            border: `2px solid ${confirmPassword && password !== confirmPassword ? '#5B4AE6' : '#E8E6EA'}`,
            overflow: 'hidden',
            backgroundColor: confirmPassword && password !== confirmPassword ? '#FFF5F5' : 'white'
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
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            onKeyPress={handleKeyPress}
            placeholder="Confirm your password"
            disabled={isLoading}
            style={{
              flex: 1,
              height: '100%',
              paddingRight: '16px',
              fontSize: '14px',
              color: '#231429',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              opacity: isLoading ? 0.6 : 1
            }}
          />
        </div>
        
        {/* Password match indicator */}
        {confirmPassword && password === confirmPassword && (
          <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="#4CAF50"/>
              <path d="M8 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: '12px', color: '#4CAF50', fontWeight: 500 }}>
              Passwords match
            </span>
          </div>
        )}
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
      
      {/* Create Account Button */}
      <button 
        onClick={handleContinue}
        disabled={!canSubmit}
        style={{
          marginTop: '32px',
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
            Creating account...
          </>
        ) : (
          'Create account'
        )}
      </button>
      
      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Sign in link */}
      <div 
        style={{ 
          paddingBottom: '40px',
          textAlign: 'center'
        }}
      >
        <span style={{ fontSize: '14px', color: '#ADAFBB' }}>
          Already have an account?{' '}
        </span>
        <button 
          onClick={() => navigate('/signin')}
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
          Sign in
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

export default UniEmailScreen
