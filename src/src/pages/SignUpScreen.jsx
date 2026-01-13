import { useNavigate } from 'react-router-dom'

/**
 * SignUpScreen - Nested NYC
 * 
 * Layout:
 * - Screen padding: 40px horizontal
 * - Logo + brand text centered
 * - Sign up buttons
 * - Social login options
 * - Footer links
 */

function SignUpScreen() {
  const navigate = useNavigate()

  const handleContinueWithEmail = () => {
    navigate('/uni-email')
  }

  return (
    <div 
      className="flex flex-col h-full bg-white relative"
      style={{ paddingLeft: '40px', paddingRight: '40px' }}
    >
      {/* Logo Section */}
      <div 
        className="flex flex-col items-center"
        style={{ paddingTop: '100px' }}
      >
        <NestedLogo />
        <h1 
          style={{ 
            marginTop: '12px',
            fontSize: '16px',
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: '#E94057'
          }}
        >
          NESTED
        </h1>
      </div>
      
      
      {/* Continue with email button */}
      <button 
        onClick={handleContinueWithEmail}
        style={{
          marginTop: '100px',
          width: '100%',
          height: '56px',
          backgroundColor: '#E5385A',
          color: 'white',
          fontSize: '16px',
          fontWeight: 700,
          borderRadius: '15px',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        Continue with university email
      </button>
      
      {/* Later connect with - with divider lines */}
      <div 
        className="flex items-center justify-center"
        style={{ marginTop: '24px', gap: '16px' }}
      >
        <div style={{ width: '80px', height: '1px', backgroundColor: '#E8E6EA' }} />
        <span 
          style={{
            color: '#E5385A',
            fontSize: '14px',
            fontWeight: 500,
            whiteSpace: 'nowrap'
          }}
        >
          later connect with
        </span>
        <div style={{ width: '80px', height: '1px', backgroundColor: '#E8E6EA' }} />
      </div>
      
      {/* Social Login Buttons */}
      <div 
        className="flex justify-center"
        style={{ marginTop: '48px', gap: '20px' }}
      >
        {/* Instagram */}
        <button 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '12px',
            border: '1px solid #E8E6EA',
            backgroundColor: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <InstagramIcon />
        </button>
        
        {/* LinkedIn */}
        <button 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '12px',
            border: '1px solid #E8E6EA',
            backgroundColor: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <LinkedInIcon />
        </button>
        
        {/* GitHub */}
        <button 
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '12px',
            border: '1px solid #E8E6EA',
            backgroundColor: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <GitHubIcon />
        </button>
      </div>
      
      {/* Spacer to push footer down */}
      <div style={{ flex: 1 }} />
      
      {/* Ambassador CTA */}
      <div 
        className="flex flex-col justify-center items-center"
        style={{ paddingBottom: '24px', cursor: 'pointer' }}
      >
        {/* Divider line above */}
        <div style={{ width: '260px', height: '1px', backgroundColor: '#E8E6EA', marginBottom: '16px' }} />
        <a 
          href="#" 
          style={{ 
            fontSize: '14px',
            fontWeight: 500,
            color: '#E5385A',
            textDecoration: 'none'
          }}
        >
          become an ambassador instead
        </a>
      </div>
      
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
 * NestedLogo - Geometric polygonal heart
 * Scaled to 70px for sign up screen
 */
function NestedLogo() {
  return (
    <svg 
      width="70" 
      height="63" 
      viewBox="0 0 100 90" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Top left lobe - outer */}
      <path 
        d="M50 20L25 8L8 25L15 45L50 75L50 20Z" 
        fill="#E94057"
      />
      
      {/* Top right lobe - outer */}
      <path 
        d="M50 20L75 8L92 25L85 45L50 75L50 20Z" 
        fill="#F27281"
      />
      
      {/* Left side accent */}
      <path 
        d="M8 25L15 45L25 35L20 20L8 25Z" 
        fill="#8A2387"
      />
      
      {/* Right side accent */}
      <path 
        d="M92 25L85 45L75 35L80 20L92 25Z" 
        fill="#EE6B7D"
      />
      
      {/* Inner left piece */}
      <path 
        d="M25 8L20 20L35 30L50 20L25 8Z" 
        fill="#C73E5E"
      />
      
      {/* Inner right piece */}
      <path 
        d="M75 8L80 20L65 30L50 20L75 8Z" 
        fill="#F8A4B0"
      />
      
      {/* Center top */}
      <path 
        d="M35 30L50 20L65 30L50 45L35 30Z" 
        fill="#F4929F"
      />
      
      {/* Bottom left */}
      <path 
        d="M15 45L35 50L50 75L15 45Z" 
        fill="#B83B5E"
      />
      
      {/* Bottom right */}
      <path 
        d="M85 45L65 50L50 75L85 45Z" 
        fill="#F67280"
      />
      
      {/* Center bottom */}
      <path 
        d="M35 50L50 45L65 50L50 75L35 50Z" 
        fill="#FCCDD3"
      />
      
      {/* Left inner accent */}
      <path 
        d="M25 35L35 30L35 50L25 35Z" 
        fill="#D64565"
      />
      
      {/* Right inner accent */}
      <path 
        d="M75 35L65 30L65 50L75 35Z" 
        fill="#F9B5BD"
      />
    </svg>
  )
}

/**
 * Instagram Icon
 */
function InstagramIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#E5385A">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  )
}

/**
 * LinkedIn Icon
 */
function LinkedInIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#E5385A">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

/**
 * GitHub Icon
 */
function GitHubIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#E5385A">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
  )
}

/**
 * Classic Pointing Hand Cursor - White glove with index finger pointing down
 * Like the old Windows/Mac click here cursor
 */
function PointingHandCursor() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Glove outline */}
      <path 
        d="M16 2C16 2 14 2 14 4V14L11 11C9.5 9.5 7 10.5 7 12.5C7 13.5 7.5 14 8 14.5L14 21C14.5 21.5 15.5 22 17 22H23C26 22 28 20 28 17V11C28 9 26.5 7.5 24.5 7.5H24V6.5C24 5 22.5 3.5 21 3.5H20V3C20 1.5 18.5 0 17 0V2H16Z"
        fill="white"
        stroke="#E5385A"
        strokeWidth="1.5"
      />
      {/* Index finger highlight */}
      <path 
        d="M14 4V14"
        stroke="#E8E6EA"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Cuff */}
      <path 
        d="M13 22H24C24 22 25 24 24 26H13C12 24 13 22 13 22Z"
        fill="white"
        stroke="#E5385A"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export default SignUpScreen
