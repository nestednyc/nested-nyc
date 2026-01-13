import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Configuration
 * 
 * Vite Environment Variables:
 * - Must be prefixed with VITE_ to be exposed to the client
 * - Read using import.meta.env.VITE_*
 * - For local: Create .env file in project root
 * - For production (Vercel): Set in Vercel dashboard → Environment Variables
 * 
 * Get your credentials from: https://app.supabase.com/project/_/settings/api
 */

// Read environment variables (Vite automatically loads .env files)
// In production, these come from Vercel environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Validate if Supabase is properly configured
 * Checks for:
 * - Variables are defined (not undefined)
 * - Variables are not empty strings
 * - Variables don't contain placeholder values
 * @returns {boolean}
 */
const isSupabaseConfigured = () => {
  // Check if variables exist and are not undefined
  if (!supabaseUrl || !supabaseAnonKey) {
    return false
  }

  // Check if variables are not empty strings
  if (supabaseUrl.trim() === '' || supabaseAnonKey.trim() === '') {
    return false
  }

  // Check if variables don't contain placeholder values
  if (
    supabaseUrl.includes('your-project') ||
    supabaseAnonKey.includes('your-anon-key') ||
    supabaseUrl.includes('placeholder') ||
    supabaseAnonKey.includes('placeholder')
  ) {
    return false
  }

  // Validate URL format (should be a valid Supabase URL)
  try {
    const url = new URL(supabaseUrl)
    if (!url.hostname.includes('supabase.co')) {
      return false
    }
  } catch {
    return false
  }

  return true
}

/**
 * Get developer-friendly error message for missing configuration
 * @returns {string}
 */
const getConfigurationError = () => {
  const missing = []
  
  if (!supabaseUrl || supabaseUrl.trim() === '' || supabaseUrl.includes('your-project')) {
    missing.push('VITE_SUPABASE_URL')
  }
  
  if (!supabaseAnonKey || supabaseAnonKey.trim() === '' || supabaseAnonKey.includes('your-anon-key')) {
    missing.push('VITE_SUPABASE_ANON_KEY')
  }

  if (missing.length > 0) {
    return `Missing required environment variables: ${missing.join(', ')}. ` +
           `Please create a .env file in the project root with these variables, or set them in your deployment platform (e.g., Vercel). ` +
           `See .env.example for the expected format.`
  }

  return 'Supabase configuration is invalid. Please check your environment variables.'
}

// Create Supabase client - only initialize if configured, otherwise create a safe placeholder
let supabase = null

if (isSupabaseConfigured()) {
  try {
    // Only create client if properly configured
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })
    
    // Log success in development only
    if (import.meta.env.DEV) {
      console.log('✅ Supabase client initialized successfully')
    }
  } catch (error) {
    // Log error but don't crash - app can still run without Supabase
    console.error('❌ Failed to initialize Supabase client:', error)
    console.error('Error details:', {
      url: supabaseUrl ? 'Set' : 'Missing',
      key: supabaseAnonKey ? 'Set' : 'Missing',
      error: error.message
    })
  }
} else {
  // Not configured - log helpful message for developers
  if (import.meta.env.DEV) {
    console.warn('⚠️  Supabase is not configured')
    console.warn(getConfigurationError())
    console.warn('📝 To fix:')
    console.warn('   1. Copy .env.example to .env: cp .env.example .env')
    console.warn('   2. Add your Supabase credentials to .env')
    console.warn('   3. Restart the dev server: npm run dev')
    console.warn('   4. Get credentials from: https://app.supabase.com/project/_/settings/api')
  }
  
  // Create a safe placeholder client that won't crash but will fail gracefully
  // This allows the app to run without Supabase configured
  try {
    supabase = createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    })
  } catch (error) {
    // If even placeholder fails, create a minimal mock
    console.error('Failed to create placeholder Supabase client:', error)
  }
}

export { supabase, isSupabaseConfigured, getConfigurationError }

/**
 * Auth service with .edu email enforcement
 */
export const authService = {
  /**
   * Sign up with email (only .edu emails allowed)
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Promise<{data: any, error: any}>}
   */
  async signUp(email, password) {
    // CRITICAL: Validate .edu email FIRST before any Supabase call
    if (!email || typeof email !== 'string' || email.trim() === '') {
      return {
        data: null,
        error: {
          message: 'Please enter your email address',
          code: 'INVALID_EMAIL_DOMAIN'
        }
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        data: null,
        error: {
          message: 'Please enter a valid email address',
          code: 'INVALID_EMAIL_DOMAIN'
        }
      }
    }

    // Validate .edu domain - STRICT validation before Supabase
    const domain = email.split('@')[1]?.toLowerCase()
    const isEduDomain = domain && domain.endsWith('.edu')
    
    if (!isEduDomain) {
      // Return error immediately - DO NOT call Supabase
      return {
        data: null,
        error: {
          message: 'Only .edu email addresses are allowed. Please use your university email address ending in .edu',
          code: 'INVALID_EMAIL_DOMAIN'
        }
      }
    }

    // Only proceed to Supabase if validation passes
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/verify`,
          data: {
            email_domain: email.split('@')[1] // Store domain for verification
          }
        }
      })

      if (error) {
        // Check if error is due to email domain (if Supabase hook is set up)
        if (error.message.includes('domain') || error.message.includes('.edu')) {
          return {
            data: null,
            error: {
              message: 'Only .edu email addresses are allowed. Please use your university email.',
              code: 'INVALID_EMAIL_DOMAIN'
            }
          }
        }
        return { data: null, error }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: {
          message: 'An error occurred during sign up. Please try again.',
          code: 'SIGNUP_ERROR'
        }
      }
    }
  },

  /**
   * Send magic link for passwordless sign in (only .edu emails)
   * @param {string} email - User's email address
   * @returns {Promise<{data: any, error: any}>}
   */
  async sendMagicLink(email) {
    // CRITICAL: Validate .edu email FIRST before any Supabase call
    // This ensures Supabase auth is NEVER triggered for invalid emails
    if (!email || typeof email !== 'string' || email.trim() === '') {
      return {
        data: null,
        error: {
          message: 'Please enter your email address',
          code: 'INVALID_EMAIL_DOMAIN'
        }
      }
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        data: null,
        error: {
          message: 'Please enter a valid email address',
          code: 'INVALID_EMAIL_DOMAIN'
        }
      }
    }

    // Validate .edu domain - STRICT validation before Supabase
    const domain = email.split('@')[1]?.toLowerCase()
    const isEduDomain = domain && domain.endsWith('.edu')
    
    if (!isEduDomain) {
      // Return error immediately - DO NOT call Supabase
      return {
        data: null,
        error: {
          message: 'Only .edu email addresses are allowed. Please use your university email address ending in .edu',
          code: 'INVALID_EMAIL_DOMAIN'
        }
      }
    }

    // Check if Supabase is configured (only after validation passes)
    if (!isSupabaseConfigured()) {
      const configError = getConfigurationError()
      return {
        data: null,
        error: {
          message: configError,
          code: 'SUPABASE_NOT_CONFIGURED',
          developerMessage: configError
        }
      }
    }

    // Ensure supabase client exists before making API calls
    if (!supabase) {
      return {
        data: null,
        error: {
          message: 'Authentication service is not available. Please configure Supabase environment variables.',
          code: 'SUPABASE_NOT_CONFIGURED',
          developerMessage: getConfigurationError()
        }
      }
    }

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/verify`,
          data: {
            email_domain: email.split('@')[1]
          }
        }
      })

      if (error) {
        // Handle network errors
        if (error.message?.includes('fetch') || error.message?.includes('network') || error.message?.includes('Failed')) {
          return {
            data: null,
            error: {
              message: 'Unable to connect to authentication service. Please check your internet connection and ensure Supabase is properly configured.',
              code: 'NETWORK_ERROR',
              originalError: error
            }
          }
        }

        if (error.message.includes('domain') || error.message.includes('.edu')) {
          return {
            data: null,
            error: {
              message: 'Only .edu email addresses are allowed. Please use your university email.',
              code: 'INVALID_EMAIL_DOMAIN'
            }
          }
        }
        return { data: null, error }
      }

      return { data, error: null }
    } catch (err) {
      // Handle network/fetch errors
      if (err instanceof TypeError && err.message.includes('fetch')) {
        return {
          data: null,
          error: {
            message: 'Unable to connect to authentication service. Please check your internet connection and ensure Supabase credentials are correct.',
            code: 'NETWORK_ERROR',
            originalError: err
          }
        }
      }

      // Log error for debugging
      console.error('Error sending magic link:', err)
      
      return {
        data: null,
        error: {
          message: err.message || 'An error occurred. Please try again.',
          code: 'MAGIC_LINK_ERROR',
          originalError: err
        }
      }
    }
  },

  /**
   * Verify OTP code
   * @param {string} email - User's email
   * @param {string} token - OTP token
   * @returns {Promise<{data: any, error: any}>}
   */
  async verifyOtp(email, token) {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        data: null,
        error: {
          message: 'Authentication service is not configured.',
          code: 'SUPABASE_NOT_CONFIGURED',
          developerMessage: getConfigurationError()
        }
      }
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      })

      return { data, error }
    } catch (err) {
      return {
        data: null,
        error: {
          message: 'Invalid verification code. Please try again.',
          code: 'VERIFICATION_ERROR'
        }
      }
    }
  },

  /**
   * Get current session
   * @returns {Promise<{data: any, error: any}>}
   */
  async getSession() {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        data: null,
        error: {
          message: 'Authentication service is not configured.',
          code: 'SUPABASE_NOT_CONFIGURED'
        }
      }
    }

    const { data, error } = await supabase.auth.getSession()
    return { data, error }
  },

  /**
   * Sign out
   * @returns {Promise<{error: any}>}
   */
  async signOut() {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        error: {
          message: 'Authentication service is not configured.',
          code: 'SUPABASE_NOT_CONFIGURED'
        }
      }
    }

    const { error } = await supabase.auth.signOut()
    return { error }
  }
}

/**
 * Check if email is a valid .edu email address
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
  
  // Check for .edu domain
  if (domain && domain.endsWith('.edu')) {
    return true
  }

  // Also allow common international university domains
  // You can customize this list based on your needs
  const allowedDomains = [
    '.ac.uk', // UK universities
    '.edu.au', // Australian universities
    '.edu.ca', // Canadian universities
    '.ac.za', // South African universities
  ]

  return allowedDomains.some(allowed => domain?.endsWith(allowed))
}

/**
 * Get a user-friendly error message
 * @param {any} error - Error object from Supabase or validation
 * @returns {string}
 */
export function getErrorMessage(error) {
  if (!error) return 'An unexpected error occurred'

  // Handle our custom validation errors
  if (error.code === 'INVALID_EMAIL_DOMAIN') {
    return error.message || 'Only .edu email addresses are allowed. Please use your university email.'
  }

  // Handle Supabase configuration errors
  if (error.code === 'SUPABASE_NOT_CONFIGURED') {
    // In development, show detailed error. In production, show user-friendly message.
    if (import.meta.env.DEV && error.developerMessage) {
      return error.developerMessage
    }
    return error.message || 'Authentication service is not configured. Please contact support.'
  }

  // Handle network errors
  if (error.code === 'NETWORK_ERROR') {
    return error.message || 'Unable to connect to authentication service. Please check your internet connection.'
  }

  // Handle Supabase errors
  if (error.message) {
    // Map common Supabase errors to user-friendly messages
    if (error.message.includes('User already registered') || error.message.includes('already registered')) {
      return 'This email is already registered. Please sign in instead.'
    }
    if (error.message.includes('Invalid email')) {
      return 'Please enter a valid email address.'
    }
    if (error.message.includes('Email rate limit') || error.message.includes('rate limit')) {
      return 'Too many requests. Please wait a moment and try again.'
    }
    if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Failed to fetch')) {
      return 'Unable to connect to authentication service. Please check your internet connection and ensure Supabase is properly configured.'
    }
    return error.message
  }

  return 'An unexpected error occurred. Please try again.'
}


