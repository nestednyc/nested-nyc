import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOnboarding } from '../context/OnboardingContext'

/**
 * GenderScreen - Role Selection (Build/Join/Both)
 * Nested NYC – Student-only project network
 * 
 * Saves rolePreference to DB via OnboardingContext
 */

function GenderScreen() {
  const navigate = useNavigate()
  const { onboardingData, setOnboardingData } = useOnboarding()
  
  const [selected, setSelected] = useState(onboardingData.rolePreference || 'both')
  const [isSaving, setIsSaving] = useState(false)

  const options = [
    { id: 'build', label: 'Build a project', icon: 'check' },
    { id: 'join', label: 'Join a team', icon: 'check' },
    { id: 'both', label: 'Both', icon: 'arrow' },
  ]

  return (
    <div 
      className="flex flex-col h-full bg-white relative"
      style={{ paddingLeft: '40px', paddingRight: '40px' }}
    >
      {/* Header */}
      <div 
        style={{ 
          paddingTop: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)}
          style={{
            width: '52px',
            height: '52px',
            borderRadius: '15px',
            border: '1px solid #E5E7EB',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <svg width="12" height="20" viewBox="0 0 12 20" fill="none">
            <path 
              d="M10 2L2 10L10 18" 
              stroke="#5B4AE6" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
        
        {/* Skip */}
        <button 
          onClick={() => navigate('/interests')}
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
      
      {/* Title */}
      <h1 
        style={{ 
          margin: 0,
          marginTop: '40px',
          fontSize: '34px',
          fontWeight: 700,
          color: '#231429'
        }}
      >
        I'm looking to...
      </h1>
      
      {/* Options */}
      <div style={{ marginTop: '50px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {options.map(option => {
          const isSelected = selected === option.id
          return (
            <button
              key={option.id}
              onClick={() => setSelected(option.id)}
              style={{
                width: '100%',
                height: '58px',
                paddingLeft: '20px',
                paddingRight: '20px',
                borderRadius: '15px',
                backgroundColor: isSelected ? '#5B4AE6' : 'transparent',
                border: isSelected ? 'none' : '1px solid #E5E7EB',
                color: isSelected ? 'white' : '#231429',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '16px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              <span>{option.label}</span>
              {option.icon === 'arrow' ? (
                <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
                  <path 
                    d="M1 1L7 7L1 13" 
                    stroke={isSelected ? 'white' : '#ADAFBB'} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path 
                    d="M4 10L8 14L16 6" 
                    stroke={isSelected ? 'white' : '#ADAFBB'} 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          )
        })}
      </div>
      
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      
      {/* Continue Button */}
      <button 
        onClick={async () => {
          setIsSaving(true)
          try {
            await setOnboardingData({ rolePreference: selected }, true)
          } catch (err) {
            console.error('Failed to save:', err)
          }
          navigate('/interests')
        }}
        disabled={isSaving}
        style={{
          width: '100%',
          height: '56px',
          backgroundColor: '#5B4AE6',
          color: 'white',
          fontSize: '16px',
          fontWeight: 700,
          borderRadius: '15px',
          border: 'none',
          cursor: isSaving ? 'wait' : 'pointer',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {isSaving ? 'Saving...' : 'Continue'}
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

export default GenderScreen
