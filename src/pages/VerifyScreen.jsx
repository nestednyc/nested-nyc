import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authService, getErrorMessage } from '../lib/supabase'

/**
 * VerifyScreen - Check Your Email Screen
 * 
 * Magic link only flow - user clicks link in email to complete auth.
 * OTP code input is commented out but preserved for future use.
 */

function VerifyScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isResending, setIsResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const email = location.state?.email || ''
  
  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const interval = setInterval(() => setResendCooldown(t => t - 1), 1000)
      return () => clearInterval(interval)
    }
  }, [resendCooldown])

  // Resend magic link
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
        setSuccess('New link sent! Check your inbox.')
        setResendCooldown(60)
      }
    } catch (err) {
      setError('Failed to resend. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  // Mask email for privacy display
  const maskEmail = (email) => {
    if (!email) return ''
    const [local, domain] = email.split('@')
    if (local.length <= 2) return email
    return `${local[0]}${'•'.repeat(Math.min(local.length - 2, 6))}${local.slice(-1)}@${domain}`
  }

  return (
    <div 
      className="flex flex-col h-full bg-white relative overflow-hidden"
      style={{ paddingLeft: '40px', paddingRight: '40px' }}
    >
      {/* Animated background gradient */}
      <div 
        style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at 30% 20%, rgba(91, 74, 230, 0.08) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(91, 74, 230, 0.05) 0%, transparent 40%)',
          animation: 'float 20s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      
      {/* Back Button */}
      <div style={{ paddingTop: '44px', position: 'relative', zIndex: 1 }}>
        <button 
          onClick={() => navigate(-1)}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '15px',
            border: '1px solid #E5E7EB',
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
            <path 
              d="M10 2L2 10L10 18" 
              stroke="#5B4AE6" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      
      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1,
        marginTop: '-40px'
      }}>
        {/* Animated Mail Icon */}
        <div 
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '32px',
            background: 'linear-gradient(135deg, #5B4AE6 0%, #7C6AF6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 20px 60px rgba(91, 74, 230, 0.3)',
            animation: 'pulse 3s ease-in-out infinite',
            marginBottom: '32px'
          }}
        >
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="white" strokeWidth="1.5" fill="none"/>
            <path d="M2 7L12 13L22 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        
        {/* Title */}
        <h1 
          style={{ 
            fontSize: '28px',
            fontWeight: 700,
            color: '#1A1A2E',
            margin: 0,
            marginBottom: '12px',
            textAlign: 'center'
          }}
        >
          Check your email
        </h1>
        
        {/* Subtitle */}
        <p 
          style={{ 
            fontSize: '16px',
            color: '#6B7280',
            textAlign: 'center',
            lineHeight: 1.6,
            margin: 0,
            maxWidth: '280px'
          }}
        >
          We sent a magic link to
        </p>
        
        {/* Email Display */}
        <div 
          style={{
            marginTop: '8px',
            padding: '12px 20px',
            backgroundColor: '#F8F7FF',
            borderRadius: '12px',
            border: '1px solid #E8E5FF'
          }}
        >
          <p 
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              color: '#5B4AE6',
              fontFamily: 'monospace',
              letterSpacing: '0.5px'
            }}
          >
            {maskEmail(email)}
          </p>
        </div>
        
        {/* Instructions */}
        <p 
          style={{ 
            marginTop: '24px',
            fontSize: '14px',
            color: '#9CA3AF',
            textAlign: 'center',
            lineHeight: 1.5
          }}
        >
          Click the link in the email to sign in.
          <br />
          The link expires in 1 hour.
        </p>
        
        {/* Error Message */}
        {error && (
          <div 
            style={{
              marginTop: '20px',
              padding: '12px 16px',
              backgroundColor: '#FEF2F2',
              borderRadius: '12px',
              border: '1px solid #FECACA',
              maxWidth: '300px'
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', color: '#DC2626', textAlign: 'center' }}>
              {error}
            </p>
          </div>
        )}
        
        {/* Success Message */}
        {success && (
          <div 
            style={{
              marginTop: '20px',
              padding: '12px 16px',
              backgroundColor: '#F0FDF4',
              borderRadius: '12px',
              border: '1px solid #BBF7D0',
              maxWidth: '300px'
            }}
          >
            <p style={{ margin: 0, fontSize: '14px', color: '#16A34A', textAlign: 'center' }}>
              {success}
            </p>
          </div>
        )}
      </div>
      
      {/* Bottom Actions */}
      <div style={{ 
        paddingBottom: '40px', 
        position: 'relative', 
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px'
      }}>
        {/* Open Email App Button */}
        <a 
          href="mailto:"
          style={{
            width: '100%',
            maxWidth: '300px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #5B4AE6 0%, #7C6AF6 100%)',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: 'pointer',
            textDecoration: 'none',
            boxShadow: '0 8px 24px rgba(91, 74, 230, 0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="white" strokeWidth="2" fill="none"/>
            <path d="M2 7L12 13L22 7" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>
            Open Email App
          </span>
        </a>
        
        {/* Resend Link */}
        <button 
          onClick={handleResend}
          disabled={isResending || resendCooldown > 0}
          style={{
            fontSize: '15px',
            fontWeight: 600,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: (isResending || resendCooldown > 0) ? 'not-allowed' : 'pointer',
            color: (isResending || resendCooldown > 0) ? '#9CA3AF' : '#5B4AE6',
            padding: '12px 24px',
            borderRadius: '12px',
            transition: 'all 0.2s ease'
          }}
        >
          {isResending ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round"/>
              </svg>
              Sending...
            </span>
          ) : resendCooldown > 0 ? (
            `Resend in ${resendCooldown}s`
          ) : (
            "Didn't get the email? Resend"
          )}
        </button>
        
        {/* Spam note */}
        <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>
          Check your spam folder if you don't see it
        </p>
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
      
      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(5deg); }
          66% { transform: translate(-20px, 20px) rotate(-5deg); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default VerifyScreen

/* =============================================================================
 * OTP CODE INPUT - COMMENTED OUT FOR FUTURE USE
 * 
 * To re-enable OTP code verification, uncomment below and integrate into the UI
 * =============================================================================

// State for OTP
const [code, setCode] = useState(['', '', '', '', '', ''])
const [isVerifying, setIsVerifying] = useState(false)

// Handle number pad press
const handleNumberPress = (num) => {
  if (isVerifying) return
  
  const newCode = [...code]
  const emptyIndex = newCode.findIndex(c => c === '')
  if (emptyIndex !== -1) {
    newCode[emptyIndex] = num.toString()
    setCode(newCode)
    
    // Auto-verify when complete (6 digits)
    if (emptyIndex === 5) {
      verifyCode(newCode.join(''))
    }
  }
}

// Verify OTP code with Supabase
const verifyCode = async (otpCode) => {
  if (!email) {
    setError('Email not found. Please go back and try again.')
    return
  }
  
  setIsVerifying(true)
  setError('')
  
  try {
    const { data, error: verifyError } = await authService.verifyOtp(email, otpCode)
    
    if (verifyError) {
      setError(getErrorMessage(verifyError))
      setCode(['', '', '', '', '', ''])
      setIsVerifying(false)
      return
    }
    
    // Success - navigate to profile
    navigate('/profile')
  } catch (err) {
    setError('An unexpected error occurred. Please try again.')
    setCode(['', '', '', '', '', ''])
    setIsVerifying(false)
  }
}

// Handle backspace
const handleBackspace = () => {
  const newCode = [...code]
  const lastFilledIndex = newCode.map(c => c !== '').lastIndexOf(true)
  if (lastFilledIndex !== -1) {
    newCode[lastFilledIndex] = ''
    setCode(newCode)
  }
}

// Determine box styles
const getBoxStyle = (index, digit) => {
  const isFilled = digit !== ''
  const isActive = !isFilled && code.findIndex(c => c === '') === index
  
  if (isFilled) {
    return { backgroundColor: '#5B4AE6', border: 'none', color: 'white' }
  } else if (isActive) {
    return { backgroundColor: 'transparent', border: '1px solid #5B4AE6', color: '#5B4AE6' }
  } else {
    return { backgroundColor: 'transparent', border: '1px solid #E5E7EB', color: '#ADAFBB' }
  }
}

// OTP Input UI:
<div style={{ marginTop: '40px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
  {code.map((digit, index) => (
    <div key={index} style={{ width: '44px', height: '52px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, ...getBoxStyle(index, digit) }}>
      {digit || '0'}
    </div>
  ))}
</div>

// Number Pad UI:
<div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', rowGap: '20px' }}>
  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
    <button key={num} onClick={() => handleNumberPress(num)} style={{ height: '48px', fontSize: '24px', fontWeight: 500, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#5B4AE6' }}>
      {num}
    </button>
  ))}
  <div />
  <button onClick={() => handleNumberPress(0)} style={{ height: '48px', fontSize: '24px', fontWeight: 500, backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: '#5B4AE6' }}>0</button>
  <button onClick={handleBackspace} style={{ height: '48px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}>⌫</button>
</div>

*/
