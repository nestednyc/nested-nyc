import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authService } from '../lib/supabase'
import { useOnboarding } from '../context/OnboardingContext'

/**
 * AuthConfirmScreen - Handles magic link / email confirmation callback
 * 
 * Supabase puts tokens in URL hash (#) not query params (?)
 * Example: /auth/confirm#token_hash=xxx&type=email
 * 
 * After successful verification, redirects based on onboarding status:
 * - If not onboarded → /profile (start onboarding)
 * - If onboarded → /discover (main app)
 */

function AuthConfirmScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { hasOnboarded } = useOnboarding()
  const [status, setStatus] = useState('verifying')
  const [error, setError] = useState('')

  /**
   * Determine where to redirect after successful auth
   */
  const getPostAuthRedirect = () => {
    return hasOnboarded ? '/discover' : '/profile'
  }

  useEffect(() => {
    const verifyToken = async () => {
      // Parse hash fragment (Supabase uses #, not ?)
      const hashParams = new URLSearchParams(location.hash.substring(1))
      const queryParams = new URLSearchParams(location.search)
      
      // Check both hash and query params
      const tokenHash = hashParams.get('token_hash') || queryParams.get('token_hash')
      const type = hashParams.get('type') || queryParams.get('type') || 'email'
      const errorParam = hashParams.get('error') || queryParams.get('error')
      const errorDescription = hashParams.get('error_description') || queryParams.get('error_description')
      const accessToken = hashParams.get('access_token') || queryParams.get('access_token')

      // Handle error from Supabase
      if (errorParam) {
        setStatus('error')
        setError(decodeURIComponent(errorDescription || 'Authentication failed. Please try again.'))
        return
      }

      // If we have an access_token, Supabase has already set the session via detectSessionInUrl
      if (accessToken) {
        // Wait for Supabase to process
        await new Promise(r => setTimeout(r, 500))
        
        const { data } = await authService.getSession()
        if (data?.session) {
          setStatus('success')
          setTimeout(() => navigate(getPostAuthRedirect(), { replace: true }), 1000)
          return
        }
      }

      // If no token, check if already authenticated (session might be set by Supabase auto-detection)
      if (!tokenHash) {
        // Wait a moment for Supabase to process the URL
        await new Promise(r => setTimeout(r, 500))
        
        const { data } = await authService.getSession()
        if (data?.session) {
          setStatus('success')
          setTimeout(() => navigate(getPostAuthRedirect(), { replace: true }), 1000)
          return
        }
        
        setStatus('error')
        setError('Invalid verification link. Please request a new one.')
        return
      }

      // Verify the token
      const { data, error: verifyError } = await authService.verifyTokenHash(tokenHash, type)

      if (verifyError) {
        setStatus('error')
        setError(verifyError.message || 'Verification failed. The link may have expired.')
        return
      }

      // Success
      setStatus('success')
      setTimeout(() => navigate(getPostAuthRedirect(), { replace: true }), 1500)
    }

    verifyToken()
  }, [location, navigate, hasOnboarded])

  return (
    <div className="flex flex-col h-full bg-white items-center justify-center" style={{ padding: '40px' }}>
      {status === 'verifying' && (
        <div className="text-center">
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #E8E6EA',
            borderTopColor: '#5B4AE6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 20px'
          }}/>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#5B4AE6', marginBottom: '4px' }}>
            Verifying...
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>Please wait</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center">
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#22C55E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l5 5L20 7" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#22C55E', marginBottom: '4px' }}>
            Verified!
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280' }}>
            {hasOnboarded ? 'Taking you to Discover...' : 'Setting up your profile...'}
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="text-center">
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#FEF2F2',
            border: '2px solid #5B4AE6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px'
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v4M12 16h.01" stroke="#5B4AE6" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#5B4AE6', marginBottom: '4px' }}>
            Verification Failed
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '20px', maxWidth: '280px' }}>
            {error}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button
              onClick={() => navigate('/uni-email', { replace: true })}
              style={{
                padding: '12px 24px',
                backgroundColor: '#5B4AE6',
                color: 'white',
                fontSize: '15px',
                fontWeight: 600,
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Sign Up Again
            </button>
            <button
              onClick={() => navigate('/signin', { replace: true })}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                color: '#6B7280',
                fontSize: '15px',
                fontWeight: 500,
                borderRadius: '10px',
                border: '1px solid #E5E7EB',
                cursor: 'pointer'
              }}
            >
              Try Signing In
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default AuthConfirmScreen
