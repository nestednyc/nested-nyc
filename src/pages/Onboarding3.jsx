import { useNavigate } from 'react-router-dom'

/**
 * Onboarding3 - "Join Nests" Screen
 * Nested NYC – Student-only project network
 * 
 * Specs:
 * - Title: "Join Nests"
 * - Description: community/nests value prop
 * - Dot 3 is active
 * - Button: "Get Started" instead of "Next"
 * - Has "Sign In" link below button
 * - Card images: community/group scenes
 */

function Onboarding3() {
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
          Join Nests
        </h1>
        
        {/* Description */}
        <p 
          className="text-[14px] text-center leading-[1.5] mt-3 px-4"
          style={{ color: '#ADAFBB' }}
        >
          Connect with school-based communities
          <br />
          and build your NYC student network.
        </p>
        
        {/* Pagination Dots - 3rd active */}
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
        </div>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Get Started Button */}
        <button 
          onClick={() => navigate('/auth')}
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
          Get Started
        </button>
        
        {/* Sign In Link */}
        <div style={{ height: '16px' }} />
        <button 
          onClick={() => navigate('/login')}
          style={{
            backgroundColor: 'transparent',
            color: '#5B4AE6',
            fontSize: '16px',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            padding: 0
          }}
        >
          Sign In
        </button>
        <div style={{ height: '52px' }} />
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
 * CardStack - Community/Nests images
 */
function CardStack() {
  return (
    <div 
      className="relative"
      style={{ width: '280px', height: '380px' }}
    >
      {/* Back card - Group discussion */}
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
          src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=600&fit=crop"
          alt="Group discussion"
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#F5D5C8', objectPosition: 'center 20%' }}
        />
      </div>
      
      {/* Middle card - Campus community */}
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
          src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=600&fit=crop"
          alt="Campus community"
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#E8D5B8', objectPosition: 'center 20%' }}
        />
      </div>
      
      {/* Front card - Student collaboration */}
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
          src="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=400&h=600&fit=crop"
          alt="Student collaboration"
          className="w-full h-full object-cover"
          style={{ backgroundColor: '#E5B800', objectPosition: 'center 10%' }}
        />
      </div>
    </div>
  )
}

export default Onboarding3
