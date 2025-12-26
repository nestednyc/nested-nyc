import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'

/**
 * EventsScreen - Discover Events
 * Nested NYC – Student-only project network
 * 
 * Features upcoming campus events, hackathons, meetups, and workshops
 */

function EventsScreen() {
  const navigate = useNavigate()
  const [selectedFilter, setSelectedFilter] = useState('all')
  
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'hackathon', label: 'Hackathons' },
    { id: 'workshop', label: 'Workshops' },
    { id: 'meetup', label: 'Meetups' },
    { id: 'social', label: 'Social' },
  ]
  
  const events = [
    {
      id: 1,
      title: 'NYC Hackathon 2025',
      description: 'Annual inter-university hackathon. 48 hours of building.',
      date: 'Jan 15-17',
      time: '9:00 AM',
      location: 'Columbia University',
      category: 'hackathon',
      attendees: 128,
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop'
    },
    {
      id: 2,
      title: 'Design Systems Workshop',
      description: 'Learn to build scalable design systems with Figma.',
      date: 'Jan 18',
      time: '2:00 PM',
      location: 'Parsons School of Design',
      category: 'workshop',
      attendees: 45,
      image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=600&h=400&fit=crop'
    },
    {
      id: 3,
      title: 'AI/ML Meetup',
      description: 'Monthly AI/ML research discussion and networking.',
      date: 'Jan 22',
      time: '6:00 PM',
      location: 'NYU Tandon',
      category: 'meetup',
      attendees: 89,
      image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=400&fit=crop'
    },
    {
      id: 4,
      title: 'Startup Pitch Night',
      description: 'Student founders pitch to NYC investors.',
      date: 'Jan 25',
      time: '7:00 PM',
      location: 'NYU Stern',
      category: 'social',
      attendees: 156,
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=400&fit=crop'
    },
    {
      id: 5,
      title: 'React Workshop',
      description: 'Intro to React hooks and modern patterns.',
      date: 'Jan 28',
      time: '3:00 PM',
      location: 'Columbia CS Building',
      category: 'workshop',
      attendees: 32,
      image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&h=400&fit=crop'
    },
  ]
  
  const filteredEvents = selectedFilter === 'all' 
    ? events 
    : events.filter(e => e.category === selectedFilter)

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Header */}
      <div 
        style={{ 
          paddingTop: '50px',
          paddingLeft: '20px',
          paddingRight: '20px'
        }}
      >
        <h1 
          style={{ 
            margin: 0,
            fontSize: '28px',
            fontWeight: 700,
            color: '#E5385A'
          }}
        >
          Events
        </h1>
        <p 
          style={{ 
            margin: 0,
            marginTop: '4px',
            fontSize: '14px',
            color: '#ADAFBB'
          }}
        >
          Discover what's happening across NYC campuses
        </p>
      </div>
      
      {/* Filters */}
      <div 
        style={{ 
          display: 'flex',
          gap: '8px',
          paddingLeft: '20px',
          paddingRight: '20px',
          marginTop: '20px',
          overflowX: 'auto',
          paddingBottom: '4px'
        }}
      >
        {filters.map(filter => (
          <button
            key={filter.id}
            onClick={() => setSelectedFilter(filter.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              backgroundColor: selectedFilter === filter.id ? '#E5385A' : '#F5F5F5',
              color: selectedFilter === filter.id ? 'white' : '#666',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease'
            }}
          >
            {filter.label}
          </button>
        ))}
      </div>
      
      {/* Events List */}
      <div 
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          paddingBottom: '100px',
          marginTop: '16px'
        }}
      >
        {filteredEvents.map(event => (
          <div 
            key={event.id}
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid #F0F0F0',
              cursor: 'pointer'
            }}
          >
            {/* Event Image */}
            <div 
              style={{
                width: '100%',
                height: '160px',
                borderRadius: '12px',
                overflow: 'hidden',
                marginBottom: '12px'
              }}
            >
              <img 
                src={event.image}
                alt={event.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </div>
            
            {/* Event Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h3 
                  style={{ 
                    margin: 0, 
                    fontSize: '16px', 
                    fontWeight: 700, 
                    color: '#231429' 
                  }}
                >
                  {event.title}
                </h3>
                <p 
                  style={{ 
                    margin: '4px 0 0', 
                    fontSize: '13px', 
                    color: '#666',
                    lineHeight: 1.4
                  }}
                >
                  {event.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                  <span 
                    style={{ 
                      fontSize: '12px', 
                      color: '#E5385A',
                      fontWeight: 600
                    }}
                  >
                    {event.date} • {event.time}
                  </span>
                  <span style={{ fontSize: '12px', color: '#ADAFBB' }}>
                    {event.location}
                  </span>
                </div>
                <div 
                  style={{ 
                    marginTop: '8px',
                    fontSize: '11px',
                    color: '#ADAFBB'
                  }}
                >
                  {event.attendees} attending
                </div>
              </div>
              
              {/* RSVP Button */}
              <button 
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#E5385A',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  marginLeft: '12px',
                  flexShrink: 0
                }}
              >
                RSVP
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}

export default EventsScreen

