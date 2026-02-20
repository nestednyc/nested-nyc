/**
 * Project Data Store
 * Centralized data for all projects - both default and user-created
 */

import { getProjects, updateProject } from './projectStorage'

// Demo current user ID (for MVP/demo purposes)
export const DEMO_CURRENT_USER_ID = 'demo-user-1'

// Storage key for project edits (for default projects)
const PROJECT_EDITS_KEY = 'nested_project_edits'

/**
 * Get stored edits for all projects
 */
function getProjectEdits() {
  try {
    const data = localStorage.getItem(PROJECT_EDITS_KEY)
    return data ? JSON.parse(data) : {}
  } catch (e) {
    return {}
  }
}

/**
 * Save edits for a project (works for both user-created and default projects)
 */
export function saveProjectEdits(projectId, edits) {
  // Check if it's a user-created project
  const userProjects = getProjects()
  const userProject = userProjects.find(p => `user-${p.id}` === projectId || String(p.id) === projectId)
  
  if (userProject) {
    // Update user-created project directly
    const rawId = projectId.startsWith('user-') ? projectId.replace('user-', '') : projectId
    updateProject(parseInt(rawId) || rawId, {
      description: edits.description,
      roles: edits.skillsNeeded, // Store as roles for user projects
      commitment: edits.commitment,
    })
  } else {
    // Store edits for default projects
    const allEdits = getProjectEdits()
    allEdits[projectId] = {
      ...allEdits[projectId],
      ...edits,
      updatedAt: new Date().toISOString()
    }
    localStorage.setItem(PROJECT_EDITS_KEY, JSON.stringify(allEdits))
  }
}

/**
 * Apply stored edits to a project
 */
function applyProjectEdits(project) {
  if (!project) return project
  const edits = getProjectEdits()
  const projectEdits = edits[project.id]
  if (projectEdits) {
    return {
      ...project,
      description: projectEdits.description ?? project.description,
      skillsNeeded: projectEdits.skillsNeeded ?? project.skillsNeeded,
      commitment: projectEdits.commitment ?? project.commitment,
    }
  }
  return project
}

// Default projects data (mock data)
export const DEFAULT_PROJECTS = [
  {
    id: 'proj-1',
    title: 'ClimateTech Dashboard',
    category: 'Sustainability × Data Viz',
    schools: ['NYU', 'Columbia'],
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=800&fit=crop',
    author: 'Marcus Chen',
    authorImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    description: 'Building an interactive dashboard to visualize NYC climate data and track sustainability initiatives across campuses. We want to help students understand their environmental impact and find ways to reduce it together.',
    skillsNeeded: ['React', 'D3.js', 'Python', 'Data Viz'],
    spotsLeft: 3,
    ownerId: 'demo-user-1', // Demo: This project is owned by the current user
    team: [
      { name: 'Marcus Chen', school: 'NYU', role: 'Lead / Backend', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
      { name: 'Sofia Rodriguez', school: 'Columbia', role: 'Data Science', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop' },
    ]
  },
  {
    id: 'proj-2',
    title: 'AI Study Buddy',
    category: 'EdTech × ML',
    schools: ['Columbia'],
    image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=800&fit=crop',
    author: 'Priya Sharma',
    authorImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    description: 'An AI-powered study companion that helps students learn more effectively. Uses spaced repetition and personalized quizzes based on your course material.',
    skillsNeeded: ['Python', 'ML/AI', 'React Native', 'UI/UX'],
    spotsLeft: 2,
    team: [
      { name: 'Priya Sharma', school: 'Columbia', role: 'Lead / ML', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop' },
      { name: 'David Kim', school: 'Columbia', role: 'Backend', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop' },
      { name: 'Emma Wilson', school: 'Columbia', role: 'Design', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop' },
    ]
  },
  {
    id: 'proj-3',
    title: 'NYC Transit Tracker',
    category: 'Civic Tech × Mobile',
    schools: ['NYU', 'Parsons'],
    image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&h=800&fit=crop',
    author: 'Jake Morrison',
    authorImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    description: 'Real-time NYC subway and bus tracking with crowd-sourced delay reports. Making commutes less stressful for students traveling across the city.',
    skillsNeeded: ['React Native', 'Node.js', 'APIs', 'UI/UX'],
    spotsLeft: 4,
    team: [
      { name: 'Jake Morrison', school: 'NYU', role: 'Lead / Mobile', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop' },
      { name: 'Lily Chen', school: 'Parsons', role: 'Design', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop' },
    ]
  },
  {
    id: 'proj-4',
    title: 'Campus Events App',
    category: 'Social × React Native',
    schools: ['Parsons', 'The New School'],
    image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=600&h=800&fit=crop',
    author: 'Aisha Patel',
    authorImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    description: 'Discover events happening across NYC campuses. From hackathons to art shows, never miss what\'s happening in the student community.',
    skillsNeeded: ['React Native', 'Firebase', 'UI/UX', 'Marketing'],
    spotsLeft: 2,
    team: [
      { name: 'Aisha Patel', school: 'Parsons', role: 'Lead / Design', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop' },
      { name: 'Tom Richards', school: 'The New School', role: 'Frontend', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop' },
      { name: 'Nina Santos', school: 'Parsons', role: 'Marketing', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop' },
    ]
  },
]

// My Projects default data (saved/joined projects)
export const MY_PROJECTS_DEFAULT = [
  { 
    id: 'my-1', 
    title: 'ClimateTech Dashboard', 
    category: 'Sustainability', 
    school: 'NYU', 
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=200&h=280&fit=crop', 
    joined: true,
    schools: ['NYU'],
    description: 'Building an interactive dashboard to visualize NYC climate data.',
    skillsNeeded: ['React', 'D3.js', 'Python'],
    spotsLeft: 3,
    author: 'Marcus Chen',
    authorImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    team: [
      { name: 'Marcus Chen', school: 'NYU', role: 'Lead', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
    ]
  },
  { 
    id: 'my-2', 
    title: 'AI Study Buddy', 
    category: 'EdTech', 
    school: 'Columbia', 
    image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=200&h=280&fit=crop', 
    joined: true,
    schools: ['Columbia'],
    description: 'An AI-powered study companion for students.',
    skillsNeeded: ['Python', 'ML/AI', 'React Native'],
    spotsLeft: 2,
    author: 'Priya Sharma',
    authorImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    team: [
      { name: 'Priya Sharma', school: 'Columbia', role: 'Lead', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop' },
    ]
  },
  { 
    id: 'my-3', 
    title: 'NYC Transit App', 
    category: 'Civic Tech', 
    school: 'NYU', 
    image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=200&h=280&fit=crop', 
    joined: false,
    schools: ['NYU', 'Parsons'],
    description: 'Real-time NYC subway and bus tracking.',
    skillsNeeded: ['React Native', 'Node.js', 'APIs'],
    spotsLeft: 4,
    author: 'Jake Morrison',
    authorImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    team: [
      { name: 'Jake Morrison', school: 'NYU', role: 'Lead', image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop' },
    ]
  },
  { 
    id: 'my-4', 
    title: 'Campus Events', 
    category: 'Social', 
    school: 'Parsons', 
    image: 'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=200&h=280&fit=crop', 
    joined: true,
    schools: ['Parsons'],
    description: 'Discover events happening across NYC campuses.',
    skillsNeeded: ['React Native', 'Firebase', 'UI/UX'],
    spotsLeft: 2,
    author: 'Aisha Patel',
    authorImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    team: [
      { name: 'Aisha Patel', school: 'Parsons', role: 'Lead', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop' },
    ]
  },
]

export const SAVED_PROJECTS = [
  { 
    id: 'saved-1', 
    title: 'Startup Pitch Deck', 
    category: 'Business', 
    school: 'Stern', 
    image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=200&h=280&fit=crop',
    schools: ['Stern'],
    description: 'Building the perfect pitch deck for startup fundraising.',
    skillsNeeded: ['Design', 'Business', 'Storytelling'],
    spotsLeft: 2,
    author: 'Alex Johnson',
    authorImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    team: [
      { name: 'Alex Johnson', school: 'Stern', role: 'Lead', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop' },
    ]
  },
  { 
    id: 'saved-2', 
    title: 'Music Collab Platform', 
    category: 'Creative', 
    school: 'Tisch', 
    image: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=280&fit=crop',
    schools: ['Tisch'],
    description: 'A platform for musicians to collaborate remotely.',
    skillsNeeded: ['Audio', 'React', 'WebRTC'],
    spotsLeft: 3,
    author: 'Maya Thompson',
    authorImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop',
    team: [
      { name: 'Maya Thompson', school: 'Tisch', role: 'Lead', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop' },
    ]
  },
]

// Role display mapping
const ROLE_LABELS = {
  'frontend': 'Frontend Dev',
  'backend': 'Backend Dev',
  'fullstack': 'Full Stack',
  'designer': 'UI/UX Designer',
  'data': 'Data Science',
  'ml': 'ML/AI',
  'mobile': 'Mobile Dev',
  'pm': 'Product Manager',
  'marketing': 'Marketing',
  'business': 'Business/Strategy',
}

// Category display mapping  
const CATEGORY_LABELS = {
  'startup': 'Startup',
  'class-project': 'Class Project',
  'side-project': 'Side Project',
  'research': 'Research',
}

/**
 * Transform user-created project to standard format
 */
function transformUserProject(p) {
  return {
    id: `user-${p.id}`,
    title: p.name,
    category: CATEGORY_LABELS[p.category] || p.category,
    schools: p.university ? [p.university] : ['NYC'],
    school: p.university || 'NYC',
    image: p.image,
    author: p.author || 'You',
    authorImage: p.authorImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    description: p.description,
    skillsNeeded: p.roles?.map(r => ROLE_LABELS[r] || r).slice(0, 6) || p.skills || [],
    spotsLeft: p.roles?.length || 0,
    team: [{ 
      name: p.author || 'You', 
      school: p.university || 'NYC', 
      role: 'Project Lead', 
      image: p.authorImage || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop'
    }],
    isUserProject: true,
    isOwner: true,
    tagline: p.tagline,
    joined: true,
  }
}

/**
 * Get all projects (default + user-created)
 */
export function getAllProjects() {
  const userProjects = getProjects().map(transformUserProject)
  const defaultWithEdits = DEFAULT_PROJECTS.map(applyProjectEdits)
  return [...userProjects, ...defaultWithEdits]
}

/**
 * Get project by ID
 */
export function getProjectById(projectId) {
  if (!projectId) return null
  
  // Check user-created projects first
  const userProjects = getProjects()
  const userProject = userProjects.find(p => `user-${p.id}` === projectId || String(p.id) === projectId)
  if (userProject) {
    return transformUserProject(userProject)
  }
  
  // Check default projects (apply any stored edits)
  const defaultProject = DEFAULT_PROJECTS.find(p => p.id === projectId)
  if (defaultProject) return applyProjectEdits(defaultProject)
  
  // Check My Projects defaults (apply any stored edits)
  const myProject = MY_PROJECTS_DEFAULT.find(p => p.id === projectId)
  if (myProject) return applyProjectEdits(myProject)
  
  // Check saved projects (apply any stored edits)
  const savedProject = SAVED_PROJECTS.find(p => p.id === projectId)
  if (savedProject) return applyProjectEdits(savedProject)
  
  return null
}

/**
 * Get projects for Discover feed
 */
export function getDiscoverProjects() {
  const userProjects = getProjects()
    .filter(p => p.publishToDiscover)
    .map(transformUserProject)
  const defaultWithEdits = DEFAULT_PROJECTS.map(applyProjectEdits)
  return [...userProjects, ...defaultWithEdits]
}

/**
 * Get projects for My Projects page
 */
export function getMyProjects() {
  const userProjects = getProjects().map(transformUserProject)
  const myProjectsWithEdits = MY_PROJECTS_DEFAULT.map(applyProjectEdits)
  return [...userProjects, ...myProjectsWithEdits]
}

/**
 * Get saved projects
 */
export function getSavedProjects() {
  return SAVED_PROJECTS
}





