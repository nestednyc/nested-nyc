import { useNavigate } from 'react-router-dom'

/**
 * Onboarding1 - "Verified Students" Screen
 * Nested NYC – Student-only project network
 * 
 * Specs:
 * - Card stack in upper portion (project/team photos)
 * - Card size: ~260x360, border-radius 15px
 * - Card rotations: back ~10°, middle ~5°, front 0°
 * - Title: "Verified Students", #5B4AE6, bold, ~28px
 * - Description: gray #ADAFBB, 14px, centered
 * - Dots: 8px, gap 8px, active is #5B4AE6
 * - Button: full width, 56px height, 15px radius, #5B4AE6
 * - Home indicator at bottom
 */

function Onboarding1() {
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
          Verified Students
        </h1>
        
        {/* Description */}
        <p 
          className="text-[14px] text-center leading-[1.5] mt-3 px-4"
          style={{ color: '#ADAFBB' }}
        >
          Every member is verified with a .edu email.
          <br />
          Connect with real students building real projects.
        </p>
        
        {/* Pagination Dots */}
        <div className="flex justify-center gap-2 mt-8">
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
          onClick={() => navigate('/onboarding/2')}
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
 * CardStack - Project/Team cards for onboarding
 * 3 overlapping cards with specific rotations and positioning
 */
function CardStack() {
  return (
    <div 
      className="relative"
      style={{ width: '280px', height: '380px' }}
    >
      {/* Back card (rightmost, most rotation) - Team collaboration */}
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
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=600&fit=crop"
          alt="Team collaboration"
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#F5C842', objectPosition: 'center 20%' }}
        />
      </div>
      
      {/* Middle card (slight rotation) - Students working */}
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
          src="https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=400&h=600&fit=crop"
          alt="Students working"
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#F8D5D5', objectPosition: 'center 20%' }}
        />
      </div>
      
      {/* Front card (main, no rotation) - Project work */}
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
          src="https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=600&fit=crop"
          alt="Project work"
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#FDF5F0', objectPosition: 'center 30%' }}
        />
      </div>
    </div>
  )
}

export default Onboarding1
