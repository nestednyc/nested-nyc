import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ContextSidebar from './ContextSidebar'
import { authService, supabase, isSupabaseConfigured } from '../lib/supabase'
import { profileService } from '../services/profileService'
import { getInitialsAvatar } from '../utils/avatarUtils'

// Default avatar for users without a profile picture
const DEFAULT_AVATAR = getInitialsAvatar('User')

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
  // Hide on /messages, /discover (has its own sidebar), /events (wide layout), /matches (focused workspace)
  const shouldShowSidebar = layoutType === 'app' && !['/messages', '/discover', '/events', '/matches'].includes(pathname)
  const isOnboardingRoute = pathname.startsWith('/onboarding') || pathname === '/uni-email'

  // Never show sidebar on onboarding routes
  const showSidebar = shouldShowSidebar && !isOnboardingRoute

  // Events page gets a special wide layout class
  const isEventsPage = pathname === '/events'

  // My Projects page gets a focused workspace layout
  const isMyProjectsPage = pathname === '/matches'

  // Navigation items (Messages hidden for MVP - feature preserved in code)
  const navItems = [
    { path: '/discover', label: 'Discover', icon: 'discover' },
    { path: '/events', label: 'Events', icon: 'events' },
    { path: '/matches', label: 'My Projects', icon: 'projects' },
    // { path: '/messages', label: 'Messages', icon: 'messages' }, // Hidden for MVP
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

          {/* Right side - Profile with Dropdown */}
          <div className="web-header-right">
            {layoutType === 'app' && (
              <ProfileDropdown navigate={navigate} />
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="web-main">
        <div className={`web-content-wrapper ${showSidebar ? 'with-sidebar' : 'centered'} ${isEventsPage ? 'events-wide' : ''} ${isMyProjectsPage ? 'projects-focused' : ''}`}>
          {/* Main Content */}
          <main className={`web-content ${layoutType === 'auth' || layoutType === 'form' ? 'web-content-centered' : ''} ${isEventsPage ? 'web-content-events' : ''} ${isMyProjectsPage ? 'web-content-projects' : ''}`}>
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
 * ProfileDropdown - Avatar with dropdown menu
 */
function ProfileDropdown({ navigate }) {
  const [isOpen, setIsOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(DEFAULT_AVATAR)
  const dropdownRef = useRef(null)

  // Fetch user's avatar on mount
  useEffect(() => {
    const fetchAvatar = async () => {
      // Helper to get profile from localStorage
      const getLocalStorageProfile = () => {
        try {
          const saved = localStorage.getItem('nested_user_profile')
          if (saved) {
            return JSON.parse(saved)
          }
        } catch (e) {}
        return null
      }

      // Try localStorage first for immediate display
      const localProfile = getLocalStorageProfile()
      if (localProfile) {
        const name = `${localProfile.firstName || localProfile.first_name || ''} ${localProfile.lastName || localProfile.last_name || ''}`.trim()
        setAvatarUrl(localProfile.avatar || getInitialsAvatar(name))
      }

      // Then try Supabase for the most up-to-date avatar
      if (isSupabaseConfigured()) {
        try {
          const { data, error } = await profileService.getCurrentProfile()
          if (!error && data) {
            const name = `${data.first_name || ''} ${data.last_name || ''}`.trim()
            setAvatarUrl(data.avatar || getInitialsAvatar(name))
          }
        } catch (err) {
          // Silently fail, we already have localStorage fallback
        }
      }
    }
    fetchAvatar()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    await authService.signOut()
    setIsOpen(false)
    navigate('/auth')
  }

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This will permanently remove your profile, projects, and team memberships. This action cannot be undone.'
    )
    if (!confirmed) return

    try {
      // Get current user ID
      if (isSupabaseConfigured()) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await profileService.deleteProfile(user.id)
        }
      }

      // Sign out
      await authService.signOut()

      // Clear all localStorage data
      localStorage.removeItem('nested_user_profile')
      localStorage.removeItem('nested_projects')
      localStorage.removeItem('nested_tutorial_seen')

      setIsOpen(false)
      navigate('/auth')
    } catch (err) {
      console.error('Delete account error:', err)
      alert('Failed to delete account. Please try again.')
    }
  }

  const menuItems = [
    { label: 'Profile', onClick: () => { navigate('/profile/current-user'); setIsOpen(false) } },
    { label: 'Edit Profile', onClick: () => { navigate('/profile/edit'); setIsOpen(false) } },
    { label: 'Log out', onClick: handleLogout, isDanger: true },
    { label: 'Delete Account', onClick: handleDeleteAccount, isDanger: true },
  ]

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button 
        className="web-profile-btn"
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: 'pointer' }}
      >
        <img
          src={avatarUrl}
          alt="Profile"
          className="web-profile-img"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '160px',
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
            border: '1px solid #E5E7EB',
            padding: '6px',
            zIndex: 1000,
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(-4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          {menuItems.map((item, idx) => (
            <button
              key={idx}
              onClick={item.onClick}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                fontWeight: 500,
                color: item.isDanger ? '#EF4444' : '#374151',
                backgroundColor: 'transparent',
                border: 'none',
                borderRadius: '8px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = item.isDanger ? '#FEF2F2' : '#F3F4F6'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
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





