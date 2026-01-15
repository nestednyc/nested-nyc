import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'

/**
 * BottomNav - Bottom Navigation Bar (Mobile Only)
 * Nested NYC – Student-only project network
 * 
 * Specs:
 * - Height: 83px total (includes home indicator area)
 * - Icons: 24x24px
 * - Active icon: #5B4AE6 (filled)
 * - Inactive icon: #ADAFBB (outline)
 * - 4 tabs: Discover (projects), My Projects, Messages (nests), Profile
 * - Home indicator: 134x5px black, 8px from bottom
 * - ONLY renders on mobile (< 1024px)
 */

function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(true)

  // Check if we're on mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Don't render on desktop
  if (!isMobile) {
    return null
  }
  
  // Tabs (Messages hidden for MVP - feature preserved in code)
  const tabs = [
    { id: 'discover', path: '/discover', icon: CardsIcon, label: 'Discover projects' },
    { id: 'my-projects', path: '/matches', icon: HeartIcon, label: 'My Projects' },
    // { id: 'messages', path: '/messages', icon: ChatIcon, label: 'Messages' }, // Hidden for MVP
    { id: 'profile', path: '/profile/current-user', icon: PersonIcon, label: 'Your Profile' },
  ]
  
  const isActive = (path) => location.pathname === path

  return (
    <div 
      className="bottom-nav"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '83px',
        backgroundColor: 'white',
        borderTop: '1px solid #E5E7EB'
      }}
    >
      {/* Tab Icons */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          paddingTop: '12px',
          paddingBottom: '8px'
        }}
      >
        {tabs.map(tab => {
          const active = isActive(tab.path)
          const IconComponent = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => navigate(tab.path)}
              aria-label={tab.label}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconComponent active={active} />
            </button>
          )
        })}
      </div>
      
      {/* Home Indicator */}
      <div 
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)'
        }}
      >
        <div 
          style={{
            width: '134px',
            height: '5px',
            backgroundColor: '#000000',
            borderRadius: '100px'
          }}
        />
      </div>
    </div>
  )
}

// Discover Projects Icon
function CardsIcon({ active }) {
  const color = active ? '#5B4AE6' : '#ADAFBB'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {active ? (
        // Filled version
        <>
          <rect x="2" y="4" width="16" height="18" rx="3" fill={color}/>
          <rect x="6" y="2" width="16" height="18" rx="3" fill={color} stroke="white" strokeWidth="2"/>
        </>
      ) : (
        // Outline version
        <>
          <rect x="2" y="4" width="16" height="18" rx="3" stroke={color} strokeWidth="1.5" fill="none"/>
          <rect x="6" y="2" width="16" height="18" rx="3" stroke={color} strokeWidth="1.5" fill="none"/>
        </>
      )}
    </svg>
  )
}

// My Projects Icon (saved/joined)
function HeartIcon({ active }) {
  const color = active ? '#5B4AE6' : '#ADAFBB'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path 
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  )
}

// Messages Icon
function ChatIcon({ active }) {
  const color = active ? '#5B4AE6' : '#ADAFBB'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path 
        d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth="1.5"
      />
      {!active && (
        <>
          <line x1="6" y1="8" x2="18" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="6" y1="12" x2="14" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        </>
      )}
    </svg>
  )
}

// Your Profile Icon
function PersonIcon({ active }) {
  const color = active ? '#5B4AE6' : '#ADAFBB'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle 
        cx="12" 
        cy="8" 
        r="4" 
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth="1.5"
      />
      <path 
        d="M4 20c0-4 4-6 8-6s8 2 8 6"
        fill={active ? color : 'none'}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default BottomNav

