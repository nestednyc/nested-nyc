import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'

/**
 * MessagesScreen - Messages with General/Nests tabs (Instagram-style)
 * Nested NYC – Student-only project network
 * 
 * Specs:
 * - Header: "Messages" title with filter icon
 * - Search bar
 * - Tab bar: General | Nests (like Instagram creator inbox)
 * - General tab: Direct messages with individuals
 * - Nests tab: Community/group chats + nest creation
 * - Bottom navigation
 */

function MessagesScreen() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('general')
  
  // Direct messages (General tab)
  const directMessages = [
    { 
      id: 1, 
      name: 'Marcus Chen', 
      message: 'Love the dashboard mockups! 🔥', 
      time: '23 min', 
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
      online: true,
      unread: false
    },
    { 
      id: 2, 
      name: 'Priya Sharma', 
      message: 'Typing...', 
      time: '27 min', 
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      online: true,
      unread: false
    },
    { 
      id: 3, 
      name: 'Jake Morrison', 
      message: 'Let\'s sync on the API tomorrow', 
      time: '33 min', 
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
      online: false,
      unread: false
    },
    { 
      id: 4, 
      name: 'Aisha Patel', 
      message: 'The repo is ready for review!', 
      time: '50 min', 
      image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      online: false,
      unread: false
    },
    { 
      id: 5, 
      name: 'Leo Kim', 
      message: 'Can we meet at the library?', 
      time: '55 min', 
      image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop',
      online: true,
      unread: false
    },
  ]
  
  // Nests (communities)
  const nests = [
    { id: 1, name: 'New', image: null, isNew: true },
    { id: 2, name: 'NYU Builders', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&h=100&fit=crop' },
    { id: 3, name: 'Columbia AI', image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=100&h=100&fit=crop' },
    { id: 4, name: 'NYC Design', image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=100&h=100&fit=crop' },
  ]
  
  // Nest group messages (Nests tab)
  const nestMessages = [
    { 
      id: 101, 
      name: 'ClimateTech Team', 
      message: 'New sprint starts Monday 🚀', 
      time: '1 hour', 
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&h=100&fit=crop',
      members: 8,
      unread: true
    },
    { 
      id: 102, 
      name: 'NYU Builders', 
      message: 'Demo day is next Friday!', 
      time: '2 hours', 
      image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=100&h=100&fit=crop',
      members: 24,
      unread: false
    },
    { 
      id: 103, 
      name: 'Columbia AI', 
      message: 'Paper review session tonight', 
      time: '3 hours', 
      image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=100&h=100&fit=crop',
      members: 15,
      unread: false
    },
    { 
      id: 104, 
      name: 'NYC Design', 
      message: 'Portfolio feedback thread 👀', 
      time: '5 hours', 
      image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=100&h=100&fit=crop',
      members: 32,
      unread: true
    },
  ]

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div 
        style={{ 
          paddingTop: '50px',
          paddingLeft: '20px',
          paddingRight: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <h1 
          style={{ 
            margin: 0,
            fontSize: '28px',
            fontWeight: 700,
            color: '#5B4AE6'
          }}
        >
          Messages
        </h1>
        
        {/* Filter Icon */}
        <button 
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '8px'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="8" y1="12" x2="20" y2="12"/>
            <line x1="4" y1="18" x2="20" y2="18"/>
            <circle cx="6" cy="6" r="2" fill="#5B4AE6"/>
            <circle cx="10" cy="12" r="2" fill="#5B4AE6"/>
            <circle cx="6" cy="18" r="2" fill="#5B4AE6"/>
          </svg>
        </button>
      </div>
      
      {/* Search Bar */}
      <div style={{ paddingLeft: '20px', paddingRight: '20px', marginTop: '20px' }}>
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#F3F3F3',
            borderRadius: '15px',
            padding: '14px 16px',
            gap: '12px'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ADAFBB" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            type="text"
            placeholder="Search"
            style={{
              flex: 1,
              border: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              fontSize: '14px',
              color: '#231429'
            }}
          />
        </div>
      </div>
      
      {/* Tab Bar - Instagram style */}
      <div 
        style={{ 
          display: 'flex',
          marginTop: '20px',
          borderBottom: '1px solid #E5E7EB'
        }}
      >
        <button
          onClick={() => setActiveTab('general')}
          style={{
            flex: 1,
            padding: '14px 0',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'general' ? '2px solid #5B4AE6' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'general' ? '#5B4AE6' : '#ADAFBB',
            transition: 'all 0.2s ease'
          }}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('nests')}
          style={{
            flex: 1,
            padding: '14px 0',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'nests' ? '2px solid #5B4AE6' : '2px solid transparent',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 'nests' ? '#5B4AE6' : '#ADAFBB',
            transition: 'all 0.2s ease'
          }}
        >
          Nests
        </button>
      </div>
      
      {/* Tab Content */}
      {activeTab === 'general' ? (
        /* General Tab - Direct Messages */
        <div 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            paddingBottom: '100px',
            marginTop: '8px'
          }}
        >
          {directMessages.map(msg => (
            <div 
              key={msg.id}
              onClick={() => navigate(`/chat/${msg.id}`)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 20px',
                cursor: 'pointer',
                gap: '12px'
              }}
            >
              {/* Avatar with online indicator */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div 
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '15px',
                    overflow: 'hidden'
                  }}
                >
                  <img 
                    src={msg.image}
                    alt={msg.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                {msg.online && (
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '0',
                      right: '0',
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: '#4CD964',
                      border: '2px solid white'
                    }}
                  />
                )}
              </div>
              
              {/* Message Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p 
                  style={{ 
                    margin: 0, 
                    fontSize: '14px', 
                    fontWeight: 700, 
                    color: '#231429' 
                  }}
                >
                  {msg.name}
                </p>
                <p 
                  style={{ 
                    margin: 0, 
                    marginTop: '4px',
                    fontSize: '14px', 
                    color: msg.unread ? '#5B4AE6' : '#ADAFBB',
                    fontWeight: msg.unread ? 600 : 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {msg.message}
                </p>
              </div>
              
              {/* Time */}
              <span 
                style={{ 
                  fontSize: '12px', 
                  color: '#ADAFBB',
                  flexShrink: 0
                }}
              >
                {msg.time}
              </span>
            </div>
          ))}
        </div>
      ) : (
        /* Nests Tab - Communities */
        <div 
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            paddingBottom: '100px'
          }}
        >
          {/* Nests Horizontal Scroll */}
          <div style={{ marginTop: '16px' }}>
            <p 
              style={{ 
                margin: 0, 
                paddingLeft: '20px',
                fontSize: '14px', 
                fontWeight: 700, 
                color: '#5B4AE6' 
              }}
            >
              Your Nests
            </p>
            <div 
              style={{ 
                display: 'flex', 
                gap: '16px', 
                overflowX: 'auto',
                paddingLeft: '20px',
                paddingRight: '20px',
                marginTop: '12px',
                paddingBottom: '8px'
              }}
            >
              {nests.map(nest => (
                <div 
                  key={nest.id}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    flexShrink: 0
                  }}
                >
                  <div 
                    style={{
                      position: 'relative',
                      width: '60px',
                      height: '60px',
                      borderRadius: '18px',
                      overflow: 'hidden',
                      border: nest.isNew ? '2px dashed #5B4AE6' : '2px solid #5B4AE6'
                    }}
                  >
                    {nest.isNew ? (
                      <div 
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'rgba(109, 93, 246, 0.1)'
                        }}
                      >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                      </div>
                    ) : (
                      <img 
                        src={nest.image}
                        alt={nest.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    )}
                  </div>
                  <span 
                    style={{ 
                      marginTop: '6px', 
                      fontSize: '12px', 
                      color: '#231429' 
                    }}
                  >
                    {nest.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Nest Group Messages */}
          <div style={{ marginTop: '16px', paddingLeft: '20px' }}>
            <p 
              style={{ 
                margin: 0, 
                fontSize: '14px', 
                fontWeight: 700, 
                color: '#5B4AE6' 
              }}
            >
              Group Chats
            </p>
          </div>
          
          <div style={{ marginTop: '12px' }}>
            {nestMessages.map(msg => (
              <div 
                key={msg.id}
                onClick={() => navigate(`/chat/${msg.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 20px',
                  cursor: 'pointer',
                  gap: '12px'
                }}
              >
                {/* Group Avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div 
                    style={{
                      width: '50px',
                      height: '50px',
                      borderRadius: '15px',
                      overflow: 'hidden'
                    }}
                  >
                    <img 
                      src={msg.image}
                      alt={msg.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  {/* Members badge */}
                  <div 
                    style={{
                      position: 'absolute',
                      bottom: '-2px',
                      right: '-2px',
                      backgroundColor: '#5B4AE6',
                      color: 'white',
                      fontSize: '10px',
                      fontWeight: 600,
                      padding: '2px 5px',
                      borderRadius: '8px',
                      border: '2px solid white'
                    }}
                  >
                    {msg.members}
                  </div>
                </div>
                
                {/* Message Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p 
                    style={{ 
                      margin: 0, 
                      fontSize: '14px', 
                      fontWeight: 700, 
                      color: '#231429' 
                    }}
                  >
                    {msg.name}
                  </p>
                  <p 
                    style={{ 
                      margin: 0, 
                      marginTop: '4px',
                      fontSize: '14px', 
                      color: msg.unread ? '#5B4AE6' : '#ADAFBB',
                      fontWeight: msg.unread ? 600 : 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {msg.message}
                  </p>
                </div>
                
                {/* Time + Unread indicator */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span 
                    style={{ 
                      fontSize: '12px', 
                      color: '#ADAFBB',
                      flexShrink: 0
                    }}
                  >
                    {msg.time}
                  </span>
                  {msg.unread && (
                    <div 
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: '#5B4AE6'
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}

export default MessagesScreen
