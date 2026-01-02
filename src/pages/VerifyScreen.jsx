import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authService, getErrorMessage } from '../lib/supabase'

/**
 * VerifyScreen - Check Your Email Screen
 * 
 * Shows after:
 * 1. Sign up with email/password (email confirmation required)
 * 2. Magic link sign-in request
 * 
 * User needs to check their email and click the link to continue.
 */

function VerifyScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Get email and context from navigation state
  const email = location.state?.email || ''
  const isSignUp = location.state?.isSignUp || false
  
  useEffect(() => {
    if (resendCooldown > 0) {
      const interval = setInterval(() => setResendCooldown(t => t - 1), 1000)
      return () => clearInterval(interval)
    }
  }, [resendCooldown])

  const handleResend = async () => {
    if (!email || isResending || resendCooldown > 0) return
    
    setIsResending(true)
    setError('')
    setSuccess('')
    
    try {
      const { error: resendError } = await authService.sendMagicLink(email)
      
      if (resendError) {
        setError(getErrorMessage(resendError))
      } else {
        setSuccess('Link sent!')
        setResendCooldown(60)
      }
    } catch (err) {
      setError('Failed to resend')
    } finally {
      setIsResending(false)
    }
  }

  // Different messaging based on context
  const title = isSignUp ? 'Verify your email' : 'Check your email'
  const subtitle = isSignUp 
    ? 'We sent a confirmation link to'
    : 'We sent a sign-in link to'
  const description = isSignUp
    ? 'Click the link to verify your email and complete your account setup.'
    : 'Click the link to sign in to your account.'

  return (
    <div className="flex flex-col h-full bg-white" style={{ padding: '40px' }}>
      {/* Back */}
      <button 
        onClick={() => navigate(-1)}
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          border: '1px solid #E5E7EB',
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
      
      {/* Content */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        marginTop: '-60px'
      }}>
        {/* Icon */}
        <div style={{ marginBottom: '24px' }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="#5B4AE6" strokeWidth="1.5"/>
            <path d="M2 7L12 13L22 7" stroke="#5B4AE6" strokeWidth="1.5" strokeLinecap="round"/>
            {/* Checkmark badge for sign-up */}
            {isSignUp && (
              <g transform="translate(16, 0)">
                <circle cx="4" cy="4" r="4" fill="#4CAF50"/>
                <path d="M2 4l1.5 1.5 3-3" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </g>
            )}
          </svg>
        </div>
        
        {/* Title */}
        <h1 style={{ 
          fontSize: '24px',
          fontWeight: 600,
          color: '#5B4AE6',
          margin: 0,
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          {title}
        </h1>
        
        {/* Subtitle */}
        <p style={{ 
          fontSize: '15px',
          color: '#6B7280',
          margin: 0,
          marginBottom: '4px',
          textAlign: 'center'
        }}>
          {subtitle}
        </p>
        
        {/* Email */}
        <p style={{ 
          fontSize: '15px',
          fontWeight: 500,
          color: '#374151',
          margin: 0,
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          {email}
        </p>

        {/* Description */}
        <p style={{ 
          fontSize: '14px',
          color: '#9CA3AF',
          margin: 0,
          textAlign: 'center',
          maxWidth: '280px',
          lineHeight: 1.5
        }}>
          {description}
        </p>
        
        {/* Messages */}
        {error && (
          <p style={{ marginTop: '16px', fontSize: '14px', color: '#DC2626', textAlign: 'center' }}>{error}</p>
        )}
        {success && (
          <p style={{ marginTop: '16px', fontSize: '14px', color: '#16A34A', textAlign: 'center' }}>{success}</p>
        )}
      </div>
      
      {/* Bottom */}
      <div style={{ textAlign: 'center', paddingBottom: '20px' }}>
        <button 
          onClick={handleResend}
          disabled={isResending || resendCooldown > 0}
          style={{
            fontSize: '14px',
            fontWeight: 500,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: (isResending || resendCooldown > 0) ? 'not-allowed' : 'pointer',
            color: (isResending || resendCooldown > 0) ? '#9CA3AF' : '#5B4AE6',
            padding: '8px 16px'
          }}
        >
          {isResending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't get it? Resend"}
        </button>
        
        <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px' }}>
          Check your spam folder if you don't see it
        </p>

        {/* Option to try different method */}
        <button 
          onClick={() => navigate('/signin')}
          style={{
            marginTop: '20px',
            fontSize: '14px',
            fontWeight: 500,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#6B7280',
            padding: '8px 16px',
            textDecoration: 'underline'
          }}
        >
          Try a different sign-in method
        </button>
      </div>
    </div>
  )
}

export default VerifyScreen
