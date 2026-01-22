import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '../lib/supabase'
import { validateUsername } from '../utils/usernameValidation'

/**
 * UsernameScreen - Final step before notifications
 * User picks their unique Instagram-style username
 * 
 * Features:
 * - Real-time format validation
 * - Debounced availability check
 * - Clear visual feedback (available/taken/invalid)
 */

// Debounce helper
function debounce(fn, delay) {
  let timeoutId
  return (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
}

function UsernameScreen() {
  const navigate = useNavigate()
  
  const [username, setUsername] = useState('')
  const [formatError, setFormatError] = useState(null)
  const [isAvailable, setIsAvailable] = useState(null) // null = unchecked, true/false
  const [isChecking, setIsChecking] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [user, setUser] = useState(null)

  // Get current user on mount
  useEffect(() => {
    let mounted = true
    const fetchUser = async () => {
      const { data } = await authService.getSession()
      if (mounted && data?.session?.user) {
        setUser(data.session.user)
      }
    }
    fetchUser()
    return () => { mounted = false }
  }, [])

  // Debounced availability check
  // TODO: Re-enable when database is connected
  // const checkAvailability = useMemo(
  //   () => debounce(async (usernameToCheck) => {
  //     // Don't check if format is invalid
  //     if (validateUsername(usernameToCheck)) {
  //       setIsAvailable(null)
  //       setIsChecking(false)
  //       return
  //     }

  //     try {
  //       setIsChecking(true)
  //       const available = await profileService.isUsernameAvailable(usernameToCheck)
  //       setIsAvailable(available)
  //     } catch (err) {
  //       console.error('Username check failed:', err)
  //       setIsAvailable(null)
  //     } finally {
  //       setIsChecking(false)
  //     }
  //   }, 400),
  //   []
  // )

  // Temporary: Assume username is available for frontend testing
  const checkAvailability = useMemo(
    () => debounce((usernameToCheck) => {
      if (validateUsername(usernameToCheck)) {
        setIsAvailable(null)
        setIsChecking(false)
        return
      }
      setIsChecking(true)
      setTimeout(() => {
        setIsAvailable(true) // Assume available for now
        setIsChecking(false)
      }, 400)
    }, 400),
    []
  )

  // Handle username input change
  const handleUsernameChange = useCallback((e) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, '')
    setUsername(value)
    setSubmitError('')
    
    // Validate format immediately
    const error = validateUsername(value)
    setFormatError(error)
    
    // If format is valid, check availability (debounced)
    if (!error && value.length >= 3) {
      setIsAvailable(null) // Reset while checking
      setIsChecking(true)  // Show spinner immediately
      checkAvailability(value)
    } else {
      setIsAvailable(null)
      setIsChecking(false)
    }
  }, [checkAvailability])

  // Handle form submission
  const handleSubmit = async () => {
    if (!user) {
      setSubmitError('Please sign in first')
      return
    }

    // Final validation
    const error = validateUsername(username)
    if (error) {
      setFormatError(error)
      return
    }

    if (!isAvailable) {
      setSubmitError('Please choose an available username')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      // TODO: Connect to database when ready
      // Save username to database when backend is connected
      // const { error: updateError } = await profileService.upsertProfile(user.id, {
      //   username: username.trim()
      // })
      // if (updateError) { ... handle error ... }

      // For now, just navigate to notifications
      navigate('/notifications')
    } catch (err) {
      console.error('Username submit error:', err)
      setSubmitError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Determine input state for styling
  const getInputState = () => {
    if (!username || username.length < 3) return 'neutral'
    if (formatError) return 'error'
    if (isChecking) return 'checking'
    if (isAvailable === true) return 'available'
    if (isAvailable === false) return 'taken'
    return 'neutral'
  }

  const inputState = getInputState()
  
  const getBorderColor = () => {
    switch (inputState) {
      case 'available': return '#22C55E'
      case 'taken': return '#EF4444'
      case 'error': return '#EF4444'
      case 'checking': return '#5B4AE6'
      default: return '#E5E7EB'
    }
  }

  const canSubmit = username.length >= 3 && !formatError && isAvailable === true && !isSubmitting

  return (
    <div 
      className="flex flex-col h-full bg-white relative"
      style={{ paddingLeft: '32px', paddingRight: '32px' }}
    >
      {/* Header */}
      <div 
        style={{ 
          paddingTop: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            border: '1px solid #E5E7EB',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <svg width="10" height="16" viewBox="0 0 12 20" fill="none">
            <path 
              d="M10 2L2 10L10 18" 
              stroke="#5B4AE6" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
        
        {/* Progress Dots */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {[1, 2, 3, 4, 5].map((step) => (
            <div 
              key={step}
              style={{
                width: step === 5 ? '18px' : '6px',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: step === 5 ? '#5B4AE6' : '#5B4AE6',
                opacity: step === 5 ? 1 : 0.3
              }}
            />
          ))}
        </div>
        
        {/* Placeholder for alignment */}
        <div style={{ width: '44px' }} />
      </div>
      
      {/* Title & Description */}
      <h1 
        style={{ 
          margin: 0,
          marginTop: '28px',
          fontSize: '26px',
          fontWeight: 700,
          color: '#231429',
          flexShrink: 0
        }}
      >
        Pick a username
      </h1>
      
      <p
        style={{
          margin: 0,
          marginTop: '8px',
          fontSize: '14px',
          lineHeight: 1.5,
          color: '#6B7280'
        }}
      >
        Choose a unique username for your Nested profile. You can always change it later.
      </p>
      
      {/* Username Input */}
      <div style={{ marginTop: '28px' }}>
        <label 
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            color: '#ADAFBB',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          Username
        </label>
        
        <div style={{ position: 'relative' }}>
          {/* @ prefix */}
          <span
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '15px',
              color: '#ADAFBB',
              fontWeight: 500,
              pointerEvents: 'none'
            }}
          >
            @
          </span>
          
          <input
            type="text"
            value={username}
            onChange={handleUsernameChange}
            placeholder="username"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            disabled={isSubmitting}
            style={{
              width: '100%',
              height: '50px',
              paddingLeft: '32px',
              paddingRight: '44px',
              borderRadius: '12px',
              border: `2px solid ${getBorderColor()}`,
              fontSize: '15px',
              color: '#231429',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s ease',
              backgroundColor: isSubmitting ? '#F9FAFB' : 'white'
            }}
          />
          
          {/* Status Icon */}
          <div
            style={{
              position: 'absolute',
              right: '14px',
              top: '50%',
              transform: 'translateY(-50%)'
            }}
          >
            {isChecking ? (
              <svg width="20" height="20" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
                <circle cx="12" cy="12" r="10" stroke="#5B4AE6" strokeWidth="2" fill="none" strokeDasharray="32" strokeDashoffset="16"/>
              </svg>
            ) : inputState === 'available' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#22C55E"/>
                <path d="M8 12l2.5 2.5L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            ) : inputState === 'taken' || inputState === 'error' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#EF4444"/>
                <path d="M15 9l-6 6M9 9l6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            ) : null}
          </div>
        </div>
        
        {/* Validation Message */}
        {username.length > 0 && (
          <div 
            style={{ 
              marginTop: '8px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {formatError ? (
              <span style={{ color: '#EF4444' }}>{formatError}</span>
            ) : isChecking ? (
              <span style={{ color: '#6B7280' }}>Checking availability...</span>
            ) : isAvailable === true ? (
              <span style={{ color: '#22C55E', fontWeight: 500 }}>@{username} is available!</span>
            ) : isAvailable === false ? (
              <span style={{ color: '#EF4444' }}>@{username} is already taken</span>
            ) : null}
          </div>
        )}
      </div>
      
      {/* Submit Error */}
      {submitError && (
        <div 
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            backgroundColor: '#FEF2F2',
            borderRadius: '12px',
            border: '1px solid #FECACA'
          }}
        >
          <p style={{ margin: 0, fontSize: '13px', color: '#DC2626' }}>
            {submitError}
          </p>
        </div>
      )}
      
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      
      {/* Username Tips */}
      <div 
        style={{
          marginBottom: '16px',
          padding: '12px 16px',
          backgroundColor: '#F9FAFB',
          borderRadius: '12px'
        }}
      >
        <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', lineHeight: 1.5 }}>
          <strong>Tips:</strong> Use letters, numbers, underscores, and periods. 
          3-30 characters. No spaces or special characters.
        </p>
      </div>
      
      {/* Continue Button */}
      <button 
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: '100%',
          height: '52px',
          backgroundColor: canSubmit ? '#5B4AE6' : '#E5E7EB',
          color: canSubmit ? 'white' : '#ADAFBB',
          fontSize: '16px',
          fontWeight: 600,
          borderRadius: '14px',
          border: 'none',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          marginBottom: '20px',
          flexShrink: 0,
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        {isSubmitting ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" style={{ animation: 'spin 1s linear infinite' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="32" strokeDashoffset="16"/>
            </svg>
            Saving...
          </>
        ) : (
          'Continue'
        )}
      </button>
      
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

export default UsernameScreen
