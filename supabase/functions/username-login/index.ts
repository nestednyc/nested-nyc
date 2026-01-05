// Supabase Edge Function: Username or Email + Password Login
//
// Securely handles login with either:
//   - username + password, or
//   - email + password
//
// Security goals:
// - Username → email resolution happens ONLY server-side (service_role)
// - Clients never get an API to resolve username → email without a valid password
// - Error messages are generic to avoid username/email enumeration
//
// Expected environment variables:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
//
// Invoke from the client using:
//   const { data, error } = await supabase.functions.invoke('username-login', {
//     body: { identifier, password }
//   })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type LoginRequestBody = {
  identifier?: string
  password?: string
}

type LoginSuccessResponse = {
  session: {
    access_token: string
    refresh_token: string
    expires_in: number
    expires_at?: number
    token_type: string
  }
  user: unknown
}

type LoginErrorResponse = {
  error: string
  message: string
}

Deno.serve(async (req): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    let body: LoginRequestBody
    try {
      body = await req.json()
    } catch {
      const payload: LoginErrorResponse = {
        error: 'INVALID_REQUEST',
        message: 'Invalid JSON body',
      }
      return new Response(
        JSON.stringify(payload),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const identifier = (body.identifier || '').trim()
    const password = (body.password || '').trim()

    // Basic validation
    if (!identifier || !password) {
      const payload: LoginErrorResponse = {
        error: 'INVALID_INPUT',
        message: 'Please provide both identifier and password',
      }
      return new Response(
        JSON.stringify(payload),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
      const payload: LoginErrorResponse = {
        error: 'SERVER_MISCONFIGURED',
        message: 'Authentication service is not configured correctly.',
      }
      return new Response(
        JSON.stringify(payload),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Service-role client (bypasses RLS, can call restricted RPCs)
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    let email = identifier
    const isEmail = identifier.includes('@')

    // If identifier is a username, resolve it to email via RPC
    if (!isEmail) {
      const { data: resolvedEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
        p_username: identifier,
      })

      if (rpcError) {
        console.error('get_email_by_username RPC error:', rpcError)
      }

      if (rpcError || !resolvedEmail || typeof resolvedEmail !== 'string') {
        // Generic error - do not reveal whether username exists
        const payload: LoginErrorResponse = {
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password',
        }
        return new Response(
          JSON.stringify(payload),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      email = resolvedEmail
    }

    // Now perform email + password sign-in server-side
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data?.session || !data?.user) {
      if (error) {
        console.error('signInWithPassword error:', error)
      }

      const payload: LoginErrorResponse = {
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid username or password',
      }
      return new Response(
        JSON.stringify(payload),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { session, user } = data

    const payload: LoginSuccessResponse = {
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        expires_at: session.expires_at,
        token_type: session.token_type,
      },
      user,
    }

    return new Response(
      JSON.stringify(payload),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('username-login unexpected error:', err)

    const payload: LoginErrorResponse = {
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong. Please try again.',
    }

    return new Response(
      JSON.stringify(payload),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

