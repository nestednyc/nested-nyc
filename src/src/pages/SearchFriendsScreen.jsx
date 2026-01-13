import { useNavigate } from 'react-router-dom'

/**
 * SearchFriendsScreen - Find Classmates Screen
 * Nested NYC – Student-only project network
 * 
 * Specs:
 * - Skip button: top right, 16px bold, #5B4AE6
 * - Illustration: Purple blob shapes with student icons
 * - Title: "Find classmates", 34px bold, #5B4AE6
 * - Description: 14px, #5B4AE6, centered
 * - Button: "See who's on Nested", 56px height, 15px radius, #5B4AE6 bg
 * - Home indicator: 134x5px black, 8px from bottom
 */

function SearchFriendsScreen() {
  const navigate = useNavigate()

  return (
    <div 
      className="flex flex-col h-full bg-white relative"
      style={{ paddingLeft: '40px', paddingRight: '40px' }}
    >
      {/* Header with Skip */}
      <div 
        style={{ 
          paddingTop: '50px',
          display: 'flex',
          justifyContent: 'flex-end'
        }}
      >
        <button 
          onClick={() => navigate('/notifications')}
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#5B4AE6',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Skip
        </button>
      </div>
      
      {/* Illustration */}
      <div 
        style={{ 
          marginTop: '40px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '200px'
        }}
      >
        <ClassmatesIllustration />
      </div>
      
      {/* Title */}
      <h1 
        style={{ 
          margin: 0,
          marginTop: '40px',
          fontSize: '34px',
          fontWeight: 700,
          color: '#5B4AE6',
          textAlign: 'center'
        }}
      >
        Find classmates
      </h1>
      
      {/* Description */}
      <p 
        style={{ 
          marginTop: '12px',
          fontSize: '14px',
          lineHeight: 1.5,
          color: '#5B4AE6',
          textAlign: 'center'
        }}
      >
        See who from your school is already
        <br />
        on Nested building cool projects
      </p>
      
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      
      {/* Access Button */}
      <button 
        onClick={() => navigate('/notifications')}
        style={{
          width: '100%',
          height: '56px',
          backgroundColor: '#5B4AE6',
          color: 'white',
          fontSize: '16px',
          fontWeight: 700,
          borderRadius: '15px',
          border: 'none',
          cursor: 'pointer',
          marginBottom: '60px'
        }}
      >
        See who's on Nested
      </button>
      
      {/* Home Indicator */}
      <div 
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: '8px' }}
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

/**
 * ClassmatesIllustration - Purple blob shapes with student icons
 * Nested-themed illustration
 */
function ClassmatesIllustration() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Large purple blob - back */}
      <ellipse cx="85" cy="90" rx="55" ry="50" fill="#4A3CD4" opacity="0.3"/>
      
      {/* Medium purple blob - middle */}
      <ellipse cx="70" cy="75" rx="45" ry="42" fill="#4A3CD4" opacity="0.5"/>
      
      {/* Small purple blob - front */}
      <ellipse cx="80" cy="80" rx="35" ry="32" fill="#4A3CD4" opacity="0.8"/>
      
      {/* Student icon 1 - left */}
      <g transform="translate(45, 55)">
        <circle cx="12" cy="8" r="8" fill="white"/>
        <path d="M0 28C0 20.268 6.268 14 14 14H10C17.732 14 24 20.268 24 28V32H0V28Z" fill="white"/>
      </g>
      
      {/* Student icon 2 - right */}
      <g transform="translate(90, 60)">
        <circle cx="12" cy="8" r="8" fill="white"/>
        <path d="M0 28C0 20.268 6.268 14 14 14H10C17.732 14 24 20.268 24 28V32H0V28Z" fill="white"/>
      </g>
      
      {/* Connection line / project icon */}
      <path d="M69 75 L91 75" stroke="white" strokeWidth="2" strokeDasharray="4 2"/>
      
      {/* Small graduation cap hint */}
      <path d="M78 45 L88 50 L78 55 L68 50 Z" fill="white" opacity="0.8"/>
    </svg>
  )
}

export default SearchFriendsScreen
