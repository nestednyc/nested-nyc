import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * ProfileScreen - Profile Details
 * Nested NYC – Student-only project network
 * 
 * Features:
 * - Type-ahead university search (inline dropdown)
 * - All overlays use position: absolute (stays in phone frame)
 */

const NYC_SCHOOLS = [
  'NYU',
  'Columbia University',
  'Parsons School of Design',
  'The New School',
  'Fordham University',
  'CUNY',
  'Pratt Institute',
  'FIT',
  'SVA',
  'Pace University',
  'Cooper Union',
  'Barnard College',
  'The Juilliard School',
  'SUNY',
  'St. John\'s University',
  'Hofstra University',
  'LIU Brooklyn',
  'Baruch College',
  'Hunter College',
  'Brooklyn College',
]

function ProfileScreen() {
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [schoolQuery, setSchoolQuery] = useState('')
  const [selectedSchool, setSelectedSchool] = useState(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  // Filter schools based on query
  const filteredSchools = schoolQuery.length > 0
    ? NYC_SCHOOLS.filter(school => 
        school.toLowerCase().includes(schoolQuery.toLowerCase())
      )
    : NYC_SCHOOLS

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown) return
    
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex(prev => 
        prev < filteredSchools.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(prev => prev > 0 ? prev - 1 : 0)
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault()
      selectSchool(filteredSchools[focusedIndex])
    } else if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  const selectSchool = (school) => {
    setSelectedSchool(school)
    setSchoolQuery(school)
    setShowDropdown(false)
    setFocusedIndex(-1)
  }

  const canContinue = firstName.trim() && lastName.trim() && selectedSchool

  return (
    <div 
      className="flex flex-col h-full bg-white relative"
      style={{ paddingLeft: '32px', paddingRight: '32px' }}
    >
      {/* Header */}
      <div 
        style={{ 
          paddingTop: '48px',
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
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            border: '1px solid #E5E7EB',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <svg width="10" height="16" viewBox="0 0 12 20" fill="none">
            <path 
              d="M10 2L2 10L10 18" 
              stroke="#5B4AE6" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </button>
        
        {/* Progress */}
        <div style={{ display: 'flex', gap: '5px' }}>
          {[1, 2, 3, 4].map((step) => (
            <div 
              key={step}
              style={{
                width: step === 1 ? '18px' : '6px',
                height: '6px',
                borderRadius: '3px',
                backgroundColor: step === 1 ? '#5B4AE6' : '#E5E7EB'
              }}
            />
          ))}
        </div>
        
        {/* Skip */}
        <button 
          onClick={() => navigate('/major')}
          style={{
            fontSize: '15px',
            fontWeight: 600,
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
          marginTop: '28px',
          fontSize: '26px',
          fontWeight: 700,
          color: '#231429',
          flexShrink: 0
        }}
      >
        Your profile
      </h1>
      
      {/* Profile Photo */}
      <div 
        style={{ 
          marginTop: '24px',
          display: 'flex',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <div style={{ position: 'relative' }}>
          <div 
            style={{
              width: '88px',
              height: '88px',
              borderRadius: '24px',
              overflow: 'hidden',
              backgroundColor: '#F5F5F5',
              border: '2px solid #E5E7EB'
            }}
          >
            <div 
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ADAFBB" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
          </div>
          {/* Add Photo Button */}
          <button 
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#5B4AE6',
              border: '2px solid white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(109, 93, 246, 0.15)'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
      
      {/* Form Fields */}
      <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '14px', flexShrink: 0 }}>
        {/* First Name */}
        <div>
          <label 
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ADAFBB',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            First name
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Enter your first name"
            style={{
              width: '100%',
              height: '50px',
              paddingLeft: '14px',
              paddingRight: '14px',
              borderRadius: '12px',
              border: '1.5px solid #E5E7EB',
              fontSize: '15px',
              color: '#231429',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s ease'
            }}
            onFocus={(e) => e.target.style.borderColor = '#5B4AE6'}
            onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
          />
        </div>
        
        {/* Last Name */}
        <div>
          <label 
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ADAFBB',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Last name
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Enter your last name"
            style={{
              width: '100%',
              height: '50px',
              paddingLeft: '14px',
              paddingRight: '14px',
              borderRadius: '12px',
              border: '1.5px solid #E5E7EB',
              fontSize: '15px',
              color: '#231429',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s ease'
            }}
            onFocus={(e) => e.target.style.borderColor = '#5B4AE6'}
            onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
          />
        </div>
        
        {/* University - Type-ahead */}
        <div style={{ position: 'relative' }}>
          <label 
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 600,
              color: '#ADAFBB',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            University
          </label>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              type="text"
              value={schoolQuery}
              onChange={(e) => {
                setSchoolQuery(e.target.value)
                setSelectedSchool(null)
                setShowDropdown(true)
                setFocusedIndex(-1)
              }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={handleKeyDown}
              placeholder="Type to search..."
              style={{
                width: '100%',
                height: '50px',
                paddingLeft: '14px',
                paddingRight: '40px',
                borderRadius: '12px',
                border: selectedSchool ? '1.5px solid #5B4AE6' : '1.5px solid #E5E7EB',
                backgroundColor: selectedSchool ? 'rgba(109, 93, 246, 0.04)' : 'white',
                fontSize: '15px',
                color: '#231429',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'all 0.2s ease'
              }}
            />
            {/* Search/Check Icon */}
            <div 
              style={{
                position: 'absolute',
                right: '14px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}
            >
              {selectedSchool ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path 
                    d="M5 12L10 17L19 8" 
                    stroke="#5B4AE6" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ADAFBB" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              )}
            </div>
          </div>
          
          {/* Dropdown */}
          {showDropdown && filteredSchools.length > 0 && (
            <div 
              ref={dropdownRef}
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: '4px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #E5E7EB',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                maxHeight: '180px',
                overflowY: 'auto',
                zIndex: 50
              }}
            >
              {filteredSchools.slice(0, 6).map((school, index) => (
                <button
                  key={school}
                  onClick={() => selectSchool(school)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    backgroundColor: focusedIndex === index ? '#FAFAFA' : 'transparent',
                    border: 'none',
                    borderBottom: index < filteredSchools.slice(0, 6).length - 1 ? '1px solid #F0F0F0' : 'none',
                    textAlign: 'left',
                    fontSize: '14px',
                    color: '#231429',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                  <span>{school}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      
      {/* Continue Button */}
      <button 
        onClick={() => canContinue && navigate('/major')}
        style={{
          width: '100%',
          height: '52px',
          backgroundColor: canContinue ? '#5B4AE6' : '#E5E7EB',
          color: canContinue ? 'white' : '#ADAFBB',
          fontSize: '16px',
          fontWeight: 600,
          borderRadius: '14px',
          border: 'none',
          cursor: canContinue ? 'pointer' : 'not-allowed',
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
    </div>
  )
}

export default ProfileScreen
