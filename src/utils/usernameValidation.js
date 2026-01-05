/**
 * Username Validation Utilities
 * 
 * Client-side validation for usernames before calling the server.
 * Instagram-style rules: letters, numbers, underscores, and periods.
 */

// Reserved usernames that cannot be claimed
// Includes common routes, brand names, and system terms
export const RESERVED_USERNAMES = [
  // Brand & App names
  'nested', 'nestednyc', 'nested_nyc', 'admin', 'administrator',
  'support', 'help', 'info', 'contact', 'team', 'staff',
  
  // Common routes
  'home', 'discover', 'events', 'matches', 'messages', 'chat',
  'profile', 'settings', 'notifications', 'search', 'explore',
  'signin', 'signup', 'login', 'logout', 'register', 'auth',
  'verify', 'confirm', 'reset', 'password', 'account',
  
  // System terms
  'api', 'app', 'web', 'www', 'mail', 'email', 'ftp', 'smtp',
  'cdn', 'static', 'assets', 'images', 'files', 'uploads',
  'null', 'undefined', 'true', 'false', 'test', 'dev', 'prod',
  
  // Social/official accounts
  'official', 'verified', 'moderator', 'mod', 'bot', 'system',
  'announcement', 'announcements', 'news', 'update', 'updates',
  
  // Universities (prevent impersonation)
  'nyu', 'columbia', 'parsons', 'cuny', 'pratt', 'fit', 'sva',
  'fordham', 'pace', 'cooperunion', 'barnard', 'juilliard',
  
  // Common problematic terms
  'root', 'sudo', 'administrator', 'webmaster', 'postmaster',
  'abuse', 'security', 'privacy', 'legal', 'copyright', 'dmca'
]

// Convert to Set for O(1) lookup
const RESERVED_SET = new Set(RESERVED_USERNAMES.map(u => u.toLowerCase()))

/**
 * Validate username format (client-side, before API call)
 * Returns null if valid, error message string if invalid
 * 
 * @param {string} username - Username to validate
 * @returns {string|null} - Error message or null if valid
 */
export function validateUsername(username) {
  // Check for null/undefined/empty
  if (!username || typeof username !== 'string') {
    return 'Please enter a username'
  }

  const trimmed = username.trim()

  // Length checks
  if (trimmed.length < 3) {
    return 'Username must be at least 3 characters'
  }
  if (trimmed.length > 30) {
    return 'Username must be 30 characters or less'
  }

  // Character validation (Instagram-style)
  // Only letters, numbers, underscores, and periods
  if (!/^[a-zA-Z0-9_.]+$/.test(trimmed)) {
    return 'Only letters, numbers, underscores and periods allowed'
  }

  // Cannot start with a period
  if (trimmed.startsWith('.')) {
    return 'Username cannot start with a period'
  }

  // Cannot end with a period
  if (trimmed.endsWith('.')) {
    return 'Username cannot end with a period'
  }

  // No consecutive periods
  if (trimmed.includes('..')) {
    return 'Username cannot have consecutive periods'
  }

  // Cannot be only numbers
  if (/^\d+$/.test(trimmed)) {
    return 'Username cannot be only numbers'
  }

  // Check reserved usernames
  if (RESERVED_SET.has(trimmed.toLowerCase())) {
    return 'This username is not available'
  }

  // All checks passed
  return null
}

/**
 * Check if username format is valid (boolean version)
 * @param {string} username - Username to validate
 * @returns {boolean}
 */
export function isValidUsernameFormat(username) {
  return validateUsername(username) === null
}

/**
 * Check if a username is reserved
 * @param {string} username - Username to check
 * @returns {boolean}
 */
export function isReservedUsername(username) {
  if (!username || typeof username !== 'string') return false
  return RESERVED_SET.has(username.trim().toLowerCase())
}

/**
 * Format username for display (lowercase)
 * @param {string} username
 * @returns {string}
 */
export function formatUsername(username) {
  if (!username || typeof username !== 'string') return ''
  return username.trim().toLowerCase()
}

export default {
  validateUsername,
  isValidUsernameFormat,
  isReservedUsername,
  formatUsername,
  RESERVED_USERNAMES
}
