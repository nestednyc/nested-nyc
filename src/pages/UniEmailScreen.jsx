import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService, getErrorMessage } from '../lib/supabase'
import { getEmailValidationError, isEduEmail } from '../utils/emailValidation'

/**
 * UniEmailScreen - University Email Input Screen
 * 
 * Precise measurements (matching PhoneScreen):
 * - Screen padding: 40px horizontal
 * - Top padding: 130px
 * - Title: "My university email", 34px bold, #E5385A, left-aligned
 * - Title-desc gap: 10px
 * - Description: 14px, #E5385A, line-height 1.5
 * - Input margin-top: 40px
 * - Input height: 58px, border-radius 15px, border #E8E6EA
 * - Button margin-top: 48px
 * - Button: 56px height, 15px radius, #E5385A bg
 * - Home indicator: 134x5px black, 8px from bottom
 */

function UniEmailScreen() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasBlurred, setHasBlurred] = useState(false)

  const handleEmailChange = (e) => {
    const newEmail = e.target.value
    setEmail(newEmail)
    
    // Clear error when user starts typing
    if (error) {
      setError('')
    }
  }

  const handleBlur = () => {
    setHasBlurred(true)
    // Validate on blur
    const validationError = getEmailValidationError(email)
    if (validationError) {
      setError(validationError)
    }
  }

  const handleContinue = async () => {
    // Clear previous errors
    setError('')
    
    // Validate email FIRST
    const validationError = getEmailValidationError(email)
    if (validationError) {
      setError(validationError)
      return
    }

    setIsLoading(true)

    try {
      // Send magic link (uses mock auth if Supabase not configured)
      const { data, error: authError } = await authService.sendMagicLink(email)

      if (authError) {
        console.error('Auth error:', authError)
        setError(getErrorMessage(authError))
        setIsLoading(false)
        return
      }

      // Success - navigate to verify screen with email
      navigate('/verify', { state: { email } })
    } catch (err) {
      console.error('Unexpected error during signup:', err)
      setError(getErrorMessage({
        message: err.message || 'An unexpected error occurred. Please try again.',
        code: 'UNEXPECTED_ERROR'
      }))
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isLoading) {
      handleContinue()
    }
  }

  // Determine input border color based on validation state
  const getBorderColor = () => {
    if (error && hasBlurred) {
      return '#E5385A' // Red border for error
    }
    if (email && isEduEmail(email)) {
      return '#4CAF50' // Green border for valid .edu email
    }
    return '#E8E6EA' // Default border
  }

  return (
    <div 
      className="flex flex-col h-full bg-white relative"
      style={{ paddingLeft: '40px', paddingRight: '40px' }}
    >
      {/* Header Section */}
      <div style={{ paddingTop: '130px' }}>
        {/* Title */}
        <h1 
          style={{ 
            fontSize: '34px',
            fontWeight: 700,
            color: '#E5385A',
            margin: 0,
            letterSpacing: 'normal',
            wordSpacing: 'normal'
          }}
        >
          My university email
        </h1>
        
        {/* Description */}
        <p 
          style={{ 
            margin: 0,
            marginTop: '10px',
            fontSize: '14px',
            lineHeight: 1.5,
            color: '#E5385A'
          }}
        >
          Enter your .edu email address to verify
          <br />
          you're a real student. We'll send a code.
        </p>
      </div>
      
      {/* Email Input */}
      <div style={{ marginTop: '40px' }}>
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
          {/* Email Icon */}
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
                fill={error && hasBlurred ? '#E5385A' : '#E5385A'}
              />
            </svg>
          </div>
          
          {/* Email Input Field */}
          <input
            type="email"
            value={email}
            onChange={handleEmailChange}
            onBlur={handleBlur}
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
        
        {/* Error Message */}
        {error && (
          <div 
            style={{
              marginTop: '12px',
              padding: '12px 16px',
              backgroundColor: '#FFF5F5',
              borderRadius: '12px',
              border: '1px solid #FFE5E5',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px'
            }}
          >
            {/* Error Icon */}
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              style={{ flexShrink: 0, marginTop: '2px' }}
            >
              <circle cx="12" cy="12" r="10" stroke="#E5385A" strokeWidth="2" fill="none"/>
              <path d="M12 8v4M12 16h.01" stroke="#E5385A" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            
            {/* Error Text */}
            <p 
              style={{
                margin: 0,
                fontSize: '13px',
                lineHeight: 1.5,
                color: '#E5385A',
                flex: 1
              }}
            >
              {error}
            </p>
          </div>
        )}
        
        {/* Success Indicator (when valid .edu email is entered) */}
        {email && isEduEmail(email) && !error && (
          <div 
            style={{
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
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
      
      {/* Continue Button */}
      <button 
        onClick={handleContinue}
        disabled={isLoading || !email || !!error}
        style={{
          marginTop: '48px',
          width: '100%',
          height: '56px',
          backgroundColor: (isLoading || !email || !!error) ? '#E8E6EA' : '#E5385A',
          color: (isLoading || !email || !!error) ? '#ADAFBB' : 'white',
          fontSize: '16px',
          fontWeight: 700,
          borderRadius: '15px',
          border: 'none',
          cursor: (isLoading || !email || !!error) ? 'not-allowed' : 'pointer',
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
            Sending verification code...
          </>
        ) : (
          'Continue'
        )}
      </button>
      
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      
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
    </div>
  )
}

export default UniEmailScreen

