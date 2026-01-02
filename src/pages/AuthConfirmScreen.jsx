import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authService } from '../lib/supabase'

/**
 * AuthConfirmScreen - Handles magic link callback
 * 
 * When user clicks magic link in email, they're redirected here with:
 * - token_hash: The hashed token for verification
 * - type: The token type (email, magiclink, .. )
 * 
 *  Extracts token from URL , Verifies with Supabase , Redirects to app on success
 */

function AuthConfirmScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState('verifying') // verifying, success, error
  const [error, setError] = useState('')

  useEffect(() => {
    const verifyToken = async () => {
      // Extract token_hash and type from URL
      const tokenHash = searchParams.get('token_hash')
      const type = searchParams.get('type') || 'email'
      const errorParam = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      // Handle error from Supabase redirect
      if (errorParam) {
        setStatus('error')
        setError(errorDescription || 'Authentication failed. Please try again.')
        return
      }

      // Check if we have the required token
      if (!tokenHash) {
        // No token - might be a direct navigation or already processed
        // Check if user is already authenticated
        const { data } = await authService.getSession()
        if (data?.session) {
          setStatus('success')
          setTimeout(() => navigate('/profile', { replace: true }), 1000)
          return
        }
        
        setStatus('error')
        setError('Invalid verification link. Please request a new one.')
        return
      }

      // Verify the token hash
      const { data, error: verifyError } = await authService.verifyTokenHash(tokenHash, type)

      if (verifyError) {
        setStatus('error')
        setError(verifyError.message || 'Verification failed. Please try again.')
        return
      }

      // Success! User is now authenticated
      setStatus('success')
      
      // Check if user needs to complete profile setup
      // For now, redirect to profile setup
      setTimeout(() => {
        navigate('/profile', { replace: true })
      }, 1500)
    }

    verifyToken()
  }, [searchParams, navigate])

  return (
    <div 
      className="flex flex-col h-full bg-white relative items-center justify-center"
      style={{ paddingLeft: '40px', paddingRight: '40px' }}
    >
      {status === 'verifying' && (
        <div className="text-center">
          {/* Loading spinner */}
          <div 
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #E8E6EA',
              borderTopColor: '#E5385A',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 24px'
            }}
          />
          <h1 
            style={{ 
              fontSize: '24px',
              fontWeight: 700,
              color: '#E5385A',
              marginBottom: '8px'
            }}
          >
            Verifying...
          </h1>
          <p style={{ fontSize: '14px', color: '#666' }}>
            Please wait while we confirm your email
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center">
          {/* Success checkmark */}
          <div 
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#4CAF50',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path 
                d="M5 12l5 5L20 7" 
                stroke="white" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 
            style={{ 
              fontSize: '24px',
              fontWeight: 700,
              color: '#4CAF50',
              marginBottom: '8px'
            }}
          >
            Email Verified!
          </h1>
          <p style={{ fontSize: '14px', color: '#666' }}>
            Redirecting you to your profile...
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center">
          {/* Error icon */}
          <div 
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#FFF5F5',
              border: '2px solid #E5385A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path 
                d="M12 8v4M12 16h.01" 
                stroke="#E5385A" 
                strokeWidth="2" 
                strokeLinecap="round"
              />
              <circle cx="12" cy="12" r="10" stroke="#E5385A" strokeWidth="2" fill="none"/>
            </svg>
          </div>
          <h1 
            style={{ 
              fontSize: '24px',
              fontWeight: 700,
              color: '#E5385A',
              marginBottom: '8px'
            }}
          >
            Verification Failed
          </h1>
          <p 
            style={{ 
              fontSize: '14px', 
              color: '#666',
              marginBottom: '24px',
              maxWidth: '280px'
            }}
          >
            {error}
          </p>
          
          {/* Try Again Button */}
          <button
            onClick={() => navigate('/uni-email', { replace: true })}
            style={{
              padding: '12px 32px',
              backgroundColor: '#E5385A',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )}

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

export default AuthConfirmScreen
