/**
 * Auth utilities for user authentication and profile management
 * MVP/Demo - uses localStorage for persistence
 */

const AUTH_STORAGE_KEY = 'nested_auth'
const USERS_STORAGE_KEY = 'nested_users'
const PROFILE_STORAGE_KEY = 'nested_user_profile'

/**
 * Get all registered users
 */
export function getUsers() {
  try {
    const users = localStorage.getItem(USERS_STORAGE_KEY)
    return users ? JSON.parse(users) : {}
  } catch (e) {
    return {}
  }
}

/**
 * Save users to storage
 */
function saveUsers(users) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users))
}

/**
 * Get current auth state
 */
export function getAuthState() {
  try {
    const auth = localStorage.getItem(AUTH_STORAGE_KEY)
    return auth ? JSON.parse(auth) : null
  } catch (e) {
    return null
  }
}

/**
 * Check if user is logged in
 */
export function isLoggedIn() {
  const auth = getAuthState()
  return auth && auth.isLoggedIn
}

/**
 * Get current user ID
 */
export function getCurrentUserId() {
  const auth = getAuthState()
  return auth?.userId || null
}

/**
 * Get current user data
 */
export function getCurrentUser() {
  const auth = getAuthState()
  if (!auth || !auth.userId) return null
  
  const users = getUsers()
  return users[auth.userId] || null
}

/**
 * Check if username is already taken
 */
export function isUsernameTaken(username) {
  const users = getUsers()
  return Object.values(users).some(u => u.username?.toLowerCase() === username.toLowerCase())
}

/**
 * Check if email is already registered
 */
export function isEmailRegistered(email) {
  const users = getUsers()
  return Object.values(users).some(u => u.email?.toLowerCase() === email.toLowerCase())
}

/**
 * Register a new user
 * @returns {{ success: boolean, error?: string, userId?: string }}
 */
export function registerUser({ firstName, lastName, username, email, password }) {
  // Validate email is .edu
  if (!email.toLowerCase().endsWith('.edu')) {
    return { success: false, error: 'Only .edu email addresses are allowed' }
  }

  // Check if email already exists
  if (isEmailRegistered(email)) {
    return { success: false, error: 'An account with this email already exists' }
  }

  // Check if username is taken
  if (isUsernameTaken(username)) {
    return { success: false, error: 'This username is already taken' }
  }

  // Create user
  const userId = `user_${Date.now()}`
  const users = getUsers()
  
  users[userId] = {
    id: userId,
    firstName,
    lastName,
    username,
    email: email.toLowerCase(),
    password, // In real app, this would be hashed
    createdAt: new Date().toISOString(),
    profileComplete: false
  }

  saveUsers(users)

  // Log user in
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    isLoggedIn: true,
    userId,
    email: email.toLowerCase()
  }))

  return { success: true, userId }
}

/**
 * Login user
 * @returns {{ success: boolean, error?: string, userId?: string, profileComplete?: boolean }}
 */
export function loginUser(email, password) {
  // Validate email is .edu
  if (!email.toLowerCase().endsWith('.edu')) {
    return { success: false, error: 'Only .edu email addresses are allowed' }
  }

  const users = getUsers()
  const user = Object.values(users).find(
    u => u.email?.toLowerCase() === email.toLowerCase()
  )

  if (!user) {
    return { success: false, error: 'No account found with this email' }
  }

  if (user.password !== password) {
    return { success: false, error: 'Incorrect password' }
  }

  // Log user in
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    isLoggedIn: true,
    userId: user.id,
    email: user.email
  }))

  return { 
    success: true, 
    userId: user.id,
    profileComplete: user.profileComplete 
  }
}

/**
 * Logout user
 */
export function logoutUser() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}

/**
 * Check if profile is complete (has required fields)
 */
export function isProfileComplete() {
  try {
    const profile = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (!profile) return false
    
    const data = JSON.parse(profile)
    
    // Required fields: university, interests (fields), lookingFor
    const hasUniversity = data.university && data.university.trim() !== ''
    const hasInterests = data.fields && data.fields.length > 0
    const hasLookingFor = data.lookingFor && data.lookingFor.length > 0
    
    return hasUniversity && hasInterests && hasLookingFor
  } catch (e) {
    return false
  }
}

/**
 * Mark profile as complete in user data
 */
export function markProfileComplete() {
  const auth = getAuthState()
  if (!auth?.userId) return

  const users = getUsers()
  if (users[auth.userId]) {
    users[auth.userId].profileComplete = true
    saveUsers(users)
  }
}

/**
 * Get profile data
 */
export function getProfileData() {
  try {
    const profile = localStorage.getItem(PROFILE_STORAGE_KEY)
    return profile ? JSON.parse(profile) : null
  } catch (e) {
    return null
  }
}

/**
 * Save profile data
 */
export function saveProfileData(data) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data))
  
  // Check if profile is now complete and update user record
  if (isProfileComplete()) {
    markProfileComplete()
  }
}

/**
 * Initialize demo user for testing (optional)
 */
export function initDemoUser() {
  const users = getUsers()
  
  if (!users['current-user']) {
    users['current-user'] = {
      id: 'current-user',
      firstName: 'Jordan',
      lastName: 'Demo',
      username: 'jordandemo',
      email: 'jordan@nyu.edu',
      password: 'Demo123',
      createdAt: new Date().toISOString(),
      profileComplete: true
    }
    saveUsers(users)
  }
}

/**
 * Password validation
 * - Minimum 6 characters
 * - At least 1 uppercase letter
 */
export function validatePassword(password) {
  const errors = []
  
  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters')
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least 1 uppercase letter')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Reset all auth data (for testing)
 */
export function resetAuthData() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  localStorage.removeItem(USERS_STORAGE_KEY)
  localStorage.removeItem(PROFILE_STORAGE_KEY)
}

// Expose reset function globally for testing
if (typeof window !== 'undefined') {
  window.resetAuthData = resetAuthData
  window.initDemoUser = initDemoUser
}
