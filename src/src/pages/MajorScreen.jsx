import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * MajorScreen - Major + Looking For Selection
 * Nested NYC – Student-only project network
 * 
 * UX Philosophy:
 * - NO SCROLLING - everything fits in viewport
 * - Icon-driven visual language
 * - Horizontal scroll for majors (compact)
 * - Grid of icon cards for intent
 */

// Major/Field icons
const MajorIcons = {
  cs: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  design: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z"/>
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
      <path d="M2 2l7.586 7.586"/>
      <circle cx="11" cy="11" r="2"/>
    </svg>
  ),
  business: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10"/>
      <line x1="18" y1="20" x2="18" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="16"/>
    </svg>
  ),
  engineering: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  data: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3"/>
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  media: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
    </svg>
  ),
  arts: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r="2.5"/>
      <circle cx="19" cy="13" r="2"/>
      <circle cx="6" cy="12" r="2.5"/>
      <circle cx="10" cy="18.5" r="2"/>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  ),
  science: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6v5.586a1 1 0 0 0 .293.707l5.293 5.293a2 2 0 0 1 0 2.828l-2.586 2.586a2 2 0 0 1-2.828 0L9.88 14.707A1 1 0 0 0 9.172 14.414L3.586 20A2 2 0 0 1 .757 17.172l5.586-5.586A1 1 0 0 0 6.636 11H3V8l3-5h6z"/>
      <line x1="10" y1="3" x2="10" y2="8"/>
      <line x1="14" y1="3" x2="14" y2="8"/>
    </svg>
  ),
  social: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  other: (color) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/>
      <circle cx="19" cy="12" r="1"/>
      <circle cx="5" cy="12" r="1"/>
    </svg>
  ),
}

// Looking For icons - larger, bolder
const LookingForIcons = {
  cofounder: (color) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2L11 13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  teammates: (color) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  sideproject: (color) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
    </svg>
  ),
  study: (color) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="8" y1="7" x2="16" y2="7"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  mentor: (color) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  ),
  network: (color) => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  ),
}

function MajorScreen() {
  const navigate = useNavigate()
  const [selectedMajor, setSelectedMajor] = useState(null)
  const [selectedLookingFor, setSelectedLookingFor] = useState([])

  const majors = [
    { id: 'cs', label: 'CS' },
    { id: 'design', label: 'Design' },
    { id: 'business', label: 'Business' },
    { id: 'engineering', label: 'Engineering' },
    { id: 'data', label: 'Data' },
    { id: 'media', label: 'Media' },
    { id: 'arts', label: 'Arts' },
    { id: 'science', label: 'Science' },
    { id: 'social', label: 'Social' },
    { id: 'other', label: 'Other' },
  ]

  const lookingForOptions = [
    { id: 'cofounder', label: 'Co-founder' },
    { id: 'teammates', label: 'Teammates' },
    { id: 'sideproject', label: 'Side projects' },
    { id: 'study', label: 'Study group' },
    { id: 'mentor', label: 'Mentorship' },
    { id: 'network', label: 'Networking' },
  ]

  const toggleLookingFor = (id) => {
    setSelectedLookingFor(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    )
  }

  const canContinue = selectedMajor && selectedLookingFor.length > 0

  return (
    <div 
      className="flex flex-col h-full bg-white relative"
      style={{ 
        paddingLeft: '24px', 
        paddingRight: '24px',
        overflow: 'hidden' // NO SCROLLING
      }}
    >
      {/* Header */}
      <div 
        style={{ 
          paddingTop: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            border: '1px solid #E5E7EB',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <svg width="10" height="18" viewBox="0 0 12 20" fill="none">
            <path 
              d="M10 2L2 10L10 18" 
              stroke="#5B4AE6" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
        
        {/* Progress Dots */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3, 4].map((step) => (
            <div 
              key={step}
              style={{
                width: step === 2 ? '20px' : '6px',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: step <= 2 ? '#5B4AE6' : '#E5E7EB',
                transition: 'all 0.3s ease'
              }}
            />
          ))}
        </div>
        
        {/* Skip */}
        <button 
          onClick={() => navigate('/gender')}
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#5B4AE6',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 0'
          }}
        >
          Skip
        </button>
      </div>
      
      {/* === SECTION 1: Your Field === */}
      <div style={{ marginTop: '24px', flexShrink: 0 }}>
        <h1 
          style={{ 
            margin: 0,
            fontSize: '26px',
            fontWeight: 700,
            color: '#231429'
          }}
        >
          Your field
        </h1>
      </div>
      
      {/* Horizontal Scroll for Majors */}
      <div 
        style={{ 
          marginTop: '14px',
          marginLeft: '-24px',
          marginRight: '-24px',
          paddingLeft: '24px',
          paddingRight: '24px',
          overflowX: 'auto',
          overflowY: 'hidden',
          flexShrink: 0,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
        className="hide-scrollbar"
      >
        <div 
          style={{ 
            display: 'flex',
            gap: '10px',
            paddingBottom: '4px'
          }}
        >
          {majors.map(major => {
            const isSelected = selectedMajor === major.id
            const IconComponent = MajorIcons[major.id]
            const color = isSelected ? 'white' : '#5B4AE6'
            
            return (
              <button
                key={major.id}
                onClick={() => setSelectedMajor(major.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '12px 16px',
                  minWidth: '72px',
                  borderRadius: '16px',
                  backgroundColor: isSelected ? '#5B4AE6' : 'transparent',
                  border: isSelected ? '2px solid #5B4AE6' : '1.5px solid #E5E7EB',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                  flexShrink: 0
                }}
              >
                {IconComponent && IconComponent(color)}
                <span 
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: color,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {major.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* === SECTION 2: Looking For === */}
      <div style={{ marginTop: '28px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 
            style={{ 
              margin: 0,
              fontSize: '26px',
              fontWeight: 700,
              color: '#231429'
            }}
          >
            Looking for
          </h2>
          
          {selectedLookingFor.length > 0 && (
            <span 
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#5B4AE6'
              }}
            >
              {selectedLookingFor.length} selected
            </span>
          )}
        </div>
        
        <p 
          style={{ 
            margin: 0,
            marginTop: '4px',
            fontSize: '13px',
            color: '#ADAFBB'
          }}
        >
          Select all that apply
        </p>
      </div>
      
      {/* 3x2 Grid of Icon Cards */}
      <div 
        style={{ 
          flex: 1,
          marginTop: '14px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(2, 1fr)',
          gap: '10px',
          minHeight: 0
        }}
      >
        {lookingForOptions.map(option => {
          const isSelected = selectedLookingFor.includes(option.id)
          const IconComponent = LookingForIcons[option.id]
          const color = isSelected ? '#5B4AE6' : '#231429'
          
          return (
            <button
              key={option.id}
              onClick={() => toggleLookingFor(option.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px 8px',
                borderRadius: '16px',
                backgroundColor: isSelected ? 'rgba(109, 93, 246, 0.08)' : '#FAFAFA',
                border: isSelected ? '2px solid #5B4AE6' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                position: 'relative'
              }}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div 
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    backgroundColor: '#5B4AE6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                    <path 
                      d="M5 12L10 17L19 8" 
                      stroke="white" 
                      strokeWidth="3" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
              
              {IconComponent && IconComponent(color)}
              
              <span 
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: color,
                  textAlign: 'center',
                  lineHeight: 1.2
                }}
              >
                {option.label}
              </span>
            </button>
          )
        })}
      </div>
      
      {/* Continue Button */}
      <button 
        onClick={() => canContinue && navigate('/gender')}
        style={{
          width: '100%',
          height: '54px',
          backgroundColor: canContinue ? '#5B4AE6' : '#E5E7EB',
          color: canContinue ? 'white' : '#ADAFBB',
          fontSize: '16px',
          fontWeight: 700,
          borderRadius: '15px',
          border: 'none',
          cursor: canContinue ? 'pointer' : 'not-allowed',
          marginTop: '16px',
          marginBottom: '20px',
          flexShrink: 0,
          transition: 'all 0.2s ease'
        }}
      >
        Continue
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
      
      {/* CSS for hiding scrollbar */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}

export default MajorScreen
