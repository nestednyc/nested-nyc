import { useLocation } from 'react-router-dom'
import DesktopNav from './DesktopNav'
import DesktopSidebar from './DesktopSidebar'

/**
 * WebLayout - Unified responsive layout for all pages
 * 
 * Provides consistent desktop-first layout matching /discover:
 * - Top navigation bar
 * - Centered content container (max-width: 1200px)
 * - Optional sidebar for main app pages
 * 
 * Layout Types:
 * 1. 'app' - Main app pages with optional sidebar (discover, matches, etc.)
 * 2. 'auth' - Auth/onboarding pages with centered card layout
 * 3. 'chat' - Three-column chat layout
 * 4. 'form' - Profile setup forms (centered, narrower width)
 * 
 * Breakpoints:
 * - Desktop (≥1024px): Full web layout
 * - Tablet (768-1023px): Stacked but wide
 * - Mobile (<768px): Single column, mobile-optimized
 */

// Routes that show sidebar
const SIDEBAR_ROUTES = ['/discover', '/events', '/matches', '/messages']

// Route layout type mapping
const ROUTE_LAYOUTS = {
  // Main app pages
  '/discover': 'app',
  '/events': 'app',
  '/matches': 'app',
  '/messages': 'app',
  '/my-profile': 'app',
  '/filters': 'app',
  '/profile-detail': 'app',
  
  // Auth pages
  '/signup': 'auth',
  '/uni-email': 'auth',
  '/verify': 'auth',
  '/onboarding/1': 'auth',
  '/onboarding/2': 'auth',
  '/onboarding/3': 'auth',
  
  // Profile setup forms
  '/profile': 'form',
  '/major': 'form',
  '/gender': 'form',
  '/interests': 'form',
  '/search-friends': 'form',
  '/notifications': 'form',
}

function WebLayout({ children, layoutType: propLayoutType }) {
  const location = useLocation()
  
  // Determine layout type from route or prop
  const layoutType = propLayoutType || ROUTE_LAYOUTS[location.pathname] || 'app'
  const showSidebar = SIDEBAR_ROUTES.includes(location.pathname) && layoutType === 'app'
  const isChat = location.pathname.startsWith('/chat/')
  
  // Get layout-specific classes
  const getContentClass = () => {
    if (isChat) return 'web-content-chat'
    if (layoutType === 'auth') return 'web-content-auth'
    if (layoutType === 'form') return 'web-content-form'
    return showSidebar ? 'web-content-with-sidebar' : 'web-content-full'
  }

  return (
    <div className="web-layout">
      {/* Top Navigation */}
      <DesktopNav />
      
      {/* Main Content Area */}
      <div className="web-container">
        <div className={`web-content ${getContentClass()}`}>
          {/* Main Content */}
          <main className="web-main">
            {layoutType === 'auth' ? (
              <div className="web-auth-wrapper">
                <div className="web-auth-marketing">
                  <AuthMarketingContent pathname={location.pathname} />
                </div>
                <div className="web-auth-card">
                  {children}
                </div>
              </div>
            ) : layoutType === 'form' ? (
              <div className="web-form-wrapper">
                <FormProgressIndicator pathname={location.pathname} />
                <div className="web-form-card">
                  {children}
                </div>
              </div>
            ) : (
              <div className="web-app-content">
                {children}
              </div>
            )}
          </main>
          
          {/* Sidebar - only for main app pages */}
          {showSidebar && (
            <aside className="web-sidebar">
              <DesktopSidebar />
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * AuthMarketingContent - Left column content for auth pages
 */
function AuthMarketingContent({ pathname }) {
  const content = {
    '/signup': {
      headline: 'Join the NYC student network',
      description: 'Connect with verified students from NYU, Columbia, Parsons, and more.',
      features: ['Verified .edu emails only', 'Cross-campus collaboration', 'Real projects, real teammates']
    },
    '/uni-email': {
      headline: 'Verify your university',
      description: 'We use your .edu email to confirm you\'re a real student.',
      features: ['Quick email verification', 'No spam, ever', 'Join 1000+ NYC students']
    },
    '/verify': {
      headline: 'Check your inbox',
      description: 'Enter the verification code we sent to your email.',
      features: ['Secure verification', 'One-time code', 'Instant access']
    },
    '/onboarding/1': {
      headline: 'Verified Students',
      description: 'Every member is verified with a .edu email.',
      features: ['Real students only', 'Trusted community', 'NYC universities']
    },
    '/onboarding/2': {
      headline: 'Find Your Team',
      description: 'Match with students who complement your skills.',
      features: ['Skill-based matching', 'Project collaboration', 'Build together']
    },
    '/onboarding/3': {
      headline: 'Build Amazing Projects',
      description: 'From hackathons to startups, create something real.',
      features: ['Real-world projects', 'Portfolio building', 'Launch together']
    }
  }
  
  const data = content[pathname] || content['/signup']

  return (
    <div className="auth-marketing-inner">
      <div className="auth-marketing-logo">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="#E5385A" strokeWidth="2" fill="none" />
          <circle cx="24" cy="24" r="14" stroke="#E5385A" strokeWidth="2" fill="none" />
          <circle cx="24" cy="24" r="6" fill="#E5385A" />
        </svg>
      </div>
      <h1 className="auth-marketing-headline">{data.headline}</h1>
      <p className="auth-marketing-description">{data.description}</p>
      <ul className="auth-marketing-features">
        {data.features.map((feature, idx) => (
          <li key={idx}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="rgba(229, 56, 90, 0.1)" />
              <path d="M8 12L11 15L16 9" stroke="#E5385A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="auth-marketing-trust">
        <div className="auth-trust-avatars">
          <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop" alt="" />
          <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop" alt="" />
          <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop" alt="" />
        </div>
        <span>Join 1,200+ NYC students</span>
      </div>
    </div>
  )
}

/**
 * FormProgressIndicator - Horizontal stepper for profile setup
 */
function FormProgressIndicator({ pathname }) {
  const steps = [
    { path: '/profile', label: 'Profile' },
    { path: '/major', label: 'Major' },
    { path: '/gender', label: 'About' },
    { path: '/interests', label: 'Interests' },
    { path: '/search-friends', label: 'Friends' },
    { path: '/notifications', label: 'Notifications' }
  ]
  
  const currentIndex = steps.findIndex(s => s.path === pathname)

  return (
    <div className="form-progress">
      <div className="form-progress-steps">
        {steps.map((step, idx) => (
          <div 
            key={step.path}
            className={`form-progress-step ${idx <= currentIndex ? 'active' : ''} ${idx === currentIndex ? 'current' : ''}`}
          >
            <div className="form-progress-dot">
              {idx < currentIndex ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12L10 17L19 8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <span>{idx + 1}</span>
              )}
            </div>
            <span className="form-progress-label">{step.label}</span>
          </div>
        ))}
      </div>
      <div className="form-progress-bar">
        <div 
          className="form-progress-fill" 
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
        />
      </div>
    </div>
  )
}

export default WebLayout

