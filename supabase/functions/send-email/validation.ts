/**
 * Validation utilities for secure email sending
 * - Input sanitization
 * - Redirect URL validation
 * - Email validation
 */

// Allowlist of valid redirect URL patterns
// Add your production domains here
const ALLOWED_REDIRECT_PATTERNS = [
  /^https:\/\/nested\.social(\/.*)?$/,
  /^https:\/\/.*\.nested\.social(\/.*)?$/,
  /^https:\/\/.*\.vercel\.app(\/.*)?$/,  // For preview deployments
  /^http:\/\/localhost:\d+(\/.*)?$/,      // Local development
  /^http:\/\/127\.0\.0\.1:\d+(\/.*)?$/,   // Local development
];

/**
 * Sanitize user input to prevent XSS in email clients
 * Escapes HTML special characters
 */
export function sanitizeHtml(input: string | undefined | null): string {
  if (!input) return '';
  
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate redirect URL against allowlist
 * Prevents open redirect vulnerabilities
 */
export function isValidRedirectUrl(url: string | undefined | null): boolean {
  if (!url) {
    return true; // Empty redirect is OK, will use default
  }
  
  try {
    // Parse the URL to ensure it's valid
    const parsed = new URL(url);
    
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    
    // Check against allowlist patterns
    return ALLOWED_REDIRECT_PATTERNS.some(pattern => pattern.test(url));
  } catch {
    return false;
  }
}

/**
 * Get safe redirect URL (returns hardcoded default if invalid)
 * Both primary URL and fallback are validated against allowlist
 * to prevent open redirect vulnerabilities
 */
export function getSafeRedirectUrl(
  url: string | undefined | null, 
  fallbackUrl?: string | undefined | null
): string {
  // Hardcoded safe default - never trust external input as ultimate fallback
  const SAFE_DEFAULT = 'https://nested.social';
  
  // First, try the primary URL (validated)
  if (isValidRedirectUrl(url) && url) {
    return url;
  }
  
  // Second, try the fallback URL (also must be validated!)
  if (isValidRedirectUrl(fallbackUrl) && fallbackUrl) {
    return fallbackUrl;
  }
  
  // If both fail validation, return hardcoded safe default
  return SAFE_DEFAULT;
}

/**
 * Validate the email action type
 */
export type EmailActionType = 
  | 'signup' 
  | 'recovery' 
  | 'magiclink' 
  | 'invite' 
  | 'email_change' 
  | 'reauthentication';

const VALID_EMAIL_ACTIONS: EmailActionType[] = [
  'signup',
  'recovery', 
  'magiclink',
  'invite',
  'email_change',
  'reauthentication'
];

export function isValidEmailAction(action: string): action is EmailActionType {
  return VALID_EMAIL_ACTIONS.includes(action as EmailActionType);
}

/**
 * Rate limit configuration per email type
 */
export const RATE_LIMITS: Record<string, number> = {
  'auth_signup': 5,        // 5 signup emails per hour
  'auth_recovery': 5,      // 5 password reset emails per hour
  'auth_magiclink': 10,    // 10 magic links per hour
  'auth_invite': 10,       // 10 invites per hour
  'auth_email_change': 3,  // 3 email change requests per hour
  'transactional': 20,     // 20 transactional emails per hour
  'default': 10,           // Default rate limit
};

export function getRateLimit(emailType: string): number {
  return RATE_LIMITS[emailType] ?? RATE_LIMITS['default'];
}
