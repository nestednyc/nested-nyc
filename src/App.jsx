import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { OnboardingProvider } from './context/OnboardingContext'

// Layout components
import MobileFrame from './components/MobileFrame'
import WebLayout from './components/WebLayout'

// Auth Flow
import AuthGateScreen from './pages/AuthGateScreen'
import AuthConfirmScreen from './pages/AuthConfirmScreen'

// Main App Pages
import DiscoverScreen from './pages/DiscoverScreen'
import EventsScreen from './pages/EventsScreen'
import MatchesScreen from './pages/MatchesScreen'
import MessagesScreen from './pages/MessagesScreen'
import ChatScreen from './pages/ChatScreen'
import FiltersScreen from './pages/FiltersScreen'
import ProfileDetailScreen from './pages/ProfileDetailScreen'
import CreateProjectScreen from './pages/CreateProjectScreen'
import EventDetailScreen from './pages/EventDetailScreen'
// Nest screens - imports kept but routes redirect for MVP
// import NestDetailScreen from './pages/NestDetailScreen'
// import CreateNestScreen from './pages/CreateNestScreen'
import EditProjectScreen from './pages/EditProjectScreen'
import ProfileEditScreen from './pages/ProfileEditScreen'
import ProfileViewScreen from './pages/ProfileViewScreen'
import CreateEventScreen from './pages/CreateEventScreen'
import InviteMembersScreen from './pages/InviteMembersScreen'
import ManageRequestsScreen from './pages/ManageRequestsScreen'

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
 * Route categories for layout decisions
 */
const AUTH_ROUTES = ['/auth', '/auth/confirm', '/login']
const FORM_ROUTES = ['/profile/edit']
const APP_ROUTES = ['/discover', '/events', '/matches', '/messages']

/**
 * AppContent - Main app content with routing
 * No auth state checks - all pages accessible for demo/development
 */
function AppContent() {
  const location = useLocation()
  const isDesktop = useIsDesktop()
  const pathname = location.pathname

  // Determine layout type based on route
  const isAuthRoute = AUTH_ROUTES.includes(pathname)
  const isFormRoute = FORM_ROUTES.includes(pathname)
  const isAppRoute = APP_ROUTES.includes(pathname)
  const isChatRoute = pathname.startsWith('/chat/')
  const useDesktopLayout = isDesktop && (isAppRoute || isAuthRoute || isFormRoute || isChatRoute)

  return (
    <Routes>
      {/* Root - redirect to auth */}
      <Route path="/" element={<Navigate to="/auth" replace />} />
      
      {/* Auth Page - UI only, no redirects */}
      <Route path="/auth" element={
        useDesktopLayout 
          ? <WebLayout layoutType="auth"><AuthGateScreen /></WebLayout>
          : <MobileFrame><AuthGateScreen /></MobileFrame>
      } />
      
      {/* Auth Confirm - handles email verification callback */}
      <Route path="/auth/confirm" element={
        useDesktopLayout
          ? <WebLayout layoutType="auth"><AuthConfirmScreen /></WebLayout>
          : <MobileFrame><AuthConfirmScreen /></MobileFrame>
      } />

      {/* Legacy login route */}
      <Route path="/login" element={<Navigate to="/auth" replace />} />
      
      {/* Profile Edit */}
      <Route path="/profile/edit" element={
        isDesktop 
          ? <WebLayout layoutType="form"><ProfileEditScreen /></WebLayout>
          : <MobileFrame><ProfileEditScreen /></MobileFrame>
      } />
      <Route path="/profile/:userId" element={
        isDesktop
          ? <WebLayout layoutType="app"><ProfileViewScreen /></WebLayout>
          : <MobileFrame><ProfileViewScreen /></MobileFrame>
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
      {/* Filters route - redirects to discover for MVP (feature hidden) */}
      <Route path="/filters" element={<Navigate to="/discover" replace />} />
      {/* /my-profile redirects to the public profile view */}
      <Route path="/my-profile" element={<Navigate to="/profile/current-user" replace />} />
      
      <Route path="/create-project" element={
        isDesktop
          ? <WebLayout layoutType="form"><CreateProjectScreen /></WebLayout>
          : <MobileFrame><CreateProjectScreen /></MobileFrame>
      } />

      <Route path="/create-event" element={
        isDesktop
          ? <WebLayout layoutType="form"><CreateEventScreen /></WebLayout>
          : <MobileFrame><CreateEventScreen /></MobileFrame>
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
      
      {/* Edit Project */}
      <Route path="/projects/:projectId/edit" element={
        isDesktop
          ? <WebLayout layoutType="form"><EditProjectScreen /></WebLayout>
          : <MobileFrame><EditProjectScreen /></MobileFrame>
      } />

      {/* Invite Members */}
      <Route path="/projects/:projectId/invite" element={
        isDesktop
          ? <WebLayout layoutType="app"><InviteMembersScreen /></WebLayout>
          : <MobileFrame><InviteMembersScreen /></MobileFrame>
      } />

      {/* Manage Requests */}
      <Route path="/projects/:projectId/requests" element={
        isDesktop
          ? <WebLayout layoutType="app"><ManageRequestsScreen /></WebLayout>
          : <MobileFrame><ManageRequestsScreen /></MobileFrame>
      } />

      {/* Nest routes - redirect to discover for MVP (feature hidden) */}
      <Route path="/nests/:nestId" element={<Navigate to="/discover" replace />} />
      <Route path="/create-nest" element={<Navigate to="/discover" replace />} />
      
      {/* Legacy routes - redirect to auth */}
      <Route path="/signup" element={<Navigate to="/auth" replace />} />
      <Route path="/onboarding/*" element={<Navigate to="/auth" replace />} />
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  )
}

/**
 * App - Root component
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
