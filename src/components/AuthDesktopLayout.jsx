import DesktopNav from './DesktopNav'

/**
 * AuthDesktopLayout - Desktop layout wrapper for auth/onboarding pages
 * 
 * DESKTOP (≥1024px):
 * - Full-width page with top navigation bar
 * - Two-column layout:
 *   - Left: Marketing headline + description
 *   - Right: Auth card (form content)
 * - No mobile phone framing
 * - Matches the look of /discover and other main app pages
 * 
 * MOBILE (<1024px):
 * - Renders children directly (existing mobile layout preserved)
 * - No top nav, single column, touch-friendly
 * 
 * Props:
 * - children: The auth form content (SignUpScreen, UniEmailScreen, etc.)
 * - headline: Main headline for left column (optional)
 * - description: Supporting text for left column (optional)
 * - variant: 'signup' | 'login' | 'verify' | 'onboarding' (affects left column content)
 */

const CONTENT_VARIANTS = {
  signup: {
    headline: 'Join the NYC student network',
    description: 'Connect with verified students from NYU, Columbia, Parsons, and more. Find teammates, join projects, and build something amazing together.',
    features: [
      'Verified .edu emails only',
      'Cross-campus collaboration',
      'Real projects, real teammates'
    ]
  },
  login: {
    headline: 'Welcome back to Nested',
    description: 'Pick up where you left off. Your projects and connections are waiting.',
    features: [
      'Your projects dashboard',
      'Team messages & updates',
      'Discover new opportunities'
    ]
  },
  verify: {
    headline: 'Verify your university',
    description: 'We use your .edu email to confirm you\'re a real student. This keeps our community trusted and focused.',
    features: [
      'Quick email verification',
      'No spam, ever',
      'Join 1000+ NYC students'
    ]
  },
  onboarding: {
    headline: 'Find your project team',
    description: 'Nested connects students across NYC universities to collaborate on real projects—from hackathons to startups.',
    features: [
      'Students from 12+ NYC schools',
      'Skill-based matching',
      'Project-first networking'
    ]
  }
}

function AuthDesktopLayout({ children, variant = 'signup', headline, description }) {
  const content = CONTENT_VARIANTS[variant] || CONTENT_VARIANTS.signup
  const displayHeadline = headline || content.headline
  const displayDescription = description || content.description

  return (
    <>
      {/* Desktop Layout - visible at ≥1024px */}
      <div className="auth-desktop-layout">
        <DesktopNav />
        
        <div className="auth-desktop-container">
          <div className="auth-desktop-content">
            {/* Left Column - Marketing */}
            <div className="auth-left-column">
              <div className="auth-marketing">
                {/* Logo Badge */}
                <div className="auth-logo-badge">
                  <NestedLogo />
                </div>
                
                <h1 className="auth-headline">{displayHeadline}</h1>
                <p className="auth-description">{displayDescription}</p>
                
                {/* Feature List */}
                <ul className="auth-features">
                  {content.features.map((feature, idx) => (
                    <li key={idx} className="auth-feature">
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                {/* Trust Badge */}
                <div className="auth-trust-badge">
                  <div className="auth-trust-avatars">
                    <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=40&h=40&fit=crop" alt="" />
                    <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop" alt="" />
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40&h=40&fit=crop" alt="" />
                    <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop" alt="" />
                  </div>
                  <span className="auth-trust-text">Join 1,200+ NYC students</span>
                </div>
              </div>
            </div>
            
            {/* Right Column - Auth Card */}
            <div className="auth-right-column">
              <div className="auth-card">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile Layout - visible at <1024px */}
      <div className="auth-mobile-layout">
        {children}
      </div>
    </>
  )
}

// Nested Logo
function NestedLogo() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="22" stroke="#E5385A" strokeWidth="2" fill="none" />
      <circle cx="24" cy="24" r="14" stroke="#E5385A" strokeWidth="2" fill="none" />
      <circle cx="24" cy="24" r="6" fill="#E5385A" />
    </svg>
  )
}

// Checkmark Icon
function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" fill="rgba(229, 56, 90, 0.1)" />
      <path d="M8 12L11 15L16 9" stroke="#E5385A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default AuthDesktopLayout

