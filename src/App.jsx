import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

// Auth
import { authService } from './lib/supabase'

// Context
import { OnboardingProvider, useOnboarding } from './context/OnboardingContext'

// Layout components
import MobileFrame from './components/MobileFrame'
import WebLayout from './components/WebLayout'

// Page components
import SplashScreen from './pages/SplashScreen'
import Onboarding1 from './pages/Onboarding1'
import Onboarding2 from './pages/Onboarding2'
import Onboarding3 from './pages/Onboarding3'
import SignUpScreen from './pages/SignUpScreen'
import SignInScreen from './pages/SignInScreen'
import UniEmailScreen from './pages/UniEmailScreen'
import VerifyScreen from './pages/VerifyScreen'
import ProfileScreen from './pages/ProfileScreen'
import MajorScreen from './pages/MajorScreen'
import GenderScreen from './pages/GenderScreen'
import InterestsScreen from './pages/InterestsScreen'
import SearchFriendsScreen from './pages/SearchFriendsScreen'
import NotificationsScreen from './pages/NotificationsScreen'
import DiscoverScreen from './pages/DiscoverScreen'
import EventsScreen from './pages/EventsScreen'
import MatchesScreen from './pages/MatchesScreen'
import MessagesScreen from './pages/MessagesScreen'
import ChatScreen from './pages/ChatScreen'
import FiltersScreen from './pages/FiltersScreen'
import ProfileDetailScreen from './pages/ProfileDetailScreen'
import CreateProjectScreen from './pages/CreateProjectScreen'
import EventDetailScreen from './pages/EventDetailScreen'
import AuthConfirmScreen from './pages/AuthConfirmScreen'

/**
 * Route Categories
 * 
 * AUTH_PUBLIC_ROUTES: Available to anyone (no auth required)
 * ONBOARDING_ROUTES: Require auth, used during first-time setup
 * APP_ROUTES: Require auth + completed onboarding
 */
const AUTH_PUBLIC_ROUTES = [
  '/', 
  '/onboarding/1', '/onboarding/2', '/onboarding/3',
  '/signup', '/signin', '/uni-email', '/verify', '/auth/confirm'
]

const ONBOARDING_ROUTES = [
  '/profile', '/major', '/gender', '/interests', '/search-friends', '/notifications'
]

const APP_ROUTES = [
  '/discover', '/events', '/matches', '/messages', '/my-profile', '/filters', '/create-project'
]

/**
 * Check if a path matches a route pattern
 */
function matchesRoute(pathname, routes) {
  return routes.some(route => {
    if (route === pathname) return true
    // Handle dynamic routes like /events/:id
    if (route.includes(':')) {
      const pattern = route.replace(/:[^/]+/g, '[^/]+')
      return new RegExp(`^${pattern}$`).test(pathname)
    }
    return false
  })
}

function isAuthPublicRoute(pathname) {
  return matchesRoute(pathname, AUTH_PUBLIC_ROUTES)
}

function isOnboardingRoute(pathname) {
  return matchesRoute(pathname, ONBOARDING_ROUTES)
}

function isAppRoute(pathname) {
  if (matchesRoute(pathname, APP_ROUTES)) return true
  // Handle dynamic routes
  if (pathname.startsWith('/events/')) return true
  if (pathname.startsWith('/chat/')) return true
  if (pathname.startsWith('/projects/')) return true
  return false
}

/**
 * useIsDesktop - Hook to detect desktop screen width
 */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  return isDesktop
}

/**
 * AppContent - Main app content with routing and auth/onboarding guards
 */
function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()
  const pathname = location.pathname
  const { hasOnboarded, isInitialized: onboardingInitialized } = useOnboarding()

  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Check auth session and listen for changes
  useEffect(() => {
    // Get initial session
    authService.getSession()
      .then(({ data }) => {
        setUser(data?.session?.user ?? null)
      })
      .catch((err) => {
        console.error('Failed to get session:', err)
      })
      .finally(() => {
        setAuthLoading(false)
      })

    // Listen for auth state changes
    const { data: { subscription } } = authService.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      
      // On sign out, redirect to signup
      if (event === 'SIGNED_OUT') {
        navigate('/signup', { replace: true })
      }
    })

    return () => subscription?.unsubscribe()
  }, [navigate])

  // Route guard logic
  useEffect(() => {
    // Wait for both auth and onboarding state to initialize
    if (authLoading || !onboardingInitialized) return

    const isPublic = isAuthPublicRoute(pathname)
    const isOnboarding = isOnboardingRoute(pathname)
    const isApp = isAppRoute(pathname)

    // Case 1: No user (not authenticated)
    if (!user) {
      // Allow public routes
      if (isPublic) return

      // Redirect protected routes to signup
      if (isOnboarding || isApp) {
        navigate('/signup', { replace: true })
        return
      }
    }

    // Case 2: User is authenticated but hasn't completed onboarding
    if (user && !hasOnboarded) {
      // Allow onboarding routes
      if (isOnboarding) return

      // Allow auth public routes (they might be completing sign up)
      if (isPublic) {
        // But redirect splash/onboarding marketing to profile setup
        if (pathname === '/' || pathname.startsWith('/onboarding/')) {
          navigate('/profile', { replace: true })
          return
        }
        return
      }

      // Redirect app routes to onboarding start
      if (isApp) {
        navigate('/profile', { replace: true })
        return
      }
    }

    // Case 3: User is authenticated and has completed onboarding
    if (user && hasOnboarded) {
      // Redirect onboarding routes to discover (they're done)
      if (isOnboarding) {
        navigate('/discover', { replace: true })
        return
      }

      // Redirect splash and marketing onboarding to discover
      if (pathname === '/' || pathname.startsWith('/onboarding/')) {
        navigate('/discover', { replace: true })
        return
      }

      // Redirect signup/signin to discover (already logged in)
      if (pathname === '/signup' || pathname === '/signin') {
        navigate('/discover', { replace: true })
        return
      }

      // Allow everything else
    }
  }, [authLoading, onboardingInitialized, user, hasOnboarded, pathname, navigate])

  // Show loading spinner while checking auth/onboarding
  if (authLoading || !onboardingInitialized) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    )
  }

  // Determine layout type for styling
  const isAuthRoute = ['/signup', '/signin', '/uni-email', '/verify', '/auth/confirm', '/onboarding/1', '/onboarding/2', '/onboarding/3'].includes(pathname)
  const isFormRoute = ONBOARDING_ROUTES.includes(pathname)
  const isChatRoute = pathname.startsWith('/chat/')
  const useDesktopLayout = isDesktop && (isAppRoute(pathname) || isAuthRoute || isFormRoute || isChatRoute)

  const getLayoutType = () => {
    if (isAuthRoute) return 'auth'
    if (isFormRoute) return 'form'
    if (isChatRoute) return 'chat'
    return 'app'
  }

  return (
    <Routes>
      {/* Splash - Mobile landing */}
      <Route path="/" element={
        isDesktop 
          ? <Navigate to={hasOnboarded && user ? '/discover' : '/onboarding/1'} replace />
          : <MobileFrame><SplashScreen /></MobileFrame>
      } />
      
      {/* Onboarding Marketing */}
      <Route path="/onboarding/1" element={
        useDesktopLayout 
          ? <WebLayout layoutType="auth"><Onboarding1 /></WebLayout>
          : <MobileFrame><Onboarding1 /></MobileFrame>
      } />
      <Route path="/onboarding/2" element={
        useDesktopLayout 
          ? <WebLayout layoutType="auth"><Onboarding2 /></WebLayout>
          : <MobileFrame><Onboarding2 /></MobileFrame>
      } />
      <Route path="/onboarding/3" element={
        useDesktopLayout 
          ? <WebLayout layoutType="auth"><Onboarding3 /></WebLayout>
          : <MobileFrame><Onboarding3 /></MobileFrame>
      } />
      
      {/* Auth Routes */}
      <Route path="/signup" element={
        useDesktopLayout 
          ? <WebLayout layoutType="auth"><SignUpScreen /></WebLayout>
          : <MobileFrame><SignUpScreen /></MobileFrame>
      } />
      <Route path="/signin" element={
        useDesktopLayout 
          ? <WebLayout layoutType="auth"><SignInScreen /></WebLayout>
          : <MobileFrame><SignInScreen /></MobileFrame>
      } />
      <Route path="/uni-email" element={
        useDesktopLayout 
          ? <WebLayout layoutType="auth"><UniEmailScreen /></WebLayout>
          : <MobileFrame><UniEmailScreen /></MobileFrame>
      } />
      <Route path="/verify" element={
        useDesktopLayout 
          ? <WebLayout layoutType="auth"><VerifyScreen /></WebLayout>
          : <MobileFrame><VerifyScreen /></MobileFrame>
      } />
      <Route path="/auth/confirm" element={
        useDesktopLayout 
          ? <WebLayout layoutType="auth"><AuthConfirmScreen /></WebLayout>
          : <MobileFrame><AuthConfirmScreen /></MobileFrame>
      } />
      
      {/* Profile Setup / Onboarding Flow */}
      <Route path="/profile" element={
        useDesktopLayout 
          ? <WebLayout layoutType="form"><ProfileScreen /></WebLayout>
          : <MobileFrame><ProfileScreen /></MobileFrame>
      } />
      <Route path="/major" element={
        useDesktopLayout 
          ? <WebLayout layoutType="form"><MajorScreen /></WebLayout>
          : <MobileFrame><MajorScreen /></MobileFrame>
      } />
      <Route path="/gender" element={
        useDesktopLayout 
          ? <WebLayout layoutType="form"><GenderScreen /></WebLayout>
          : <MobileFrame><GenderScreen /></MobileFrame>
      } />
      <Route path="/interests" element={
        useDesktopLayout 
          ? <WebLayout layoutType="form"><InterestsScreen /></WebLayout>
          : <MobileFrame><InterestsScreen /></MobileFrame>
      } />
      <Route path="/search-friends" element={
        useDesktopLayout 
          ? <WebLayout layoutType="form"><SearchFriendsScreen /></WebLayout>
          : <MobileFrame><SearchFriendsScreen /></MobileFrame>
      } />
      <Route path="/notifications" element={
        useDesktopLayout 
          ? <WebLayout layoutType="form"><NotificationsScreen /></WebLayout>
          : <MobileFrame><NotificationsScreen /></MobileFrame>
      } />
      
      {/* Main App Routes */}
      <Route path="/discover" element={
        isDesktop 
          ? <WebLayout layoutType="app"><DiscoverScreen /></WebLayout>
          : <MobileFrame><DiscoverScreen /></MobileFrame>
      } />
      <Route path="/events" element={
        isDesktop 
          ? <WebLayout layoutType="app"><EventsScreen /></WebLayout>
          : <MobileFrame><EventsScreen /></MobileFrame>
      } />
      <Route path="/events/:eventId" element={
        isDesktop 
          ? <WebLayout layoutType="app"><EventDetailScreen /></WebLayout>
          : <MobileFrame><EventDetailScreen /></MobileFrame>
      } />
      <Route path="/matches" element={
        isDesktop 
          ? <WebLayout layoutType="app"><MatchesScreen /></WebLayout>
          : <MobileFrame><MatchesScreen /></MobileFrame>
      } />
      <Route path="/messages" element={
        isDesktop 
          ? <WebLayout layoutType="app"><MessagesScreen /></WebLayout>
          : <MobileFrame><MessagesScreen /></MobileFrame>
      } />
      <Route path="/filters" element={
        isDesktop 
          ? <WebLayout layoutType="app"><FiltersScreen /></WebLayout>
          : <MobileFrame><FiltersScreen /></MobileFrame>
      } />
      <Route path="/my-profile" element={
        isDesktop 
          ? <WebLayout layoutType="app"><ProfileScreen /></WebLayout>
          : <MobileFrame><ProfileScreen /></MobileFrame>
      } />
      <Route path="/create-project" element={
        isDesktop 
          ? <WebLayout layoutType="form"><CreateProjectScreen /></WebLayout>
          : <MobileFrame><CreateProjectScreen /></MobileFrame>
      } />
      
      {/* Chat */}
      <Route path="/chat/:id" element={
        isDesktop 
          ? <WebLayout layoutType="chat"><ChatScreen /></WebLayout>
          : <MobileFrame><ChatScreen /></MobileFrame>
      } />
      
      {/* Project Detail */}
      <Route path="/projects/:projectId" element={
        isDesktop 
          ? <WebLayout layoutType="app"><ProfileDetailScreen /></WebLayout>
          : <MobileFrame><ProfileDetailScreen /></MobileFrame>
      } />
      
      {/* Fallback */}
      <Route path="*" element={
        <Navigate to={user && hasOnboarded ? '/discover' : '/'} replace />
      } />
    </Routes>
  )
}

/**
 * App - Root component with providers
 */
function App() {
  return (
    <BrowserRouter>
      <OnboardingProvider>
        <AppContent />
      </OnboardingProvider>
    </BrowserRouter>
  )
}

export default App
