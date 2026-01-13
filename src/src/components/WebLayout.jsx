import { useLocation, useNavigate } from 'react-router-dom'
import ContextSidebar from './ContextSidebar'

/**
 * WebLayout - Desktop layout wrapper with header navigation and contextual sidebar
 * 
 * Layout Types:
 * - 'app': Main app pages (Discover, Events, My Projects, Messages)
 * - 'auth': Auth/onboarding pages (no sidebar)
 * - 'form': Profile setup forms (no sidebar)
 * - 'chat': Chat pages (no sidebar)
 */
function WebLayout({ children, layoutType = 'app' }) {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname

  // Determine if sidebar should be shown based on route
  const shouldShowSidebar = layoutType === 'app' && !['/messages'].includes(pathname)
  const isOnboardingRoute = pathname.startsWith('/onboarding') || pathname === '/uni-email'
  
  // Never show sidebar on onboarding routes
  const showSidebar = shouldShowSidebar && !isOnboardingRoute

  // Navigation items
  const navItems = [
    { path: '/discover', label: 'Discover', icon: 'discover' },
    { path: '/events', label: 'Events', icon: 'events' },
    { path: '/matches', label: 'My Projects', icon: 'projects' },
    { path: '/messages', label: 'Messages', icon: 'messages' },
  ]

  return (
    <div className="web-layout">
      {/* Top Navigation Header */}
      <header className="web-header">
        <div className="web-header-content">
          {/* Logo */}
          <div 
            className="web-logo"
            onClick={() => navigate('/discover')}
          >
            <span className="web-logo-text">NESTED</span>
          </div>

          {/* Navigation - only show for app layout */}
          {layoutType === 'app' && (
            <nav className="web-nav">
              {navItems.map(item => (
                <button
                  key={item.path}
                  className={`web-nav-item ${pathname === item.path ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <NavIcon type={item.icon} active={pathname === item.path} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          )}

          {/* Right side - Profile */}
          <div className="web-header-right">
            {layoutType === 'app' && (
              <button 
                className="web-profile-btn"
                onClick={() => navigate('/profile/edit')}
              >
                <img 
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop"
                  alt="Profile"
                  className="web-profile-img"
                />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="web-main">
        <div className={`web-content-wrapper ${showSidebar ? 'with-sidebar' : 'centered'}`}>
          {/* Main Content */}
          <main className={`web-content ${layoutType === 'auth' || layoutType === 'form' ? 'web-content-centered' : ''}`}>
            {children}
          </main>

          {/* Contextual Sidebar */}
          {showSidebar && (
            <aside className="web-sidebar">
              <ContextSidebar />
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * NavIcon - Navigation icons
 */
function NavIcon({ type, active }) {
  const color = active ? '#5B4AE6' : '#6B7280'
  
  switch (type) {
    case 'discover':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/>
        </svg>
      )
    case 'events':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      )
    case 'projects':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
      )
    case 'messages':
      return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      )
    default:
      return null
  }
}

export default WebLayout





