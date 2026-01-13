/**
 * Project Storage Utility
 * Manages user-created projects in localStorage
 */

const STORAGE_KEY = 'nested_user_projects'

/**
 * Get all user-created projects
 */
export function getProjects() {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('Error reading projects:', e)
    return []
  }
}

/**
 * Save a new project
 */
export function saveProject(project) {
  try {
    const projects = getProjects()
    projects.unshift(project) // Add to beginning
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
    return true
  } catch (e) {
    console.error('Error saving project:', e)
    return false
  }
}

/**
 * Update an existing project
 */
export function updateProject(projectId, updates) {
  try {
    const projects = getProjects()
    const index = projects.findIndex(p => p.id === projectId)
    if (index !== -1) {
      projects[index] = { ...projects[index], ...updates }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
      return true
    }
    return false
  } catch (e) {
    console.error('Error updating project:', e)
    return false
  }
}

/**
 * Delete a project
 */
export function deleteProject(projectId) {
  try {
    const projects = getProjects()
    const filtered = projects.filter(p => p.id !== projectId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
    return true
  } catch (e) {
    console.error('Error deleting project:', e)
    return false
  }
}

/**
 * Get published projects (for Discover)
 */
export function getPublishedProjects() {
  return getProjects().filter(p => p.publishToDiscover)
}

/**
 * Clear all projects (for testing)
 */
export function clearProjects() {
  localStorage.removeItem(STORAGE_KEY)
}

// Expose for testing
if (typeof window !== 'undefined') {
  window.clearProjects = clearProjects
}





