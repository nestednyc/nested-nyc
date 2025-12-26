import { Routes, Route, useLocation } from 'react-router-dom'
import MobileFrame from './components/MobileFrame'
import WebLayout from './components/WebLayout'
import ChatDesktopLayout from './components/ChatDesktopLayout'

// Pages - Exact Figma copies
import SplashScreen from './pages/SplashScreen'
import Onboarding1 from './pages/Onboarding1'
import Onboarding2 from './pages/Onboarding2'
import Onboarding3 from './pages/Onboarding3'
import SignUpScreen from './pages/SignUpScreen'
import PhoneScreen from './pages/PhoneScreen'
import UniEmailScreen from './pages/UniEmailScreen'
import VerifyScreen from './pages/VerifyScreen'
import ProfileScreen from './pages/ProfileScreen'
import GenderScreen from './pages/GenderScreen'
import MajorScreen from './pages/MajorScreen'
import InterestsScreen from './pages/InterestsScreen'

// New screens
import SearchFriendsScreen from './pages/SearchFriendsScreen'
import NotificationsScreen from './pages/NotificationsScreen'
import DiscoverScreen from './pages/DiscoverScreen'
import FiltersScreen from './pages/FiltersScreen'
import ProfileDetailScreen from './pages/ProfileDetailScreen'
import MatchesScreen from './pages/MatchesScreen'
import MessagesScreen from './pages/MessagesScreen'
import ChatScreen from './pages/ChatScreen'
import EventsScreen from './pages/EventsScreen'

/**
 * App - Main Application Component
 * 
 * RESPONSIVE LAYOUT STRATEGY:
 * 
 * Desktop (≥1024px):
 * - All routes use WebLayout with top navigation
 * - Auth pages: Two-column (marketing + card)
 * - Form pages: Centered card with progress stepper
 * - App pages: Full content with optional sidebar
 * - Chat: Three-column layout
 * 
 * Tablet (768-1023px):
 * - Stacked layouts, still web-style
 * - No phone frame
 * 
 * Mobile (<768px):
 * - Falls back to MobileFrame (phone UI)
 * - Single column, touch-friendly
 * 
 * Route Categories:
 * - 'app': Main app pages (discover, matches, messages, etc.)
 * - 'auth': Auth/onboarding (signup, uni-email, onboarding/*)
 * - 'form': Profile setup (profile, major, gender, interests, etc.)
 * - 'chat': Chat pages (chat/:id)
 * - 'splash': Splash screen only
 */

// Routes that should use WebLayout (everything except splash and chat)
const WEB_LAYOUT_ROUTES = [
  '/discover', '/events', '/matches', '/messages', '/my-profile', '/filters', '/profile-detail',
  '/signup', '/uni-email', '/verify', '/phone',
  '/onboarding/1', '/onboarding/2', '/onboarding/3',
  '/profile', '/major', '/gender', '/interests', '/search-friends', '/notifications'
]

// Routes that use chat layout
const CHAT_ROUTES_PREFIX = '/chat/'

function AppContent() {
  const location = useLocation()
  const isWebLayoutRoute = WEB_LAYOUT_ROUTES.includes(location.pathname)
  const isChatRoute = location.pathname.startsWith(CHAT_ROUTES_PREFIX)
  const isSplash = location.pathname === '/'
  
  // Build routes once
  const buildRoutes = () => (
    <Routes>
      {/* Splash */}
      <Route path="/" element={<SplashScreen />} />
      
      {/* Onboarding Flow */}
      <Route path="/onboarding/1" element={<Onboarding1 />} />
      <Route path="/onboarding/2" element={<Onboarding2 />} />
      <Route path="/onboarding/3" element={<Onboarding3 />} />
      
      {/* Auth Flow */}
      <Route path="/signup" element={<SignUpScreen />} />
      <Route path="/uni-email" element={<UniEmailScreen />} />
      <Route path="/phone" element={<PhoneScreen />} />
      <Route path="/verify" element={<VerifyScreen />} />
      
      {/* Profile Setup Flow */}
      <Route path="/profile" element={<ProfileScreen />} />
      <Route path="/major" element={<MajorScreen />} />
      <Route path="/gender" element={<GenderScreen />} />
      <Route path="/interests" element={<InterestsScreen />} />
      
      {/* Permissions Flow */}
      <Route path="/search-friends" element={<SearchFriendsScreen />} />
      <Route path="/notifications" element={<NotificationsScreen />} />
      
      {/* Main App Screens */}
      <Route path="/discover" element={<DiscoverScreen />} />
      <Route path="/events" element={<EventsScreen />} />
      <Route path="/filters" element={<FiltersScreen />} />
      <Route path="/profile-detail" element={<ProfileDetailScreen />} />
      <Route path="/matches" element={<MatchesScreen />} />
      <Route path="/messages" element={<MessagesScreen />} />
      <Route path="/chat/:id" element={<ChatScreen />} />
      <Route path="/my-profile" element={<ProfileScreen />} />
    </Routes>
  )

  // Chat routes - Three-column layout
  if (isChatRoute) {
    return (
      <>
        {/* Desktop/Tablet: Chat layout */}
        <ChatDesktopLayout>
          {buildRoutes()}
        </ChatDesktopLayout>
        
        {/* Mobile: Phone frame */}
        <div className="mobile-layout-wrapper">
          <div className="desktop-preview">
            <MobileFrame>
              {buildRoutes()}
            </MobileFrame>
          </div>
        </div>
      </>
    )
  }

  // Web layout routes (all except splash)
  if (isWebLayoutRoute) {
    return (
      <>
        {/* Desktop/Tablet: Web layout */}
        <WebLayout>
          {buildRoutes()}
        </WebLayout>
        
        {/* Mobile: Phone frame */}
        <div className="mobile-layout-wrapper">
          <div className="desktop-preview">
            <MobileFrame>
              {buildRoutes()}
            </MobileFrame>
          </div>
        </div>
      </>
    )
  }

  // Splash screen - Always mobile frame style
  return (
    <div className="desktop-preview">
      <MobileFrame>
        {buildRoutes()}
      </MobileFrame>
    </div>
  )
}

function App() {
  return <AppContent />
}

export default App
