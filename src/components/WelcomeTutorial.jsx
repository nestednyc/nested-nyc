import { useState, useEffect } from 'react'

const TUTORIAL_KEY = 'nested_tutorial_seen'

const tips = [
  {
    icon: '🔍',
    title: 'Discover projects',
    description: 'Browse projects from NYC students and find teams to join.'
  },
  {
    icon: '🚀',
    title: 'Join a team or create your own',
    description: 'Request to join projects you love, or start something new.'
  },
  {
    icon: '📅',
    title: 'Attend events',
    description: 'Check out hackathons, meetups, and workshops happening near you.'
  }
]

function WelcomeTutorial() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(TUTORIAL_KEY)
    if (!seen) {
      setVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(TUTORIAL_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      animation: 'tutorialFadeIn 0.2s ease-out'
    }}>
      <style>{`
        @keyframes tutorialFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tutorialSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        width: '100%',
        maxWidth: '420px',
        margin: '0 16px',
        backgroundColor: 'white',
        borderRadius: '20px',
        padding: '32px 28px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
        animation: 'tutorialSlideUp 0.3s ease-out 0.1s both'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            backgroundColor: '#EEF2FF', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px'
          }}>
            👋
          </div>
          <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#111827' }}>
            Welcome to Nested
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#6B7280' }}>
            Here's how to get started
          </p>
        </div>

        {/* Tips */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
          {tips.map((tip, idx) => (
            <div key={idx} style={{
              display: 'flex', alignItems: 'flex-start', gap: '14px',
              padding: '14px', backgroundColor: '#FAFAFA', borderRadius: '12px'
            }}>
              <span style={{
                fontSize: '22px', width: '36px', height: '36px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#EEF2FF', borderRadius: '10px', flexShrink: 0
              }}>
                {tip.icon}
              </span>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                  {tip.title}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280', lineHeight: 1.4 }}>
                  {tip.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleDismiss}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '15px',
            fontWeight: 600,
            color: 'white',
            backgroundColor: '#5B4AE6',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(91, 74, 230, 0.3)'
          }}
        >
          Got it!
        </button>
      </div>
    </div>
  )
}

export default WelcomeTutorial
