/**
 * Mock Profile Data for User Profile Page
 * Nested NYC - Student-only project network
 */

// Demo current user data (enhanced profile)
export const DEMO_USER_PROFILE = {
  id: 'current-user',
  username: 'tech_founder_24',
  firstName: 'Alex',
  lastName: 'Chen',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',

  // Academic
  university: 'NYU',
  graduationYear: 2026,
  major: ['Computer Science', 'Business'],

  // Builder Profile
  bio: 'Building the future of EdTech. Full-stack dev looking for a designer co-founder. Passionate about creating products that help students learn better and connect with each other.',
  skills: ['React', 'Node.js', 'PostgreSQL', 'TypeScript', 'Python'],
  tools: ['Figma', 'Vercel', 'Supabase', 'VS Code', 'GitHub'],
  roles: ['Full Stack Engineer', 'Founder'],
  experienceLevel: 'intermediate',
  lookingFor: ['cofounder', 'designer'],
  availabilityHoursPerWeek: 15,

  // Social
  links: {
    github: 'github.com/alexchen',
    linkedin: 'linkedin.com/in/alexchen',
    portfolio: 'alexchen.dev',
    discord: 'alex#1234',
    twitter: 'alexbuilds'
  },

  // Stats
  stats: {
    projectsCreated: 2,
    projectsJoined: 1,
    eventsAttended: 4
  },

  // Settings
  openToMessages: true,
  isVerified: true,
  profileCompleteness: 85,

  // Badges
  badges: [
    { id: 'verified', name: '.edu Verified', icon: 'shield-check', color: '#059669' },
    { id: 'early-adopter', name: 'Early Adopter', icon: 'sparkles', color: '#8B5CF6' },
    { id: 'active-builder', name: 'Active Builder', icon: 'hammer', color: '#F59E0B' }
  ],

  // Activity Feed
  activity: [
    { id: 'act-1', type: 'project_created', title: 'Created StudySync', timestamp: '2 days ago' },
    { id: 'act-2', type: 'event_attended', title: 'Attended NYC Founders Meetup', timestamp: '1 week ago' },
    { id: 'act-3', type: 'project_joined', title: 'Joined Campus Connect team', timestamp: '2 weeks ago' },
    { id: 'act-4', type: 'event_attended', title: 'Attended HackNYU 2024', timestamp: '1 month ago' }
  ],

  // Pinned/Featured Project
  pinnedProjectId: 'proj-alex-1',

  // Projects
  projects: [
    {
      id: 'proj-alex-1',
      name: 'StudySync',
      description: 'AI-powered study group matching for university students. Connect with classmates who share your learning style.',
      role: 'Founder & Lead Dev',
      outcome: '500+ users',
      link: 'studysync.app',
      isActive: true,
      image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400'
    },
    {
      id: 'proj-alex-2',
      name: 'HackNYU Project',
      description: 'Built an accessibility tool for visually impaired students. Won Best Technical Implementation at HackNYU 2024.',
      role: 'Frontend Developer',
      outcome: '1st Place',
      link: null,
      isActive: false,
      image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400'
    }
  ]
}

// Mock profiles for other users (for viewing other profiles)
export const MOCK_USER_PROFILES = {
  'req-1': {
    id: 'req-1',
    username: 'jordan_dev',
    firstName: 'Jordan',
    lastName: 'Lee',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200',
    university: 'NYU Tandon',
    graduationYear: 2025,
    major: ['Computer Engineering'],
    bio: 'Full-stack developer passionate about building products that make a difference. Currently exploring AI/ML applications in healthcare.',
    skills: ['React', 'Python', 'Node.js', 'TypeScript', 'TensorFlow'],
    tools: ['VS Code', 'Docker', 'AWS', 'Figma'],
    roles: ['Full Stack Engineer'],
    experienceLevel: 'advanced',
    lookingFor: ['join'],
    availabilityHoursPerWeek: 20,
    links: {
      github: 'github.com/jordanlee',
      linkedin: 'linkedin.com/in/jordanlee',
      portfolio: 'jordanlee.dev'
    },
    stats: {
      projectsCreated: 1,
      projectsJoined: 3,
      eventsAttended: 7
    },
    openToMessages: true,
    isVerified: true,
    profileCompleteness: 92,
    badges: [
      { id: 'verified', name: '.edu Verified', icon: 'shield-check', color: '#059669' },
      { id: 'active-builder', name: 'Active Builder', icon: 'hammer', color: '#F59E0B' }
    ],
    activity: [
      { id: 'act-1', type: 'project_joined', title: 'Joined ClimateTech Dashboard', timestamp: '3 days ago' },
      { id: 'act-2', type: 'event_attended', title: 'Attended React NYC Meetup', timestamp: '1 week ago' }
    ],
    pinnedProjectId: null,
    projects: [
      {
        id: 'proj-jordan-1',
        name: 'HealthTrack AI',
        description: 'ML-powered health monitoring system for chronic disease management.',
        role: 'Lead Developer',
        outcome: 'In Development',
        link: 'healthtrack.ai',
        isActive: true
      }
    ]
  },
  'req-2': {
    id: 'req-2',
    username: 'sam_designs',
    firstName: 'Samantha',
    lastName: 'Wright',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200',
    university: 'Columbia Engineering',
    graduationYear: 2026,
    major: ['Human-Computer Interaction'],
    bio: 'UI/UX designer with a background in human-computer interaction. I love creating intuitive and beautiful interfaces that solve real problems.',
    skills: ['Figma', 'UI/UX', 'Frontend', 'React', 'Prototyping', 'User Research'],
    tools: ['Figma', 'Framer', 'Webflow', 'Notion'],
    roles: ['UI/UX Designer', 'Frontend Developer'],
    experienceLevel: 'intermediate',
    lookingFor: ['join', 'cofounder'],
    availabilityHoursPerWeek: 12,
    links: {
      portfolio: 'samanthawright.design',
      linkedin: 'linkedin.com/in/samwright',
      twitter: 'samdesigns'
    },
    stats: {
      projectsCreated: 0,
      projectsJoined: 2,
      eventsAttended: 5
    },
    openToMessages: true,
    isVerified: true,
    profileCompleteness: 78,
    badges: [
      { id: 'verified', name: '.edu Verified', icon: 'shield-check', color: '#059669' },
      { id: 'early-adopter', name: 'Early Adopter', icon: 'sparkles', color: '#8B5CF6' }
    ],
    activity: [
      { id: 'act-1', type: 'project_joined', title: 'Joined AI Study Buddy', timestamp: '5 days ago' },
      { id: 'act-2', type: 'event_attended', title: 'Attended Design Systems NYC', timestamp: '2 weeks ago' }
    ],
    pinnedProjectId: null,
    projects: []
  },
  'req-3': {
    id: 'req-3',
    username: 'alexc_pm',
    firstName: 'Alex',
    lastName: 'Martinez',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200',
    university: 'Parsons',
    graduationYear: 2025,
    major: ['Design & Technology'],
    bio: 'Product manager with startup experience. I bridge the gap between design, engineering, and business. Previously PM intern at a Series A startup.',
    skills: ['Product', 'Strategy', 'Research', 'Data Analysis', 'Marketing'],
    tools: ['Notion', 'Linear', 'Amplitude', 'Mixpanel'],
    roles: ['Product Manager'],
    experienceLevel: 'intermediate',
    lookingFor: ['cofounder'],
    availabilityHoursPerWeek: 10,
    links: {
      linkedin: 'linkedin.com/in/alexmartinez',
      twitter: 'alex_builds'
    },
    stats: {
      projectsCreated: 1,
      projectsJoined: 2,
      eventsAttended: 8
    },
    openToMessages: false,
    isVerified: true,
    profileCompleteness: 70,
    badges: [
      { id: 'verified', name: '.edu Verified', icon: 'shield-check', color: '#059669' }
    ],
    activity: [
      { id: 'act-1', type: 'project_created', title: 'Created CampusHub', timestamp: '1 week ago' },
      { id: 'act-2', type: 'event_attended', title: 'Attended Product NYC Meetup', timestamp: '3 weeks ago' }
    ],
    pinnedProjectId: 'proj-alex-m-1',
    projects: [
      {
        id: 'proj-alex-m-1',
        name: 'CampusHub',
        description: 'Centralized platform for university clubs and organizations.',
        role: 'Founder & PM',
        outcome: 'MVP Launched',
        link: 'campushub.nyc',
        isActive: true
      }
    ]
  }
}

// Looking For Labels
export const LOOKING_FOR_LABELS = {
  join: { label: 'Join a project', icon: 'users', emoji: '🤝' },
  cofounder: { label: 'Co-founder', icon: 'rocket', emoji: '🚀' },
  designer: { label: 'Designer', icon: 'palette', emoji: '🎨' },
  engineer: { label: 'Engineer', icon: 'code', emoji: '💻' },
  mentor: { label: 'Mentor', icon: 'star', emoji: '⭐' }
}

// Experience Level Labels
export const EXPERIENCE_LEVELS = {
  beginner: { label: 'Beginner', description: 'Just starting out' },
  intermediate: { label: 'Intermediate', description: '1-2 years experience' },
  advanced: { label: 'Advanced', description: '3+ years experience' }
}

// Activity Type Icons/Colors
export const ACTIVITY_TYPES = {
  project_created: { icon: 'plus', color: '#059669', label: 'Created' },
  project_joined: { icon: 'users', color: '#5B4AE6', label: 'Joined' },
  event_attended: { icon: 'calendar', color: '#F59E0B', label: 'Attended' }
}

// Skill Category Colors (for visual grouping)
export const SKILL_CATEGORIES = {
  frontend: { skills: ['React', 'Vue', 'Angular', 'HTML', 'CSS', 'JavaScript', 'TypeScript', 'Next.js'], color: '#3B82F6' },
  backend: { skills: ['Node.js', 'Python', 'Java', 'Go', 'Ruby', 'PHP', 'Express', 'Django', 'FastAPI'], color: '#10B981' },
  database: { skills: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Supabase', 'Firebase'], color: '#8B5CF6' },
  mobile: { skills: ['React Native', 'Flutter', 'Swift', 'Kotlin', 'iOS', 'Android'], color: '#EC4899' },
  devops: { skills: ['Docker', 'AWS', 'GCP', 'Kubernetes', 'CI/CD', 'Vercel', 'Netlify'], color: '#F59E0B' },
  ai: { skills: ['TensorFlow', 'PyTorch', 'ML/AI', 'NLP', 'Computer Vision', 'OpenAI'], color: '#EF4444' },
  design: { skills: ['Figma', 'UI/UX', 'Sketch', 'Adobe XD', 'Prototyping', 'User Research'], color: '#6366F1' },
  other: { skills: ['Product', 'Strategy', 'Marketing', 'Data Analysis', 'Research'], color: '#6B7280' }
}

// Get skill category color
export function getSkillColor(skill) {
  for (const [category, data] of Object.entries(SKILL_CATEGORIES)) {
    if (data.skills.some(s => s.toLowerCase() === skill.toLowerCase())) {
      return data.color
    }
  }
  return SKILL_CATEGORIES.other.color
}

// Get user profile by ID
export function getUserProfile(userId) {
  if (userId === 'current-user' || userId === 'me') {
    // Try localStorage first, fallback to demo data
    try {
      const saved = localStorage.getItem('nested_user_profile')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Merge with demo data to ensure all fields exist
        return { ...DEMO_USER_PROFILE, ...parsed }
      }
    } catch (e) {}
    return DEMO_USER_PROFILE
  }

  return MOCK_USER_PROFILES[userId] || null
}
