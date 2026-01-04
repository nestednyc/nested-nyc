/**
 * Secure Email Sending Edge Function
 * 
 * Handles both:
 * 1. Auth emails (signup, recovery, magic link) - via Supabase Auth Hook
 * 2. Transactional emails (notifications, etc.) - via direct API call
 * 
 * Security features:
 * - Webhook signature verification for auth hooks
 * - JWT verification for transactional emails
 * - Rate limiting per user/IP
 * - Input sanitization
 * - Redirect URL validation
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

import { 
  isValidEmail, 
  isValidEmailAction, 
  getRateLimit,
  type EmailActionType 
} from './validation.ts';
import { getEmailTemplate, getTransactionalTemplate, type TransactionalEmailData } from './templates.ts';

// Types for Resend API
interface ResendEmailRequest {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
}

interface ResendResponse {
  id?: string;
  error?: {
    message: string;
    name: string;
  };
}

// Auth hook payload types
interface AuthHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: Record<string, unknown>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
    // For email_change events
    new_email?: string;
    email?: string;  // Old email (alias for user.email in email_change context)
  };
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * Send email via Resend API
 */
async function sendViaResend(emailData: ResendEmailRequest): Promise<ResendResponse> {
  const apiKey = Deno.env.get('RESEND_API_KEY') || Deno.env.get('ation');
  
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(emailData),
  });

  const result = await response.json();
  
  if (!response.ok) {
    throw new Error(result.error?.message || 'Failed to send email');
  }

  return result;
}

/**
 * Check rate limit using database
 */
async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  identifier: string,
  emailType: string
): Promise<boolean> {
  const maxPerHour = getRateLimit(emailType);
  
  const { data, error } = await supabase.rpc('check_email_rate_limit', {
    p_identifier: identifier,
    p_email_type: emailType,
    p_max_per_hour: maxPerHour,
  });

  if (error) {
    console.error('Rate limit check error:', error);
    // Fail open but log - you might want to fail closed in production
    return true;
  }

  return data === true;
}

/**
 * Record email send for rate limiting
 */
async function recordEmailSend(
  supabase: ReturnType<typeof createClient>,
  identifier: string,
  emailType: string,
  recipientEmail: string
): Promise<void> {
  const { error } = await supabase.rpc('record_email_send', {
    p_identifier: identifier,
    p_email_type: emailType,
    p_recipient_email: recipientEmail,
  });

  if (error) {
    console.error('Failed to record email send:', error);
    // Non-fatal - continue anyway
  }
}

/**
 * Handle Auth Hook request (from Supabase Auth)
 */
async function handleAuthHook(
  req: Request,
  supabase: ReturnType<typeof createClient>
): Promise<Response> {
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');
  
  if (!hookSecret) {
    console.error('SEND_EMAIL_HOOK_SECRET not configured');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get the raw payload for signature verification
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  // Verify webhook signature
  let hookData: AuthHookPayload;
  try {
    const secret = hookSecret.replace('v1,whsec_', '');
    const wh = new Webhook(secret);
    hookData = wh.verify(payload, headers) as AuthHookPayload;
  } catch (error) {
    console.error('Webhook verification failed:', error);
    return new Response(
      JSON.stringify({ error: 'Invalid webhook signature' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const { user, email_data } = hookData;

  // Validate email
  if (!isValidEmail(user.email)) {
    console.error('Invalid email address:', user.email);
    return new Response(
      JSON.stringify({ error: 'Invalid email address' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate action type
  if (!isValidEmailAction(email_data.email_action_type)) {
    console.error('Invalid email action type:', email_data.email_action_type);
    return new Response(
      JSON.stringify({ error: 'Invalid email action type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const actionType = email_data.email_action_type as EmailActionType;
  const emailType = `auth_${actionType}`;

  // Check rate limit
  const withinLimit = await checkRateLimit(supabase, user.id, emailType);
  if (!withinLimit) {
    console.warn('Rate limit exceeded for user:', user.id);
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get email template
  const template = getEmailTemplate(actionType, {
    token: email_data.token,
    tokenHash: email_data.token_hash,
    redirectTo: email_data.redirect_to,
    siteUrl: email_data.site_url,
    email: user.email,
    // For email_change events, pass the new email address
    newEmail: email_data.new_email,
  });

  // Send email via Resend
  try {
    const result = await sendViaResend({
      from: 'Nested <hi@nested.social>',
      to: [user.email],
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    // Record successful send for rate limiting
    await recordEmailSend(supabase, user.id, emailType, user.email);

    console.log('Email sent successfully:', result.id);
    
    // Auth hooks expect empty success response
    return new Response(
      JSON.stringify({}),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Failed to send email:', error);
    return new Response(
      JSON.stringify({ 
        error: {
          http_code: 500,
          message: 'Failed to send email'
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle Transactional email request (from your app)
 */
async function handleTransactionalEmail(
  req: Request,
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<Response> {
  let body: TransactionalEmailData & { to: string };
  
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate recipient email
  if (!body.to || !isValidEmail(body.to)) {
    return new Response(
      JSON.stringify({ error: 'Valid recipient email required' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check rate limit
  const withinLimit = await checkRateLimit(supabase, userId, 'transactional');
  if (!withinLimit) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Get template
  const template = getTransactionalTemplate(body);

  // Send email
  try {
    const result = await sendViaResend({
      from: 'Nested <hi@nested.social>',
      to: [body.to],
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    // Record send
    await recordEmailSend(supabase, userId, 'transactional', body.to);

    return new Response(
      JSON.stringify({ success: true, id: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Failed to send transactional email:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Main handler
 */
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create Supabase client with service role for database operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  // Check if this is an auth hook request (has webhook signature headers)
  const webhookId = req.headers.get('webhook-id');
  const webhookTimestamp = req.headers.get('webhook-timestamp');
  const webhookSignature = req.headers.get('webhook-signature');

  if (webhookId && webhookTimestamp && webhookSignature) {
    // This is an auth hook request
    return handleAuthHook(req, supabase);
  }

  // For transactional emails, verify JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authorization required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Verify the user's JWT
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Handle transactional email
  return handleTransactionalEmail(req, supabase, user.id);
});
