import { useLocation } from 'react-router-dom'
import DesktopNav from './DesktopNav'
import DesktopSidebar from './DesktopSidebar'

/**
 * ResponsiveLayout - Switches between Mobile and Desktop layouts
 * 
 * DESKTOP (≥1024px):
 * - Top navigation bar (DesktopNav)
 * - Centered content container (max-width: 1280px)
 * - Two-column layout: Main content + Optional sidebar
 * 
 * MOBILE (<1024px):
 * - Uses existing mobile UI via MobileFrame
 * - No changes to existing mobile components
 * 
 * This component is only rendered for main app screens that need desktop layout.
 * Auth/onboarding screens continue to use the MobileFrame wrapper only.
 */

// Routes that should have the desktop two-column layout with sidebar
const SIDEBAR_ROUTES = ['/discover', '/events', '/matches', '/messages']

// Routes that use desktop layout (top nav but no sidebar needed)
const DESKTOP_ROUTES = ['/discover', '/events', '/matches', '/messages', '/my-profile', '/filters', '/profile-detail']

function ResponsiveLayout({ children }) {
  const location = useLocation()
  const showSidebar = SIDEBAR_ROUTES.includes(location.pathname)
  const isDesktopRoute = DESKTOP_ROUTES.includes(location.pathname)
  
  // Only apply desktop layout to specific routes
  if (!isDesktopRoute) {
    return children
  }

  return (
    <div className="responsive-layout">
      {/* Desktop Navigation - Hidden on mobile via CSS */}
      <DesktopNav />
      
      {/* Main Content Area */}
      <div className="desktop-main-container">
        <div className={`desktop-content-wrapper ${showSidebar ? 'with-sidebar' : ''}`}>
          {/* Main Content Column */}
          <main className="desktop-main-content">
            {children}
          </main>
          
          {/* Sidebar - Only on certain routes */}
          {showSidebar && (
            <aside className="desktop-sidebar">
              <DesktopSidebar />
            </aside>
          )}
        </div>
      </div>
    </div>
  )
}

export default ResponsiveLayout

