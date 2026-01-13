import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * PhoneScreen - "My mobile" Screen
 * EXACT Figma Copy
 * 
 * Precise measurements:
 * - Screen padding: 40px horizontal
 * - Top padding: 130px
 * - Title: "My mobile", 34px bold, #5B4AE6, left-aligned
 * - Title-desc gap: 10px
 * - Description: 14px, #5B4AE6, line-height 1.5
 * - Input margin-top: 40px
 * - Input height: 58px, border-radius 15px, border #E5E7EB
 * - Country selector: flag + code + chevron, separated by border-right
 * - Button margin-top: 48px
 * - Button: 56px height, 15px radius, #5B4AE6 bg
 * - Home indicator: 134x5px black, 8px from bottom
 */

function PhoneScreen() {
  const navigate = useNavigate()
  const [phoneNumber, setPhoneNumber] = useState('82385 77723')

  return (
    <div 
      className="flex flex-col h-full bg-white relative"
      style={{ paddingLeft: '40px', paddingRight: '40px' }}
    >
      {/* Header Section */}
      <div style={{ paddingTop: '130px' }}>
        {/* Title */}
        <h1 
          style={{ 
            fontSize: '34px',
            fontWeight: 700,
            color: '#5B4AE6',
            margin: 0,
            letterSpacing: 'normal',
            wordSpacing: 'normal'
          }}
        >
          My mobile
        </h1>
        
        {/* Description */}
        <p 
          style={{ 
            margin: 0,
            marginTop: '10px',
            fontSize: '14px',
            lineHeight: 1.5,
            color: '#5B4AE6'
          }}
        >
          Please enter your valid phone number. We will
          <br />
          send you a 4-digit code to verify your account.
        </p>
      </div>
      
      {/* Phone Input */}
      <div style={{ marginTop: '40px' }}>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            height: '58px',
            borderRadius: '15px',
            border: '1px solid #E5E7EB',
            overflow: 'hidden'
          }}
        >
          {/* Country Code Selector */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              paddingLeft: '16px',
              paddingRight: '16px',
              height: '100%',
              borderRight: '1px solid #E5E7EB'
            }}
          >
            <span style={{ fontSize: '20px' }}>🇺🇸</span>
            <span style={{ fontSize: '14px', color: '#231429' }}>(+1)</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path 
                d="M2.5 4.5L6 8L9.5 4.5" 
                stroke="#231429" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </div>
          
          {/* Phone Number Input */}
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            style={{
              flex: 1,
              height: '100%',
              paddingLeft: '16px',
              paddingRight: '16px',
              fontSize: '14px',
              color: '#231429',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent'
            }}
          />
        </div>
      </div>
      
      {/* Continue Button */}
      <button 
        onClick={() => navigate('/verify')}
        style={{
          marginTop: '48px',
          width: '100%',
          height: '56px',
          backgroundColor: '#5B4AE6',
          color: 'white',
          fontSize: '16px',
          fontWeight: 700,
          borderRadius: '15px',
          border: 'none',
          cursor: 'pointer'
        }}
      >
        Continue
      </button>
      
      {/* Spacer */}
      <div style={{ flex: 1 }} />
      
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

export default PhoneScreen
