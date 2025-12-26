/**
 * Email validation utilities for university email addresses
 */

/**
 * Check if email is a valid .edu email address
 * STRICT: Only allows .edu domains (US universities)
 * @param {string} email - Email address to validate
 * @returns {boolean}
 */
export function isEduEmail(email) {
  if (!email || typeof email !== 'string') {
    return false
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return false
  }

  const domain = email.split('@')[1]?.toLowerCase()
  
  // STRICT: Only allow .edu domain (US universities)
  // This ensures only .edu emails pass validation
  return domain && domain.endsWith('.edu')
}

/**
 * Validate email format (basic check)
 * @param {string} email - Email address to validate
 * @returns {boolean}
 */
export function isValidEmailFormat(email) {
  if (!email || typeof email !== 'string') {
    return false
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Get email domain
 * @param {string} email - Email address
 * @returns {string|null}
 */
export function getEmailDomain(email) {
  if (!email || typeof email !== 'string') {
    return null
  }
  const parts = email.split('@')
  return parts.length === 2 ? parts[1].toLowerCase() : null
}

/**
 * Get validation error message
 * Provides clear, specific error messages for invalid emails
 * @param {string} email - Email address
 * @returns {string|null} - Error message or null if valid
 */
export function getEmailValidationError(email) {
  if (!email || email.trim() === '') {
    return 'Please enter your email address'
  }

  if (!isValidEmailFormat(email)) {
    return 'Please enter a valid email address'
  }

  // Check if it's a .edu email
  if (!isEduEmail(email)) {
    const domain = email.split('@')[1]?.toLowerCase()
    if (domain) {
      return `Only .edu email addresses are allowed. "${domain}" is not a valid university domain. Please use your university email address ending in .edu`
    }
    return 'Only .edu email addresses are allowed. Please use your university email address ending in .edu'
  }

  return null
}


