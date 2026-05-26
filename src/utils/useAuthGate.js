import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { authService } from '../lib/supabase'

/**
 * useAuthGate — convenience hook for public pages that need to gate actions
 * behind sign-in.
 *
 * Returns:
 *   isAuthenticated  — current session state (false while loading)
 *   isLoading        — true on first render before we know
 *   requireAuth(fn)  — if signed in, invoke fn; otherwise navigate to /auth
 *                      with ?next=<current path> so the user lands back here
 *                      after authenticating
 */
export function useAuthGate() {
  const navigate = useNavigate()
  const location = useLocation()
  const [authState, setAuthState] = useState(null) // null=loading, bool=known

  useEffect(() => {
    let mounted = true
    authService.getSession().then(({ data }) => {
      if (mounted) setAuthState(!!data?.session)
    })
    const sub = authService.onAuthStateChange((_event, session) => {
      if (mounted) setAuthState(!!session)
    })
    return () => {
      mounted = false
      sub?.data?.subscription?.unsubscribe?.()
    }
  }, [])

  const requireAuth = (action) => {
    if (authState) {
      action?.()
      return
    }
    const next = location.pathname + location.search
    navigate(`/auth?next=${encodeURIComponent(next)}`)
  }

  return {
    isAuthenticated: authState === true,
    isLoading: authState === null,
    requireAuth
  }
}

/**
 * Read the ?next= return path from the current URL. Only allows same-origin
 * paths (must start with "/"), to prevent open-redirect attacks.
 */
export function getNextParam(search) {
  const params = new URLSearchParams(search || (typeof window !== 'undefined' ? window.location.search : ''))
  const next = params.get('next')
  if (next && next.startsWith('/')) return next
  return null
}
