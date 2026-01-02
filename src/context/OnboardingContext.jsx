import { createContext, useContext, useState, useEffect, useCallback } from 'react'

/**
 * OnboardingContext
 * 
 * Provides React state management for onboarding completion status.
 * Persists to localStorage so the flag survives page reloads.
 * 
 * Usage:
 *   const { hasOnboarded, setHasOnboarded, resetOnboarding } = useOnboarding()
 */

const STORAGE_KEY = 'nested_onboarding_complete'

const OnboardingContext = createContext(null)

/**
 * OnboardingProvider - Wrap your app with this to enable onboarding state
 */
export function OnboardingProvider({ children }) {
  // Initialize from localStorage
  const [hasOnboarded, setHasOnboardedState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Track if we've finished initializing (for loading states)
  const [isInitialized, setIsInitialized] = useState(false)

  // On mount, confirm we've read from localStorage
  useEffect(() => {
    setIsInitialized(true)
  }, [])

  // Wrapper that writes to both state and localStorage
  const setHasOnboarded = useCallback((value) => {
    const boolValue = Boolean(value)
    setHasOnboardedState(boolValue)
    try {
      if (boolValue) {
        localStorage.setItem(STORAGE_KEY, 'true')
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (e) {
      console.warn('Failed to persist onboarding state:', e)
    }
  }, [])

  // Reset function for testing/debugging
  const resetOnboarding = useCallback(() => {
    setHasOnboarded(false)
  }, [setHasOnboarded])

  // Expose reset globally for debugging (in dev)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.resetOnboarding = resetOnboarding
    }
  }, [resetOnboarding])

  const value = {
    hasOnboarded,
    setHasOnboarded,
    resetOnboarding,
    isInitialized
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

/**
 * useOnboarding - Hook to access onboarding state
 * @returns {{ hasOnboarded: boolean, setHasOnboarded: (value: boolean) => void, resetOnboarding: () => void, isInitialized: boolean }}
 */
export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}

export default OnboardingContext
