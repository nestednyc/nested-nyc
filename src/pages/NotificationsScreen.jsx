import { useNavigate } from 'react-router-dom'
import { useOnboarding } from '../context/OnboardingContext'

/**
 * NotificationsScreen - "Enable notifications" Permission Screen
 * Final step of onboarding flow - marks onboarding as complete
 * 
 * Specs from Figma:
 * - Skip button: top right, 16px bold, #5B4AE6
 * - Illustration: Orange/yellow chat bubble icons, centered
 * - Title: "Enable notifications", 34px bold, #5B4AE6
 * - Description: 14px, #5B4AE6, centered, line-height 1.5
 * - Button: "I want to be notified", 56px height, 15px radius, #5B4AE6 bg
 * - Home indicator: 134x5px black, 8px from bottom
 */

function NotificationsScreen() {
  const navigate = useNavigate()
  const { setHasOnboarded } = useOnboarding()

  const handleComplete = () => {
    // Mark onboarding as complete in React state + localStorage
    setHasOnboarded(true)
    // Navigate to main app
    navigate('/discover', { replace: true })
  }

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
          onClick={handleComplete}
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
        <NotificationsIllustration />
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
        Enable notifications
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
        Get push-notification when you get the match
        <br />
        or receive a message.
      </p>
      
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      
      {/* Notify Button */}
      <button 
        onClick={handleComplete}
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
        I want to be notified
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
 * NotificationsIllustration - Orange/yellow chat bubble icons
 * Exact Figma export representation
 */
function NotificationsIllustration() {
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Large chat bubble - back */}
      <path 
        d="M40 50 L120 50 Q135 50 135 65 L135 105 Q135 120 120 120 L75 120 L60 140 L60 120 L40 120 Q25 120 25 105 L25 65 Q25 50 40 50Z" 
        fill="#F5A623" 
        opacity="0.3"
      />
      
      {/* Medium chat bubble - middle */}
      <path 
        d="M45 55 L115 55 Q128 55 128 68 L128 98 Q128 111 115 111 L72 111 L58 128 L58 111 L45 111 Q32 111 32 98 L32 68 Q32 55 45 55Z" 
        fill="#F5A623" 
        opacity="0.6"
      />
      
      {/* Small chat bubble - front with icon */}
      <path 
        d="M50 60 L110 60 Q120 60 120 70 L120 95 Q120 105 110 105 L70 105 L58 118 L58 105 L50 105 Q40 105 40 95 L40 70 Q40 60 50 60Z" 
        fill="#F5A623"
      />
      
      {/* Chat icon lines inside */}
      <line x1="55" y1="75" x2="105" y2="75" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <line x1="55" y1="85" x2="90" y2="85" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  )
}

export default NotificationsScreen

