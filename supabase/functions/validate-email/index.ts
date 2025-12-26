// Supabase Edge Function: Validate .edu Email on Signup
// This function is called as an auth hook to validate emails before user creation
// Deploy this function to enforce .edu email validation at the backend level

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Check if email is a valid .edu email address
 */
function isEduEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return false
  }

  const domain = email.split('@')[1]?.toLowerCase()
  
  if (!domain) {
    return false
  }

  // Check for .edu domain (US universities)
  if (domain.endsWith('.edu')) {
    return true
  }

  // Check for international university domains
  const allowedDomains = [
    '.ac.uk',      // UK universities
    '.edu.au',     // Australian universities
    '.edu.ca',     // Canadian universities
    '.ac.za',      // South African universities
    '.edu.sg',     // Singapore universities
    '.ac.jp',      // Japanese universities
    '.edu.cn',     // Chinese universities
    '.ac.in',      // Indian universities
    '.edu.mx',     // Mexican universities
    '.edu.br',     // Brazilian universities
  ]

  return allowedDomains.some(allowed => domain.endsWith(allowed))
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // Parse the request body
    const { email, type } = await req.json()

    // Only validate on signup events
    if (type !== 'signup') {
      return new Response(
        JSON.stringify({ message: 'Validation skipped for non-signup event' }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Validate email
    if (!email) {
      return new Response(
        JSON.stringify({ 
          error: 'Email is required',
          message: 'Please provide a valid email address.'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if email is .edu
    if (!isEduEmail(email)) {
      return new Response(
        JSON.stringify({ 
          error: 'INVALID_EMAIL_DOMAIN',
          message: 'Only .edu email addresses are allowed. Please use your university email address.'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Email is valid, allow signup to proceed
    return new Response(
      JSON.stringify({ 
        message: 'Email validation passed',
        email: email,
        domain: email.split('@')[1]
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in validate-email function:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: 'An error occurred during email validation. Please try again.'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

