import { useNavigate } from 'react-router-dom'

/**
 * Onboarding2 - "Find Projects" Screen
 * Nested NYC – Student-only project network
 * 
 * Specs:
 * - Title: "Find Projects"
 * - Description: project discovery value prop
 * - Dot 2 is active
 * - Card images: project/team collaboration scenes
 */

function Onboarding2() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Card Stack Section - takes up top portion */}
      <div 
        className="flex items-center justify-center"
        style={{ height: '55%', paddingTop: '20px' }}
      >
        <CardStack />
      </div>
      
      {/* Content Section */}
      <div className="flex-1 flex flex-col px-10">
        {/* Title */}
        <h1 
          className="text-[28px] font-bold text-center"
          style={{ color: '#5B4AE6' }}
        >
          Find Projects
        </h1>
        
        {/* Description */}
        <p 
          className="text-[14px] text-center leading-[1.5] mt-3 px-4"
          style={{ color: '#ADAFBB' }}
        >
          Discover projects that match your skills
          <br />
          and interests across NYC campuses.
        </p>
        
        {/* Pagination Dots - 2nd active */}
        <div className="flex justify-center gap-2 mt-8">
          <div 
            style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#E5E7EB' 
            }} 
          />
          <div 
            style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#5B4AE6' 
            }} 
          />
          <div 
            style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: '#E5E7EB' 
            }} 
          />
        </div>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Next Button */}
        <button 
          onClick={() => navigate('/onboarding/3')}
          style={{
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
          Next
        </button>
        
        {/* Bottom spacing */}
        <div style={{ height: '60px' }} />
      </div>
      
      {/* Home Indicator */}
      <div className="absolute bottom-[8px] left-1/2 -translate-x-1/2">
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

/**
 * CardStack - Project collaboration images
 */
function CardStack() {
  return (
    <div 
      className="relative"
      style={{ width: '280px', height: '380px' }}
    >
      {/* Back card - Hackathon/coding scene */}
      <div 
        className="absolute overflow-hidden"
        style={{
          width: '240px',
          height: '340px',
          right: '-10px',
          top: '30px',
          transform: 'rotate(10deg)',
          borderRadius: '15px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        <img 
          src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&h=600&fit=crop"
          alt="Hackathon"
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#D4A574', objectPosition: 'center 25%' }}
        />
      </div>
      
      {/* Middle card - Team meeting */}
      <div 
        className="absolute overflow-hidden"
        style={{
          width: '240px',
          height: '340px',
          right: '10px',
          top: '15px',
          transform: 'rotate(5deg)',
          borderRadius: '15px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        <img 
          src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400&h=600&fit=crop"
          alt="Team meeting"
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#F5C89A', objectPosition: 'center 20%' }}
        />
      </div>
      
      {/* Front card - Students collaborating */}
      <div 
        className="absolute overflow-hidden"
        style={{
          width: '240px',
          height: '340px',
          left: '0px',
          top: '0px',
          borderRadius: '15px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
        }}
      >
        <img 
          src="https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400&h=600&fit=crop"
          alt="Students collaborating"
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#F8D5C4', objectPosition: 'center 15%' }}
        />
      </div>
    </div>
  )
}

export default Onboarding2
