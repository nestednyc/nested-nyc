import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthGate } from '../utils/useAuthGate'

/**
 * PublicTopBar — shown only to unauthenticated visitors on public pages.
 * Gives them a logo "home" link plus Sign in / Create account CTAs.
 * Returns null when the viewer is signed in so the regular layout chrome
 * (BottomNav / WebLayout header) takes over.
 */
function PublicTopBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuthGate()

  if (isLoading || isAuthenticated) return null

  const nextParam = encodeURIComponent(location.pathname + location.search)

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderBottom: '1px solid #F3F4F6'
    }}>
      <button
        onClick={() => navigate('/events')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer'
        }}
        aria-label="Nested"
      >
        <span style={{
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: '#5B4AE6'
        }}>
          NESTED
        </span>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => navigate(`/auth?next=${nextParam}`)}
          style={{
            padding: '8px 14px',
            backgroundColor: 'transparent',
            color: '#5B4AE6',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Sign in
        </button>
        <button
          onClick={() => navigate(`/auth?next=${nextParam}`)}
          style={{
            padding: '8px 14px',
            backgroundColor: '#5B4AE6',
            color: 'white',
            fontSize: '13px',
            fontWeight: 600,
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Create account
        </button>
      </div>
    </div>
  )
}

export default PublicTopBar
