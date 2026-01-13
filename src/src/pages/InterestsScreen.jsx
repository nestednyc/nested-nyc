import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * InterestsScreen - Skills Selection
 * Nested NYC – Student-only project network
 * 
 * Specs:
 * - Back button: 52x52px, 15px radius, border #E5E7EB
 * - Skip: 16px bold, #5B4AE6
 * - Title: 34px bold italic, #5B4AE6
 * - Subtitle: 14px, #5B4AE6
 * - Grid: 2 columns, gap 10px
 * - Tags: 46px height, 15px radius, line icons
 *   - Unselected: border #E5E7EB, icon+text #5B4AE6
 *   - Selected: bg #5B4AE6, icon+text white
 * - Continue btn: 56px height, 15px radius, #5B4AE6 bg
 */

// Skill icon components
const icons = {
  react: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <ellipse cx="12" cy="12" rx="10" ry="4"/>
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/>
      <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>
    </svg>
  ),
  python: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2c-5 0-5 3-5 3v3h5v1H5s-3-.3-3 5 2.5 5 2.5 5h2v-3s0-2.5 2.5-2.5h5s2.5.3 2.5-2.5v-4S17 2 12 2z"/>
      <circle cx="9" cy="6" r="1" fill={color}/>
    </svg>
  ),
  uiux: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="9" y1="21" x2="9" y2="9"/>
    </svg>
  ),
  datascience: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  product: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  marketing: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  backend: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  mobile: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
  ml: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v4"/>
      <path d="M12 18v4"/>
      <path d="M4.93 4.93l2.83 2.83"/>
      <path d="M16.24 16.24l2.83 2.83"/>
      <path d="M2 12h4"/>
      <path d="M18 12h4"/>
      <path d="M4.93 19.07l2.83-2.83"/>
      <path d="M16.24 7.76l2.83-2.83"/>
    </svg>
  ),
  writing: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z"/>
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
      <path d="M2 2l7.586 7.586"/>
      <circle cx="11" cy="11" r="2"/>
    </svg>
  ),
  video: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7"/>
      <rect x="1" y="5" width="15" height="14" rx="2"/>
    </svg>
  ),
  research: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  business: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  ),
  blockchain: (color) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="7" height="7"/>
      <rect x="16" y="4" width="7" height="7"/>
      <rect x="8.5" y="13" width="7" height="7"/>
      <line x1="4.5" y1="11" x2="8.5" y2="13"/>
      <line x1="19.5" y1="11" x2="15.5" y2="13"/>
    </svg>
  ),
}

function InterestsScreen() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(['react', 'uiux', 'product'])

  const skills = [
    { id: 'react', label: 'React' },
    { id: 'python', label: 'Python' },
    { id: 'uiux', label: 'UI/UX' },
    { id: 'datascience', label: 'Data Science' },
    { id: 'product', label: 'Product' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'backend', label: 'Backend' },
    { id: 'mobile', label: 'Mobile Dev' },
    { id: 'ml', label: 'ML/AI' },
    { id: 'writing', label: 'Writing' },
    { id: 'video', label: 'Video' },
    { id: 'research', label: 'Research' },
    { id: 'business', label: 'Business' },
    { id: 'blockchain', label: 'Web3' },
  ]

  const toggleSkill = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id))
    } else {
      setSelected([...selected, id])
    }
  }

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
          onClick={() => navigate('/search-friends')}
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
          marginTop: '32px',
          fontSize: '34px',
          fontWeight: 700,
          fontStyle: 'italic',
          color: '#5B4AE6'
        }}
      >
        Your skills
      </h1>
      
      {/* Subtitle */}
      <p 
        style={{ 
          marginTop: '8px',
          fontSize: '14px',
          lineHeight: 1.5,
          color: '#5B4AE6'
        }}
      >
        Select a few of your skills and let teams
        <br />
        know what you bring to the table.
      </p>
      
      {/* Skills Grid */}
      <div 
        style={{ 
          marginTop: '32px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px',
          flex: 1,
          overflowY: 'auto',
          paddingBottom: '16px'
        }}
      >
        {skills.map(skill => {
          const isSelected = selected.includes(skill.id)
          const color = isSelected ? 'white' : '#5B4AE6'
          const IconComponent = icons[skill.id]
          
          return (
            <button
              key={skill.id}
              onClick={() => toggleSkill(skill.id)}
              style={{
                height: '46px',
                paddingLeft: '14px',
                paddingRight: '14px',
                borderRadius: '15px',
                backgroundColor: isSelected ? '#5B4AE6' : 'transparent',
                border: isSelected ? 'none' : '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: 500,
                color: color,
                cursor: 'pointer'
              }}
            >
              {IconComponent && IconComponent(color)}
              <span>{skill.label}</span>
            </button>
          )
        })}
      </div>
      
      {/* Continue Button */}
      <button 
        onClick={() => navigate('/search-friends')}
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
          marginBottom: '24px',
          flexShrink: 0
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
    </div>
  )
}

export default InterestsScreen
