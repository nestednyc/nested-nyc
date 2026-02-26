import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getMyProjects, getMyProjectsAsync, DEMO_CURRENT_USER_ID } from '../utils/projectData'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { profileService } from '../services/profileService'
import { getInitialsAvatar } from '../utils/avatarUtils'

/**
 * ProfileViewScreen - Public read-only profile view
 * LinkedIn/Handshake style layout
 * Route: /profile/:userId
 * No edit actions - use dropdown menu to access Edit Profile
 */

const STORAGE_KEY = 'nested_user_profile'
const CURRENT_USER_ID = 'current-user' // For demo

const LOOKING_FOR_LABELS = {
  join: { label: 'Join a project', icon: '🤝' },
  cofounder: { label: 'Co-founder', icon: '🚀' },
}

// Max projects to display on public profile
const MAX_VISIBLE_PROJECTS = 3

// Mock profiles for other users (pending request users, team members, etc.)
const MOCK_USER_PROFILES = {
  // Pending request users
  'req-1': {
    firstName: 'Jordan',
    lastName: 'Lee',
    university: 'NYU Tandon',
    bio: 'Full-stack developer passionate about building products that make a difference. Currently exploring AI/ML applications.',
    fields: ['Engineering', 'Product'],
    lookingFor: ['join'],
    skills: ['React', 'Python', 'Node.js', 'TypeScript', 'ML/AI'],
    projects: [],
    links: { github: 'github.com/jordanlee', linkedin: 'linkedin.com/in/jordanlee' },
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop'
  },
  'req-2': {
    firstName: 'Samantha',
    lastName: 'Wright',
    university: 'Columbia Engineering',
    bio: 'UI/UX designer with a background in human-computer interaction. I love creating intuitive and beautiful interfaces.',
    fields: ['Design', 'Product'],
    lookingFor: ['join', 'cofounder'],
    skills: ['Figma', 'UI/UX', 'Frontend', 'React', 'Prototyping'],
    projects: [],
    links: { portfolio: 'samanthawright.design', linkedin: 'linkedin.com/in/samwright' },
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop'
  },
  'req-3': {
    firstName: 'Alex',
    lastName: 'Chen',
    university: 'Parsons',
    bio: 'Product manager with startup experience. I bridge the gap between design, engineering, and business.',
    fields: ['Product', 'Business'],
    lookingFor: ['cofounder'],
    skills: ['Product', 'Strategy', 'Research', 'Data', 'Marketing'],
    projects: [],
    links: { linkedin: 'linkedin.com/in/alexchen' },
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop'
  },
  // Mock team members from DEFAULT_PROJECTS
  'mock-marcus': {
    firstName: 'Marcus',
    lastName: 'Chen',
    university: 'NYU',
    bio: 'Backend engineer focused on sustainability tech. Building tools to help students understand their environmental impact.',
    fields: ['Engineering', 'Sustainability'],
    lookingFor: ['join'],
    skills: ['Python', 'Node.js', 'React', 'D3.js', 'Data Viz'],
    projects: [],
    links: { github: 'github.com/marcuschen', linkedin: 'linkedin.com/in/marcuschen' },
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop'
  },
  'mock-sofia': {
    firstName: 'Sofia',
    lastName: 'Rodriguez',
    university: 'Columbia',
    bio: 'Data scientist passionate about using analytics to drive positive change. Love working on climate and sustainability projects.',
    fields: ['Data Science', 'Engineering'],
    lookingFor: ['join'],
    skills: ['Python', 'R', 'SQL', 'Machine Learning', 'Data Viz'],
    projects: [],
    links: { github: 'github.com/sofiarodriguez', linkedin: 'linkedin.com/in/sofiarodriguez' },
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop'
  },
  'mock-priya': {
    firstName: 'Priya',
    lastName: 'Sharma',
    university: 'Columbia',
    bio: 'ML engineer building AI-powered education tools. Passionate about making learning more accessible and effective.',
    fields: ['Engineering', 'ML/AI'],
    lookingFor: ['cofounder'],
    skills: ['Python', 'TensorFlow', 'PyTorch', 'NLP', 'React Native'],
    projects: [],
    links: { github: 'github.com/priyasharma', linkedin: 'linkedin.com/in/priyasharma' },
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop'
  },
  'mock-david': {
    firstName: 'David',
    lastName: 'Kim',
    university: 'Columbia',
    bio: 'Backend developer with experience in scalable systems. Love building APIs and infrastructure.',
    fields: ['Engineering'],
    lookingFor: ['join'],
    skills: ['Node.js', 'Python', 'PostgreSQL', 'AWS', 'Docker'],
    projects: [],
    links: { github: 'github.com/davidkim', linkedin: 'linkedin.com/in/davidkim' },
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop'
  },
  'mock-emma': {
    firstName: 'Emma',
    lastName: 'Wilson',
    university: 'Columbia',
    bio: 'Product designer creating delightful user experiences. Background in cognitive science and HCI.',
    fields: ['Design', 'Product'],
    lookingFor: ['join'],
    skills: ['Figma', 'UI/UX', 'User Research', 'Prototyping', 'Design Systems'],
    projects: [],
    links: { portfolio: 'emmawilson.design', linkedin: 'linkedin.com/in/emmawilson' },
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
  },
  'mock-jake': {
    firstName: 'Jake',
    lastName: 'Morrison',
    university: 'NYU',
    bio: 'Mobile developer building apps that make city life easier. Passionate about civic tech and urban mobility.',
    fields: ['Engineering', 'Product'],
    lookingFor: ['cofounder'],
    skills: ['React Native', 'Swift', 'Kotlin', 'Node.js', 'APIs'],
    projects: [],
    links: { github: 'github.com/jakemorrison', linkedin: 'linkedin.com/in/jakemorrison' },
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop'
  },
  'mock-lily': {
    firstName: 'Lily',
    lastName: 'Chen',
    university: 'Parsons',
    bio: 'Visual designer with a focus on mobile experiences. Love creating clean, intuitive interfaces.',
    fields: ['Design'],
    lookingFor: ['join'],
    skills: ['Figma', 'Sketch', 'Illustration', 'UI Design', 'Motion Design'],
    projects: [],
    links: { portfolio: 'lilychen.design', linkedin: 'linkedin.com/in/lilychen' },
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop'
  },
  'mock-aisha': {
    firstName: 'Aisha',
    lastName: 'Patel',
    university: 'Parsons',
    bio: 'Design lead passionate about community building. Creating platforms that bring students together.',
    fields: ['Design', 'Product'],
    lookingFor: ['cofounder'],
    skills: ['UI/UX', 'Figma', 'Branding', 'User Research', 'Frontend'],
    projects: [],
    links: { portfolio: 'aishapatel.design', linkedin: 'linkedin.com/in/aishapatel' },
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
  },
  'mock-tom': {
    firstName: 'Tom',
    lastName: 'Richards',
    university: 'The New School',
    bio: 'Frontend developer who loves bringing designs to life. Focused on performance and accessibility.',
    fields: ['Engineering'],
    lookingFor: ['join'],
    skills: ['React', 'TypeScript', 'CSS', 'Accessibility', 'Performance'],
    projects: [],
    links: { github: 'github.com/tomrichards', linkedin: 'linkedin.com/in/tomrichards' },
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'
  },
  'mock-nina': {
    firstName: 'Nina',
    lastName: 'Santos',
    university: 'Parsons',
    bio: 'Marketing specialist helping startups find their audience. Experience in social media and growth.',
    fields: ['Marketing', 'Business'],
    lookingFor: ['join'],
    skills: ['Social Media', 'Content Strategy', 'Analytics', 'Copywriting', 'Growth'],
    projects: [],
    links: { linkedin: 'linkedin.com/in/ninasantos' },
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop'
  },
  'mock-alex-j': {
    firstName: 'Alex',
    lastName: 'Johnson',
    university: 'Stern',
    bio: 'Business student passionate about startups and fundraising. Helping founders tell their stories.',
    fields: ['Business', 'Product'],
    lookingFor: ['cofounder'],
    skills: ['Strategy', 'Fundraising', 'Pitch Decks', 'Financial Modeling', 'Storytelling'],
    projects: [],
    links: { linkedin: 'linkedin.com/in/alexjohnson' },
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop'
  },
  'mock-maya': {
    firstName: 'Maya',
    lastName: 'Thompson',
    university: 'Tisch',
    bio: 'Audio engineer and musician building tools for remote music collaboration. Love connecting artists.',
    fields: ['Creative', 'Engineering'],
    lookingFor: ['cofounder'],
    skills: ['Audio Engineering', 'Music Production', 'React', 'WebRTC', 'UI/UX'],
    projects: [],
    links: { portfolio: 'mayathompson.music', linkedin: 'linkedin.com/in/mayathompson' },
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop'
  }
}

function ProfileViewScreen() {
  const navigate = useNavigate()
  const { userId } = useParams()
  const [profile, setProfile] = useState(null)
  const [nestedProjects, setNestedProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(userId === CURRENT_USER_ID || userId === 'me')
  const [isWideScreen, setIsWideScreen] = useState(window.innerWidth >= 768)

  useEffect(() => {
    const handleResize = () => setIsWideScreen(window.innerWidth >= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true)

      // Get the current authenticated user's ID to check if viewing own profile
      let authUserId = null
      if (isSupabaseConfigured()) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            authUserId = user.id
          }
        } catch (err) {
          console.error('Failed to get current user:', err)
        }
      }

      // Check if viewing current user (by alias OR by actual Supabase user ID)
      const isViewingOwnProfile = userId === CURRENT_USER_ID || userId === 'me' || (authUserId && userId === authUserId)
      setIsOwner(isViewingOwnProfile)

      // Check if viewing current user or another user
      if (isViewingOwnProfile) {
        // Try to fetch from Supabase first (use authUserId we already have)
        if (isSupabaseConfigured() && authUserId) {
          try {
            const { data, error } = await profileService.getProfile(authUserId)

            if (!error && data) {
              // Transform DB format to component format
              const transformedProfile = {
                firstName: data.first_name || '',
                lastName: data.last_name || '',
                university: data.university || '',
                fields: data.fields || [],
                bio: data.bio || '',
                lookingFor: data.looking_for || [],
                skills: data.skills || [],
                projects: data.projects || [],
                avatar: data.avatar || '',
                links: data.links || { github: '', portfolio: '', linkedin: '', discord: '' }
              }
              setProfile(transformedProfile)

              // Also update localStorage as cache
              localStorage.setItem(STORAGE_KEY, JSON.stringify(transformedProfile))

              setLoading(false)
              loadNestedProjects()
              return
            }
          } catch (err) {
            console.error('Failed to fetch profile from Supabase:', err)
          }
        }

        // Fall back to localStorage if Supabase fetch failed
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) setProfile(JSON.parse(saved))
        } catch (e) {}

        loadNestedProjects()
      } else {
        // Viewing another user's profile - try to fetch from Supabase first
        if (isSupabaseConfigured()) {
          try {
            const { data, error } = await profileService.getProfile(userId)

            if (!error && data) {
              // Transform DB format to component format (same as current user)
              const transformedProfile = {
                firstName: data.first_name || '',
                lastName: data.last_name || '',
                university: data.university || '',
                fields: data.fields || [],
                bio: data.bio || '',
                lookingFor: data.looking_for || [],
                skills: data.skills || [],
                projects: data.projects || [],
                avatar: data.avatar || '',
                links: data.links || { github: '', portfolio: '', linkedin: '', discord: '' }
              }
              setProfile(transformedProfile)
              // Other users don't show nested projects for now
              setNestedProjects([])
              setLoading(false)
              return
            }
          } catch (err) {
            console.error('Failed to fetch other user profile from Supabase:', err)
          }
        }

        // Fall back to mock data only if Supabase fetch failed or not configured
        const mockProfile = MOCK_USER_PROFILES[userId]
        if (mockProfile) {
          setProfile(mockProfile)
          setNestedProjects([])
        }
      }

      setLoading(false)
    }

    const loadNestedProjects = async () => {
      // Load Nested projects from Supabase (with localStorage fallback)
      let allProjects
      try {
        allProjects = await getMyProjectsAsync()
      } catch (err) {
        console.error('Error loading projects:', err)
        allProjects = getMyProjects()
      }

      // Prioritize: Owner projects first, then by joined status (active), then most recent
      const prioritized = allProjects.sort((a, b) => {
        const aIsOwner = a.isOwner || a.ownerId === DEMO_CURRENT_USER_ID ? 1 : 0
        const bIsOwner = b.isOwner || b.ownerId === DEMO_CURRENT_USER_ID ? 1 : 0
        if (bIsOwner !== aIsOwner) return bIsOwner - aIsOwner

        const aJoined = a.joined ? 1 : 0
        const bJoined = b.joined ? 1 : 0
        if (bJoined !== aJoined) return bJoined - aJoined

        const aIsUser = a.isUserProject ? 1 : 0
        const bIsUser = b.isUserProject ? 1 : 0
        return bIsUser - aIsUser
      })

      setNestedProjects(prioritized)
    }

    fetchProfile()
  }, [userId])

  // Show loading state
  if (loading) {
    return (
      <div style={{
        height: '100%',
        backgroundColor: '#F9FAFB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid #E5E7EB',
            borderTopColor: '#5B4AE6',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px'
          }} />
          <p style={{ color: '#6B7280', fontSize: '14px' }}>Loading profile...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>Profile not found</p>
      </div>
    )
  }

  const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unnamed User'
  const hasNestedProjects = nestedProjects.length > 0
  const visibleProjects = nestedProjects.slice(0, MAX_VISIBLE_PROJECTS)
  const remainingProjectsCount = nestedProjects.length - MAX_VISIBLE_PROJECTS
  const hasLinks = profile.links && Object.values(profile.links).some(v => v)

  return (
    <div style={{ height: '100%', backgroundColor: '#F9FAFB', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={() => navigate(-1)} style={{
            width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #E5E7EB',
            backgroundColor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>Profile</h1>
        </div>
        {/* Edit Profile button removed - access via dropdown menu */}
        <div />
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'grid', gridTemplateColumns: isWideScreen ? '1fr 260px' : '1fr', gap: '16px' }}>
          
          {/* MAIN COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Profile Header Card */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid #E5E7EB',
              display: 'flex',
              gap: '16px'
            }}>
              {/* Avatar */}
              <div style={{
                width: '72px', height: '72px', borderRadius: '16px', backgroundColor: '#F3F4F6',
                border: '2px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                overflow: 'hidden'
              }}>
                <img
                  src={profile.avatar || getInitialsAvatar(fullName)}
                  alt={fullName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              <div style={{ flex: 1 }}>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 700, color: '#111827' }}>{fullName}</h2>
                {profile.university && (
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6B7280' }}>
                    📍 {profile.university}
                  </p>
                )}
                {profile.fields && profile.fields.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {profile.fields.map(f => (
                      <span key={f} style={{
                        padding: '3px 8px', fontSize: '11px', fontWeight: 500, borderRadius: '10px',
                        backgroundColor: '#EEF2FF', color: '#5B4AE6'
                      }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {profile.bio && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #E5E7EB'
              }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>About</h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#374151', lineHeight: 1.5 }}>{profile.bio}</p>
              </div>
            )}

            {/* Looking For */}
            {profile.lookingFor && profile.lookingFor.length > 0 && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #E5E7EB'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Looking For</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {profile.lookingFor.map(id => {
                    const item = LOOKING_FOR_LABELS[id]
                    if (!item) return null
                    return (
                      <span key={id} style={{
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
                        backgroundColor: '#F3F4F6', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#374151'
                      }}>
                        <span>{item.icon}</span>
                        {item.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Nested Projects */}
            {hasNestedProjects && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #E5E7EB'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Nested Projects
                  </h3>
                  <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
                    {nestedProjects.length} {nestedProjects.length === 1 ? 'project' : 'projects'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {visibleProjects.map((proj, idx) => {
                    const projectIsOwner = proj.isOwner || proj.ownerId === DEMO_CURRENT_USER_ID
                    return (
                      <div 
                        key={proj.id || idx} 
                        onClick={() => navigate(`/projects/${proj.id}`)}
                        style={{
                          padding: '12px',
                          backgroundColor: '#FAFAFA',
                          borderRadius: '10px',
                          border: '1px solid #F3F4F6',
                          cursor: 'pointer',
                          transition: 'border-color 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = '#D1D5DB'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = '#F3F4F6'}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#111827' }}>{proj.title}</h4>
                          <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                            {/* Role badge */}
                            <span style={{
                              padding: '2px 8px', 
                              fontSize: '10px', 
                              fontWeight: 600, 
                              borderRadius: '6px',
                              backgroundColor: projectIsOwner ? 'rgba(5, 150, 105, 0.1)' : '#E0E7FF', 
                              color: projectIsOwner ? '#059669' : '#4338CA'
                            }}>
                              {projectIsOwner ? 'Owner' : 'Member'}
                            </span>
                            {/* Status badge */}
                            {proj.joined && (
                              <span style={{
                                padding: '2px 6px', 
                                fontSize: '10px', 
                                fontWeight: 500, 
                                borderRadius: '6px',
                                backgroundColor: 'rgba(91, 74, 230, 0.1)', 
                                color: '#5B4AE6'
                              }}>
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                        {proj.description && (
                          <p style={{ 
                            margin: 0, 
                            fontSize: '13px', 
                            color: '#6B7280', 
                            lineHeight: 1.4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical'
                          }}>
                            {proj.description}
                          </p>
                        )}
                        {proj.category && (
                          <span style={{
                            display: 'inline-block',
                            marginTop: '8px',
                            padding: '3px 8px',
                            fontSize: '10px',
                            fontWeight: 500,
                            borderRadius: '8px',
                            backgroundColor: '#F3F4F6',
                            color: '#6B7280'
                          }}>
                            {proj.category}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                
                {/* View all projects link */}
                {remainingProjectsCount > 0 && (
                  <button
                    onClick={() => navigate('/matches')}
                    style={{
                      width: '100%',
                      marginTop: '12px',
                      padding: '10px',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#5B4AE6',
                      backgroundColor: 'transparent',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'background-color 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    + {remainingProjectsCount} more {remainingProjectsCount === 1 ? 'project' : 'projects'}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* SIDEBAR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            {/* Skills */}
            {profile.skills && profile.skills.length > 0 && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #E5E7EB'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Skills</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {profile.skills.map(s => (
                    <span key={s} style={{
                      padding: '4px 8px', fontSize: '11px', fontWeight: 500, borderRadius: '10px',
                      backgroundColor: '#F3F4F6', color: '#374151'
                    }}>{s}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {hasLinks && (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: '1px solid #E5E7EB'
              }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Links</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {profile.links.github && (
                    <a href={profile.links.github.startsWith('http') ? profile.links.github : `https://${profile.links.github}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                      GitHub
                    </a>
                  )}
                  {profile.links.portfolio && (
                    <a href={profile.links.portfolio.startsWith('http') ? profile.links.portfolio : `https://${profile.links.portfolio}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                      </svg>
                      Portfolio
                    </a>
                  )}
                  {profile.links.linkedin && (
                    <a href={profile.links.linkedin.startsWith('http') ? profile.links.linkedin : `https://${profile.links.linkedin}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151', textDecoration: 'none' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      LinkedIn
                    </a>
                  )}
                  {profile.links.discord && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#374151">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                      {profile.links.discord}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Connect CTA (for non-owners) */}
            {!isOwner && (
              <button style={{
                width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600,
                backgroundColor: '#5B4AE6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer'
              }}>
                Connect
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfileViewScreen
