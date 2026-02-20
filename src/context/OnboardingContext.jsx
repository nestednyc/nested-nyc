import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

/**
 * OnboardingContext
 * 
 * Provides React state management for onboarding completion status.
 * Syncs with both localStorage (fallback) and DB profiles table (source of truth).
 * 
 * Usage:
 *   const { hasOnboarded, setHasOnboarded, profile, resetOnboarding } = useOnboarding()
 */

const STORAGE_KEY = 'nested_onboarding_complete'

const OnboardingContext = createContext(null)

/**
 * OnboardingProvider - Wrap your app with this to enable onboarding state
 */
export function OnboardingProvider({ children }) {
  // Initialize from localStorage as quick fallback
  const [hasOnboarded, setHasOnboardedState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Profile from DB
  const [profile, setProfile] = useState(null)
  
  // In-memory onboarding data during the flow
  const [onboardingData, setOnboardingDataState] = useState({
    firstName: '',
    lastName: '',
    school: '',
    major: '',
    lookingFor: [],
    rolePreference: '',
    skills: []
  })

  // Track if we've finished initializing (including DB check)
  const [isInitialized, setIsInitialized] = useState(false)

  // Track current user for profile lookups
  const [currentUserId, setCurrentUserId] = useState(null)

  // Listen for auth changes and fetch profile
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setIsInitialized(true)
      return
    }

    // Get initial session and profile
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          setCurrentUserId(session.user.id)
          await fetchProfile(session.user.id)
        } else {
          setIsInitialized(true)
        }
      } catch (err) {
        console.error('Failed to initialize auth:', err)
        setIsInitialized(true)
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setCurrentUserId(session.user.id)
        await fetchProfile(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        setCurrentUserId(null)
        setProfile(null)
        // Keep localStorage state for quick re-check
      }
    })

    return () => subscription?.unsubscribe()
  }, [])

  // Fetch profile from DB and sync onboarding state
  // TODO: Re-enable when database is connected
  const fetchProfile = async (userId) => {
    try {
      // const { data: profileData } = await profileService.getProfile(userId)
      // if (profileData) {
      //   setProfile(profileData)
      //   if (profileData.onboarding_completed) {
      //     setHasOnboardedState(true)
      //     try {
      //       localStorage.setItem(STORAGE_KEY, 'true')
      //     } catch (e) {
      //       console.warn('Failed to persist to localStorage:', e)
      //     }
      //   }
      //   setOnboardingDataState({
      //     firstName: profileData.first_name || '',
      //     lastName: profileData.last_name || '',
      //     school: profileData.university || '',
      //     major: profileData.major || '',
      //     lookingFor: profileData.looking_for || [],
      //     rolePreference: profileData.role_preference || '',
      //     skills: profileData.skills || []
      //   })
      // }

      // For now, just mark as initialized (using localStorage only)
      setIsInitialized(true)
    } catch (err) {
      console.error('Failed to fetch profile:', err)
      setIsInitialized(true)
    }
  }

  // Wrapper that writes to state, localStorage, and optionally DB
  const setHasOnboarded = useCallback(async (value) => {
    const boolValue = Boolean(value)
    setHasOnboardedState(boolValue)
    
    // Update localStorage
    try {
      if (boolValue) {
        localStorage.setItem(STORAGE_KEY, 'true')
      } else {
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (e) {
      console.warn('Failed to persist onboarding state:', e)
    }
    
    // TODO: Update DB if we have a user when database is connected
    // if (currentUserId && isSupabaseConfigured()) {
    //   try {
    //     await profileService.updateProfile(currentUserId, {
    //       onboarding_completed: boolValue
    //     })
    //     await fetchProfile(currentUserId)
    //   } catch (err) {
    //     console.error('Failed to update onboarding in DB:', err)
    //   }
    // }
  }, [currentUserId])

  // Update onboarding data (in-memory + optionally sync to DB)
  const setOnboardingData = useCallback(async (data, syncToDb = false) => {
    setOnboardingDataState(prev => ({
      ...prev,
      ...data
    }))
    
    // TODO: Optionally sync to DB when database is connected
    // if (syncToDb && currentUserId && isSupabaseConfigured()) {
    //   try {
    //     const profileUpdates = {}
    //     if (data.firstName !== undefined) profileUpdates.first_name = data.firstName
    //     if (data.lastName !== undefined) profileUpdates.last_name = data.lastName
    //     if (data.school !== undefined) profileUpdates.university = data.school
    //     if (data.major !== undefined) profileUpdates.major = data.major
    //     if (data.lookingFor !== undefined) profileUpdates.looking_for = data.lookingFor
    //     if (data.rolePreference !== undefined) profileUpdates.role_preference = data.rolePreference
    //     if (data.skills !== undefined) profileUpdates.skills = data.skills
    //
    //     if (Object.keys(profileUpdates).length > 0) {
    //       await profileService.upsertProfile(currentUserId, profileUpdates)
    //       await fetchProfile(currentUserId)
    //     }
    //   } catch (err) {
    //     console.error('Failed to sync onboarding data to DB:', err)
    //   }
    // }
  }, [currentUserId])

  // Reset function for testing/debugging
  const resetOnboarding = useCallback(async () => {
    setHasOnboardedState(false)
    setOnboardingDataState({
      firstName: '',
      lastName: '',
      school: '',
      major: '',
      lookingFor: [],
      rolePreference: '',
      skills: []
    })
    
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.warn('Failed to clear localStorage:', e)
    }
    
    // TODO: Reset in DB if we have a user when database is connected
    // if (currentUserId && isSupabaseConfigured()) {
    //   try {
    //     await profileService.updateProfile(currentUserId, {
    //       onboarding_completed: false
    //     })
    //   } catch (err) {
    //     console.error('Failed to reset onboarding in DB:', err)
    //   }
    // }
  }, [currentUserId])

  // Refresh profile from DB
  const refreshProfile = useCallback(async () => {
    if (currentUserId) {
      await fetchProfile(currentUserId)
    }
  }, [currentUserId])

  // Expose reset globally for debugging (in dev)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.resetOnboarding = resetOnboarding
      window.refreshProfile = refreshProfile
    }
  }, [resetOnboarding, refreshProfile])

  const value = {
    // Core state
    hasOnboarded,
    setHasOnboarded,
    isInitialized,
    
    // Profile from DB
    profile,
    refreshProfile,
    
    // In-memory onboarding data
    onboardingData,
    setOnboardingData,
    
    // Debug/testing
    resetOnboarding
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}

/**
 * useOnboarding - Hook to access onboarding state
 * @returns {{
 *   hasOnboarded: boolean,
 *   setHasOnboarded: (value: boolean) => Promise<void>,
 *   isInitialized: boolean,
 *   profile: object|null,
 *   refreshProfile: () => Promise<void>,
 *   onboardingData: object,
 *   setOnboardingData: (data: object, syncToDb?: boolean) => Promise<void>,
 *   resetOnboarding: () => Promise<void>
 * }}
 */
export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider')
  }
  return context
}

export default OnboardingContext
