import { useNavigate, useLocation } from 'react-router-dom'

/**
 * DesktopNav - Top Navigation Bar for Desktop (≥1024px)
 * Nested NYC – Student-only project network
 * 
 * Replaces bottom mobile navigation on desktop screens.
 * Contains: Logo, Discover, Events, My Projects, Messages, Profile Avatar
 */

function DesktopNav() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const navItems = [
    { id: 'discover', path: '/discover', label: 'Discover' },
    { id: 'events', path: '/events', label: 'Events' },
    { id: 'my-projects', path: '/matches', label: 'My Projects' },
    { id: 'messages', path: '/messages', label: 'Messages' },
  ]
  
  const isActive = (path) => location.pathname === path

  return (
    <nav className="desktop-nav">
      {/* Logo - Left Side */}
      <div 
        className="desktop-nav-logo"
        onClick={() => navigate('/discover')}
      >
        <NestedLogo />
        <span className="desktop-nav-logo-text">Nested</span>
      </div>
      
      {/* Navigation Links - Center */}
      <div className="desktop-nav-links">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className={`desktop-nav-link ${isActive(item.path) ? 'active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      
      {/* Profile Avatar - Right Side */}
      <div className="desktop-nav-right">
        {/* Notification Bell */}
        <button 
          className="desktop-nav-icon-btn"
          onClick={() => navigate('/notifications')}
        >
          <NotificationIcon />
        </button>
        
        {/* Profile Avatar */}
        <button 
          className="desktop-nav-avatar"
          onClick={() => navigate('/my-profile')}
        >
          <div className="desktop-nav-avatar-img">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ADAFBB" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
        </button>
      </div>
    </nav>
  )
}

// Nested Logo SVG
function NestedLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
      {/* Outer nest circle */}
      <circle cx="24" cy="24" r="22" stroke="#E5385A" strokeWidth="2" fill="none" />
      {/* Inner nest circle */}
      <circle cx="24" cy="24" r="14" stroke="#E5385A" strokeWidth="2" fill="none" />
      {/* Center dot/egg */}
      <circle cx="24" cy="24" r="6" fill="#E5385A" />
    </svg>
  )
}

// Notification Bell Icon
function NotificationIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

export default DesktopNav

