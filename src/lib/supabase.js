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
 * Supports both password-based and passwordless (magic link/OTP) authentication
 */
export const authService = {
  /**
   * Validate .edu email before any auth operation
   * @param {string} email - Email to validate
   * @returns {{valid: boolean, error: object|null}}
   */
  validateEduEmail(email) {
    if (!email || typeof email !== 'string' || email.trim() === '') {
      return {
        valid: false,
        error: {
          message: 'Please enter your email address',
          code: 'INVALID_EMAIL'
        }
      }
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return {
        valid: false,
        error: {
          message: 'Please enter a valid email address',
          code: 'INVALID_EMAIL_FORMAT'
        }
      }
    }

    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain || !domain.endsWith('.edu')) {
      return {
        valid: false,
        error: {
          message: 'Only .edu email addresses are allowed. Please use your university email address ending in .edu',
          code: 'INVALID_EMAIL_DOMAIN'
        }
      }
    }

    return { valid: true, error: null }
  },

  /**
   * Validate password meets minimum requirements
   * @param {string} password - Password to validate
   * @returns {{valid: boolean, error: object|null}}
   */
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return {
        valid: false,
        error: {
          message: 'Please enter a password',
          code: 'INVALID_PASSWORD'
        }
      }
    }

    if (password.length < 6) {
      return {
        valid: false,
        error: {
          message: 'Password must be at least 6 characters long',
          code: 'PASSWORD_TOO_SHORT'
        }
      }
    }

    return { valid: true, error: null }
  },

  /**
   * Check if Supabase is ready for auth operations
   * @returns {{ready: boolean, error: object|null}}
   */
  checkSupabaseReady() {
    if (!isSupabaseConfigured()) {
      return {
        ready: false,
        error: {
          message: 'Authentication service is not configured. Please contact support.',
          code: 'SUPABASE_NOT_CONFIGURED',
          developerMessage: getConfigurationError()
        }
      }
    }

    if (!supabase) {
      return {
        ready: false,
        error: {
          message: 'Authentication service is not available.',
          code: 'SUPABASE_NOT_CONFIGURED',
          developerMessage: getConfigurationError()
        }
      }
    }

    return { ready: true, error: null }
  },

  // ===========================================
  // PASSWORD-BASED AUTHENTICATION
  // ===========================================

  /**
   * Sign up a new user with email and password (only .edu emails)
   * @param {string} email - User's .edu email address
   * @param {string} password - User's chosen password
   * @returns {Promise<{data: any, error: any}>}
   */
  async signUpWithEmailPassword(email, password) {
    // Validate email first
    const emailValidation = this.validateEduEmail(email)
    if (!emailValidation.valid) {
      return { data: null, error: emailValidation.error }
    }

    // Validate password
    const passwordValidation = this.validatePassword(password)
    if (!passwordValidation.valid) {
      return { data: null, error: passwordValidation.error }
    }

    // Check Supabase is ready
    const { ready, error: configError } = this.checkSupabaseReady()
    if (!ready) {
      return { data: null, error: configError }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          data: {
            email_domain: email.split('@')[1].toLowerCase()
          }
        }
      })

      if (error) {
        return { data: null, error: this._mapSupabaseError(error) }
      }

      // Check if user needs to confirm email
      // Supabase returns user but session is null if email confirmation is required
      if (data?.user && !data?.session) {
        return {
          data: { ...data, needsEmailConfirmation: true },
          error: null
        }
      }

      return { data, error: null }
    } catch (err) {
      return { data: null, error: this._handleNetworkError(err) }
    }
  },

  /**
   * Sign in an existing user with email and password
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Promise<{data: any, error: any}>}
   */
  async signInWithEmailPassword(email, password) {
    // Validate email first
    const emailValidation = this.validateEduEmail(email)
    if (!emailValidation.valid) {
      return { data: null, error: emailValidation.error }
    }

    // Basic password check (not empty)
    if (!password || password.trim() === '') {
      return {
        data: null,
        error: {
          message: 'Please enter your password',
          code: 'INVALID_PASSWORD'
        }
      }
    }

    // Check Supabase is ready
    const { ready, error: configError } = this.checkSupabaseReady()
    if (!ready) {
      return { data: null, error: configError }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        return { data: null, error: this._mapSupabaseError(error) }
      }

      return { data, error: null }
    } catch (err) {
      return { data: null, error: this._handleNetworkError(err) }
    }
  },

  // ===========================================
  // MAGIC LINK / OTP AUTHENTICATION
  // ===========================================

  /**
   * Send magic link / OTP code for passwordless sign in (only .edu emails)
   * Uses Supabase signInWithOtp which sends both a magic link AND a 6-digit code
   * @param {string} email - User's email address
   * @returns {Promise<{data: any, error: any}>}
   */
  async sendMagicLink(email) {
    // Validate .edu email FIRST before any Supabase call
    const validation = this.validateEduEmail(email)
    if (!validation.valid) {
      return { data: null, error: validation.error }
    }

    // Check Supabase is ready
    const { ready, error: configError } = this.checkSupabaseReady()
    if (!ready) {
      return { data: null, error: configError }
    }

    try {
      // signInWithOtp sends both a magic link AND an OTP code
      // The user can either click the link or enter the 6-digit code
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // Magic link redirects to /auth/confirm for token exchange
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          shouldCreateUser: true,
          data: {
            email_domain: email.split('@')[1].toLowerCase()
          }
        }
      })

      if (error) {
        return { data: null, error: this._mapSupabaseError(error) }
      }

      return { data, error: null }
    } catch (err) {
      return { data: null, error: this._handleNetworkError(err) }
    }
  },

  /**
   * Alias for sendMagicLink - clarifies this is for sign-in
   * @param {string} email - User's email address
   * @returns {Promise<{data: any, error: any}>}
   */
  async sendSignInMagicLink(email) {
    return this.sendMagicLink(email)
  },

  /**
   * Verify OTP code (6-digit code from email)
   * @param {string} email - User's email
   * @param {string} token - 6-digit OTP token
   * @returns {Promise<{data: any, error: any}>}
   */
  async verifyOtp(email, token) {
    const { ready, error: configError } = this.checkSupabaseReady()
    if (!ready) {
      return { data: null, error: configError }
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email'
      })

      if (error) {
        return {
          data: null,
          error: {
            message: error.message.includes('expired') 
              ? 'Verification code has expired. Please request a new one.'
              : 'Invalid verification code. Please try again.',
            code: 'VERIFICATION_ERROR',
            originalError: error
          }
        }
      }

      return { data, error: null }
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
   * Verify magic link token hash (when user clicks link in email)
   * @param {string} tokenHash - Token hash from URL
   * @param {string} type - Token type (usually 'email' or 'magiclink')
   * @returns {Promise<{data: any, error: any}>}
   */
  async verifyTokenHash(tokenHash, type = 'email') {
    const { ready, error: configError } = this.checkSupabaseReady()
    if (!ready) {
      return { data: null, error: configError }
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type
      })

      if (error) {
        return {
          data: null,
          error: {
            message: error.message.includes('expired')
              ? 'This link has expired. Please request a new one.'
              : 'Invalid or expired link. Please request a new one.',
            code: 'VERIFICATION_ERROR',
            originalError: error
          }
        }
      }

      return { data, error: null }
    } catch (err) {
      return {
        data: null,
        error: {
          message: 'Failed to verify link. Please try again.',
          code: 'VERIFICATION_ERROR'
        }
      }
    }
  },

  // ===========================================
  // SESSION MANAGEMENT
  // ===========================================

  /**
   * Get current session
   * @returns {Promise<{data: any, error: any}>}
   */
  async getSession() {
    const { ready, error: configError } = this.checkSupabaseReady()
    if (!ready) {
      return { data: null, error: configError }
    }

    const { data, error } = await supabase.auth.getSession()
    return { data, error }
  },

  /**
   * Get current user (validates JWT with server)
   * @returns {Promise<{data: any, error: any}>}
   */
  async getUser() {
    const { ready, error: configError } = this.checkSupabaseReady()
    if (!ready) {
      return { data: null, error: configError }
    }

    const { data, error } = await supabase.auth.getUser()
    return { data, error }
  },

  /**
   * Subscribe to auth state changes
   * @param {Function} callback - Called with (event, session) on auth changes
   * @returns {Object} Subscription object with unsubscribe method
   */
  onAuthStateChange(callback) {
    if (!isSupabaseConfigured() || !supabase) {
      console.warn('Auth state listener not set up - Supabase not configured')
      return { data: { subscription: { unsubscribe: () => {} } } }
    }

    return supabase.auth.onAuthStateChange(callback)
  },

  /**
   * Sign out
   * @returns {Promise<{error: any}>}
   */
  async signOut() {
    const { ready, error: configError } = this.checkSupabaseReady()
    if (!ready) {
      return { error: configError }
    }

    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // ===========================================
  // INTERNAL HELPERS
  // ===========================================

  /**
   * Map Supabase errors to user-friendly messages
   * @private
   */
  _mapSupabaseError(error) {
    const msg = error?.message?.toLowerCase() || ''

    // Email/domain errors
    if (msg.includes('domain') || msg.includes('.edu')) {
      return {
        message: 'Only .edu email addresses are allowed. Please use your university email.',
        code: 'INVALID_EMAIL_DOMAIN'
      }
    }

    // Already registered
    if (msg.includes('already registered') || msg.includes('user already')) {
      return {
        message: 'This email is already registered. Please sign in instead.',
        code: 'USER_EXISTS'
      }
    }

    // Invalid credentials (wrong password or user not found)
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      return {
        message: 'Invalid email or password. Please check your credentials and try again.',
        code: 'INVALID_CREDENTIALS'
      }
    }

    // User not found
    if (msg.includes('user not found') || msg.includes('no user')) {
      return {
        message: 'No account found with this email. Please sign up first.',
        code: 'USER_NOT_FOUND'
      }
    }

    // Email not confirmed
    if (msg.includes('email not confirmed')) {
      return {
        message: 'Please verify your email address before signing in. Check your inbox for a confirmation link.',
        code: 'EMAIL_NOT_CONFIRMED'
      }
    }

    // Rate limiting
    if (msg.includes('rate limit') || msg.includes('too many')) {
      return {
        message: 'Too many attempts. Please wait a moment and try again.',
        code: 'RATE_LIMITED'
      }
    }

    // Network errors
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
      return {
        message: 'Unable to connect to authentication service. Please check your internet connection.',
        code: 'NETWORK_ERROR'
      }
    }

    // Default: return original message
    return {
      message: error.message || 'An unexpected error occurred. Please try again.',
      code: 'UNKNOWN_ERROR',
      originalError: error
    }
  },

  /**
   * Handle network/fetch errors
   * @private
   */
  _handleNetworkError(err) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      return {
        message: 'Unable to connect to authentication service. Please check your internet connection.',
        code: 'NETWORK_ERROR',
        originalError: err
      }
    }

    console.error('Auth error:', err)
    return {
      message: err.message || 'An unexpected error occurred. Please try again.',
      code: 'UNKNOWN_ERROR',
      originalError: err
    }
  }
}

/**
 * Get a user-friendly error message
 * @param {any} error - Error object from Supabase or validation
 * @returns {string}
 */
export function getErrorMessage(error) {
  if (!error) return 'An unexpected error occurred'

  // Handle our custom validation errors
  if (error.code === 'INVALID_EMAIL_DOMAIN' || error.code === 'INVALID_EMAIL' || error.code === 'INVALID_EMAIL_FORMAT') {
    return error.message || 'Only .edu email addresses are allowed. Please use your university email.'
  }

  // Handle password errors
  if (error.code === 'INVALID_PASSWORD' || error.code === 'PASSWORD_TOO_SHORT') {
    return error.message || 'Please enter a valid password.'
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

  // Handle credential errors
  if (error.code === 'INVALID_CREDENTIALS' || error.code === 'USER_NOT_FOUND') {
    return error.message || 'Invalid email or password.'
  }

  // Handle user exists error
  if (error.code === 'USER_EXISTS') {
    return error.message || 'This email is already registered. Please sign in instead.'
  }

  // Handle email confirmation
  if (error.code === 'EMAIL_NOT_CONFIRMED') {
    return error.message || 'Please verify your email address before signing in.'
  }

  // Handle rate limiting
  if (error.code === 'RATE_LIMITED') {
    return error.message || 'Too many attempts. Please wait a moment and try again.'
  }

  // Handle verification errors
  if (error.code === 'VERIFICATION_ERROR') {
    return error.message || 'Verification failed. Please try again.'
  }

  // Handle Supabase errors with message property
  if (error.message) {
    // Map common Supabase errors to user-friendly messages
    const msg = error.message.toLowerCase()
    
    if (msg.includes('user already registered') || msg.includes('already registered')) {
      return 'This email is already registered. Please sign in instead.'
    }
    if (msg.includes('invalid email')) {
      return 'Please enter a valid email address.'
    }
    if (msg.includes('email rate limit') || msg.includes('rate limit')) {
      return 'Too many requests. Please wait a moment and try again.'
    }
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
      return 'Unable to connect to authentication service. Please check your internet connection and ensure Supabase is properly configured.'
    }
    if (msg.includes('invalid login credentials')) {
      return 'Invalid email or password. Please check your credentials and try again.'
    }
    return error.message
  }

  return 'An unexpected error occurred. Please try again.'
}
