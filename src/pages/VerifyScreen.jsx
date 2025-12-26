import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authService, getErrorMessage } from '../lib/supabase'

/**
 * VerifyScreen - Code Verification Screen
 * EXACT Figma Copy
 * 
 * Precise measurements:
 * - Back button: 52x52px, 15px radius, border #E8E6EA, top 44px, left 40px
 * - Timer: 34px bold, #E5385A, centered, margin-top 32px from back
 * - Instructions: 18px, #E5385A, centered, margin-top 10px
 * - Code boxes: 4x 60x60px, 15px radius, gap 12px, margin-top 40px
 *   - Filled: bg #E5385A, text white
 *   - Active (next): border #E5385A, text pink
 *   - Empty: border #E8E6EA, text gray
 * - Number pad: 3 columns, 24px text, row gap 32px, margin-top 40px
 * - Send again: 16px bold, #E5385A, margin-top 32px
 */

function VerifyScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const [code, setCode] = useState(['', '', '', ''])
  const [timer, setTimer] = useState(42)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState(location.state?.email || '')
  
  // Timer countdown
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000)
      return () => clearInterval(interval)
    }
  }, [timer])
  
  // Handle number pad press
  const handleNumberPress = (num) => {
    if (isVerifying) return
    
    const newCode = [...code]
    const emptyIndex = newCode.findIndex(c => c === '')
    if (emptyIndex !== -1) {
      newCode[emptyIndex] = num.toString()
      setCode(newCode)
      
      // Auto-verify when complete
      if (emptyIndex === 3) {
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
        // Clear code on error
        setCode(['', '', '', ''])
        setIsVerifying(false)
        return
      }
      
      // Success - navigate to profile
      navigate('/profile')
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
      setCode(['', '', '', ''])
      setIsVerifying(false)
      }
  }
  
  // Resend verification code
  const handleResend = async () => {
    if (!email) {
      setError('Email not found. Please go back and try again.')
      return
    }
    
    setError('')
    setCode(['', '', '', ''])
    setTimer(42)
    
    try {
      const { error: resendError } = await authService.sendMagicLink(email)
      
      if (resendError) {
        setError(getErrorMessage(resendError))
      }
    } catch (err) {
      setError('Failed to resend code. Please try again.')
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
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Determine box styles
  const getBoxStyle = (index, digit) => {
    const isFilled = digit !== ''
    const isActive = !isFilled && code.findIndex(c => c === '') === index
    
    if (isFilled) {
      return {
        backgroundColor: '#E5385A',
        border: 'none',
        color: 'white'
      }
    } else if (isActive) {
      return {
        backgroundColor: 'transparent',
        border: '1px solid #E5385A',
        color: '#E5385A'
      }
    } else {
      return {
        backgroundColor: 'transparent',
        border: '1px solid #E8E6EA',
        color: '#ADAFBB'
      }
    }
  }

  return (
    <div 
      className="flex flex-col h-full bg-white relative"
      style={{ paddingLeft: '40px', paddingRight: '40px' }}
    >
      {/* Back Button */}
      <div style={{ paddingTop: '44px' }}>
        <button 
          onClick={() => navigate(-1)}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '15px',
            border: '1px solid #E8E6EA',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
            <path 
              d="M10 2L2 10L10 18" 
              stroke="#E5385A" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      
      {/* Timer */}
      <div style={{ marginTop: '32px', textAlign: 'center' }}>
        <p 
          style={{ 
            fontSize: '34px',
            fontWeight: 700,
            color: '#E5385A',
            margin: 0
          }}
        >
          {formatTime(timer)}
        </p>
      </div>
      
      {/* Instructions */}
      <p 
        style={{ 
          marginTop: '10px',
          fontSize: '18px',
          color: '#E5385A',
          textAlign: 'center',
          lineHeight: 1.4
        }}
      >
        Type the verification code
        <br />
        we've sent you
      </p>
      
      {/* Error Message */}
      {error && (
        <div 
          style={{
            marginTop: '20px',
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
            <circle cx="12" cy="12" r="10" stroke="#E5385A" strokeWidth="2" fill="none"/>
            <path d="M12 8v4M12 16h.01" stroke="#E5385A" strokeWidth="2" strokeLinecap="round"/>
          </svg>
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
      
      {/* Code Input Boxes */}
      <div 
        style={{ 
          marginTop: '40px',
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          opacity: isVerifying ? 0.6 : 1
        }}
      >
        {code.map((digit, index) => {
          const boxStyle = getBoxStyle(index, digit)
          return (
            <div
              key={index}
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 700,
                transition: 'all 0.2s ease',
                ...boxStyle
              }}
            >
              {isVerifying && index === 3 ? (
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
              ) : (
                digit || '0'
              )}
            </div>
          )
        })}
      </div>
      
      {/* Number Pad */}
      <div style={{ marginTop: '40px' }}>
        <div 
          style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            rowGap: '20px'
          }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleNumberPress(num)}
              style={{
                height: '48px',
                fontSize: '24px',
                fontWeight: 500,
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#E5385A'
              }}
            >
              {num}
            </button>
          ))}
          {/* Empty cell */}
          <div />
          {/* Zero */}
          <button
            onClick={() => handleNumberPress(0)}
            style={{
              height: '48px',
              fontSize: '24px',
              fontWeight: 500,
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#E5385A'
            }}
          >
            0
          </button>
          {/* Backspace */}
          <button
            onClick={handleBackspace}
            style={{
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <svg width="24" height="18" viewBox="0 0 24 18" fill="none">
              <rect 
                x="1" 
                y="1" 
                width="22" 
                height="16" 
                rx="3" 
                stroke="#E5385A" 
                strokeWidth="1.5"
              />
              <path 
                d="M15 5L9 13M9 5L15 13" 
                stroke="#E5385A" 
                strokeWidth="1.5" 
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Send Again Link */}
      <button 
        onClick={handleResend}
        disabled={timer > 0 || isVerifying}
        style={{
          marginTop: '32px',
          fontSize: '16px',
          fontWeight: 700,
          backgroundColor: 'transparent',
          border: 'none',
          cursor: (timer > 0 || isVerifying) ? 'not-allowed' : 'pointer',
          color: (timer > 0 || isVerifying) ? '#ADAFBB' : '#E5385A',
          opacity: (timer > 0 || isVerifying) ? 0.5 : 1
        }}
      >
        {timer > 0 ? `Send again (${formatTime(timer)})` : 'Send again'}
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

export default VerifyScreen
