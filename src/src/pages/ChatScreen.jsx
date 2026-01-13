import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

/**
 * ChatScreen - Project/Nest Chat Conversation
 * Nested NYC – Student-only project network
 * 
 * Specs:
 * - Header: Back button, avatar, name, online status, menu icon
 * - Messages: Bubbles with different colors for sent/received
 * - Timestamps for message groups
 * - Input field with attachment and send buttons
 */

function ChatScreen() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [message, setMessage] = useState('')
  
  const contact = {
    name: 'Marcus Chen',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    online: true
  }
  
  const messages = [
    { id: 1, text: "Hey! I saw your ClimateTech project on Nested – the data viz looks amazing 🔥", time: '2:55 PM', sent: false },
    { id: 2, text: "Thanks! We're still looking for a frontend dev if you're interested? We meet at Bobst on Thursdays", time: '3:02 PM', sent: true },
    { id: 3, text: "I'm totally down! I've been working on React + D3 stuff at Columbia", time: '3:10 PM', sent: false },
    { id: 4, text: "Perfect. I'll add you to the repo and our Discord. See you Thursday! 🚀", time: '3:12 PM', sent: true },
  ]

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div 
        style={{ 
          paddingTop: '50px',
          paddingLeft: '16px',
          paddingRight: '16px',
          paddingBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: '1px solid #E5E7EB'
        }}
      >
        {/* Back Button */}
        <button 
          onClick={() => navigate(-1)}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '15px',
            border: '1px solid #E5E7EB',
            backgroundColor: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0
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
        
        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div 
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '15px',
              overflow: 'hidden'
            }}
          >
            <img 
              src={contact.image}
              alt={contact.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          {contact.online && (
            <div 
              style={{
                position: 'absolute',
                bottom: '0',
                right: '0',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#4CD964',
                border: '2px solid white'
              }}
            />
          )}
        </div>
        
        {/* Name & Status */}
        <div style={{ flex: 1 }}>
          <p 
            style={{ 
              margin: 0, 
              fontSize: '18px', 
              fontWeight: 700, 
              color: '#231429' 
            }}
          >
            {contact.name}
          </p>
          <p 
            style={{ 
              margin: 0, 
              marginTop: '2px',
              fontSize: '12px', 
              color: contact.online ? '#4CD964' : '#ADAFBB'
            }}
          >
            {contact.online ? 'Online' : 'Offline'}
          </p>
        </div>
        
        {/* Menu Icon */}
        <button 
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px'
          }}
        >
          <svg width="4" height="18" viewBox="0 0 4 18" fill="#231429">
            <circle cx="2" cy="2" r="2"/>
            <circle cx="2" cy="9" r="2"/>
            <circle cx="2" cy="16" r="2"/>
          </svg>
        </button>
      </div>
      
      {/* Messages */}
      <div 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '20px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {messages.map((msg, index) => (
          <div key={msg.id}>
            {/* Show timestamp before first message or when time changes */}
            {(index === 0 || messages[index - 1].time !== msg.time) && (
              <p 
                style={{ 
                  textAlign: 'center', 
                  fontSize: '12px', 
                  color: '#ADAFBB',
                  marginBottom: '12px'
                }}
              >
                {msg.time}
              </p>
            )}
            
            <div 
              style={{
                display: 'flex',
                justifyContent: msg.sent ? 'flex-end' : 'flex-start'
              }}
            >
              <div 
                style={{
                  maxWidth: '75%',
                  padding: '14px 16px',
                  borderRadius: msg.sent 
                    ? '15px 15px 0 15px' 
                    : '15px 15px 15px 0',
                  backgroundColor: msg.sent ? '#5B4AE6' : '#F3F3F3',
                  color: msg.sent ? 'white' : '#231429',
                  fontSize: '14px',
                  lineHeight: 1.5
                }}
              >
                {msg.text}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Input Area */}
      <div 
        style={{ 
          padding: '12px 16px 24px 16px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        {/* Input Field */}
        <div 
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#F3F3F3',
            borderRadius: '15px',
            padding: '12px 16px',
            gap: '12px'
          }}
        >
          <input 
            type="text"
            placeholder="Message…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: '14px',
              color: '#231429'
            }}
          />
          
          {/* Attachment Icon */}
          <button 
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ADAFBB" strokeWidth="2">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
        </div>
        
        {/* Send Button */}
        <button 
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '15px',
            backgroundColor: '#5B4AE6',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
          </svg>
        </button>
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

export default ChatScreen

