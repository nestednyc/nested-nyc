/**
 * Supabase Diagnostics Utility
 * Helps diagnose connection and configuration issues
 */

import { supabase, isSupabaseConfigured } from './supabase'

/**
 * Test Supabase connection and configuration
 * @returns {Promise<{success: boolean, issues: string[], details: any}>}
 */
export async function diagnoseSupabaseConnection() {
  const issues = []
  const details = {}

  // Check 1: Environment variables
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  details.envVars = {
    url: supabaseUrl ? 'Set' : 'Missing',
    key: supabaseAnonKey ? 'Set' : 'Missing',
    urlValue: supabaseUrl ? (supabaseUrl.includes('your-project') ? 'Placeholder value' : 'Valid') : 'Not set',
    keyValue: supabaseAnonKey ? (supabaseAnonKey.includes('your-anon-key') ? 'Placeholder value' : 'Valid') : 'Not set'
  }

  if (!supabaseUrl || supabaseUrl.includes('your-project')) {
    issues.push('VITE_SUPABASE_URL is missing or contains placeholder value')
  }

  if (!supabaseAnonKey || supabaseAnonKey.includes('your-anon-key')) {
    issues.push('VITE_SUPABASE_ANON_KEY is missing or contains placeholder value')
  }

  // Check 2: Supabase client initialization
  if (!isSupabaseConfigured()) {
    issues.push('Supabase client is not properly configured')
    return {
      success: false,
      issues,
      details,
      message: 'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    }
  }

  // Check 3: Network connectivity
  try {
    const testUrl = `${supabaseUrl}/rest/v1/`
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    })
    
    details.networkTest = {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    }

    if (!response.ok && response.status !== 401) {
      issues.push(`Network test failed with status ${response.status}`)
    }
  } catch (error) {
    issues.push(`Network connectivity issue: ${error.message}`)
    details.networkError = {
      message: error.message,
      type: error.constructor.name
    }
  }

  // Check 4: Auth endpoint accessibility
  try {
    const authUrl = `${supabaseUrl}/auth/v1/health`
    const response = await fetch(authUrl, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey
      }
    })
    
    details.authTest = {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    }
  } catch (error) {
    issues.push(`Auth endpoint test failed: ${error.message}`)
    details.authError = {
      message: error.message,
      type: error.constructor.name
    }
  }

  // Check 5: Try to get session (this will fail if not authenticated, but should not throw network error)
  try {
    const { data, error } = await supabase.auth.getSession()
    details.sessionTest = {
      hasSession: !!data?.session,
      error: error ? error.message : null
    }
  } catch (error) {
    issues.push(`Session test failed: ${error.message}`)
    details.sessionError = {
      message: error.message,
      type: error.constructor.name
    }
  }

  return {
    success: issues.length === 0,
    issues,
    details,
    message: issues.length === 0 
      ? 'Supabase connection is working correctly'
      : `Found ${issues.length} issue(s): ${issues.join(', ')}`
  }
}

/**
 * Log diagnostic information to console
 */
export async function logSupabaseDiagnostics() {
  console.group('🔍 Supabase Diagnostics')
  const result = await diagnoseSupabaseConnection()
  
  console.log('Configuration Status:', result.success ? '✅ OK' : '❌ Issues Found')
  console.log('Details:', result.details)
  
  if (result.issues.length > 0) {
    console.warn('Issues:', result.issues)
  }
  
  console.log('Message:', result.message)
  console.groupEnd()
  
  return result
}

