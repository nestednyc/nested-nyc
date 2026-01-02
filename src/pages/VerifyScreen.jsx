import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authService, getErrorMessage } from '../lib/supabase'

/**
 * VerifyScreen - Check Your Email Screen
 * Minimal magic link flow
 */

function VerifyScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const email = location.state?.email || ''
  
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
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="#E63950" strokeWidth="1.5"/>
            <path d="M2 7L12 13L22 7" stroke="#E63950" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        
        {/* Title */}
        <h1 style={{ 
          fontSize: '24px',
          fontWeight: 600,
          color: '#E63950',
          margin: 0,
          marginBottom: '8px'
        }}>
          Check your email
        </h1>
        
        {/* Email */}
        <p style={{ 
          fontSize: '15px',
          color: '#6B7280',
          margin: 0,
          marginBottom: '4px'
        }}>
          We sent a link to
        </p>
        <p style={{ 
          fontSize: '15px',
          fontWeight: 500,
          color: '#374151',
          margin: 0
        }}>
          {email}
        </p>
        
        {/* Messages */}
        {error && (
          <p style={{ marginTop: '16px', fontSize: '14px', color: '#DC2626' }}>{error}</p>
        )}
        {success && (
          <p style={{ marginTop: '16px', fontSize: '14px', color: '#16A34A' }}>{success}</p>
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
            color: (isResending || resendCooldown > 0) ? '#9CA3AF' : '#E63950',
            padding: '8px 16px'
          }}
        >
          {isResending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't get it? Resend"}
        </button>
        
        <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px' }}>
          Check spam if you don't see it
        </p>
      </div>
    </div>
  )
}

export default VerifyScreen
