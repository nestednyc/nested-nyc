import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import DesktopNav from './DesktopNav'

/**
 * ChatDesktopLayout - Three-column layout for chat on desktop
 * 
 * Desktop (≥1024px):
 * - Left: Conversation list
 * - Center: Active chat
 * - Right: Profile/project context (optional)
 * 
 * Tablet (768-1023px):
 * - Two columns: List + Chat
 * 
 * Mobile (<768px):
 * - Single column (handled by existing mobile layout)
 */

function ChatDesktopLayout({ children, conversations = [], activeConversation = null }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const [showContext, setShowContext] = useState(true)
  
  // Sample conversations for the sidebar
  const sampleConversations = conversations.length > 0 ? conversations : [
    { 
      id: '1', 
      name: 'Marcus Chen', 
      message: 'Love the dashboard mockups! 🔥', 
      time: '23 min', 
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
      online: true,
      unread: false
    },
    { 
      id: '2', 
      name: 'Priya Sharma', 
      message: 'Typing...', 
      time: '27 min', 
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
      online: true,
      unread: true
    },
    { 
      id: '3', 
      name: 'ClimateTech Team', 
      message: 'New sprint starts Monday 🚀', 
      time: '1 hour', 
      image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&h=100&fit=crop',
      online: false,
      unread: false,
      isGroup: true,
      members: 8
    },
    { 
      id: '4', 
      name: 'Jake Morrison', 
      message: 'Let\'s sync on the API tomorrow', 
      time: '2 hours', 
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
      online: false,
      unread: false
    },
  ]

  return (
    <div className="chat-desktop-layout">
      <DesktopNav />
      
      <div className="chat-container">
        {/* Left: Conversation List */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2>Messages</h2>
            <button className="chat-new-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
          
          <div className="chat-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ADAFBB" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" placeholder="Search messages..." />
          </div>
          
          <div className="chat-list">
            {sampleConversations.map(conv => (
              <div 
                key={conv.id}
                className={`chat-list-item ${id === conv.id ? 'active' : ''}`}
                onClick={() => navigate(`/chat/${conv.id}`)}
              >
                <div className="chat-avatar">
                  <img src={conv.image} alt={conv.name} />
                  {conv.online && <span className="chat-online-dot" />}
                  {conv.isGroup && (
                    <span className="chat-group-badge">{conv.members}</span>
                  )}
                </div>
                <div className="chat-list-content">
                  <div className="chat-list-header">
                    <span className="chat-list-name">{conv.name}</span>
                    <span className="chat-list-time">{conv.time}</span>
                  </div>
                  <p className={`chat-list-message ${conv.unread ? 'unread' : ''}`}>
                    {conv.message}
                  </p>
                </div>
                {conv.unread && <span className="chat-unread-dot" />}
              </div>
            ))}
          </div>
        </div>
        
        {/* Center: Active Chat */}
        <div className="chat-main">
          {children}
        </div>
        
        {/* Right: Context Panel (optional) */}
        {showContext && activeConversation && (
          <div className="chat-context">
            <button 
              className="chat-context-close"
              onClick={() => setShowContext(false)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            
            <div className="chat-context-profile">
              <img 
                src={activeConversation.image || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop'} 
                alt={activeConversation.name || 'User'} 
              />
              <h3>{activeConversation.name || 'User Name'}</h3>
              <p>{activeConversation.school || 'NYU'} • {activeConversation.role || 'Developer'}</p>
            </div>
            
            <div className="chat-context-section">
              <h4>Shared Projects</h4>
              <div className="chat-context-projects">
                <div className="chat-context-project">
                  <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&h=100&fit=crop" alt="" />
                  <span>ClimateTech Dashboard</span>
                </div>
              </div>
            </div>
            
            <div className="chat-context-section">
              <h4>Skills</h4>
              <div className="chat-context-skills">
                <span className="chat-skill-tag">React</span>
                <span className="chat-skill-tag">Node.js</span>
                <span className="chat-skill-tag">Python</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ChatDesktopLayout

