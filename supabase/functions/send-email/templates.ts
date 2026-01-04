/**
 * Email templates for Nested
 * All user data should be passed through sanitizeHtml before use
 */

import { sanitizeHtml, getSafeRedirectUrl, type EmailActionType } from './validation.ts';

interface EmailTemplateData {
  token?: string;
  tokenHash?: string;
  redirectTo?: string;
  siteUrl?: string;
  email?: string;
  newEmail?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// Base styles for emails
const baseStyles = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
  .container { background: #ffffff; border-radius: 8px; padding: 40px; border: 1px solid #e0e0e0; }
  .header { text-align: center; margin-bottom: 30px; }
  .logo { font-size: 28px; font-weight: bold; color: #000; }
  h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 20px; }
  p { color: #4a4a4a; margin-bottom: 16px; }
  .button { display: inline-block; background: #000; color: #fff !important; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; margin: 20px 0; }
  .button:hover { background: #333; }
  .code { font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #000; background: #f5f5f5; padding: 16px 24px; border-radius: 8px; display: inline-block; margin: 16px 0; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #999; text-align: center; }
  .warning { color: #666; font-size: 13px; }
`;

function wrapHtml(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nested</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">nested</div>
    </div>
    ${content}
    <div class="footer">
      <p>© ${new Date().getFullYear()} Nested. All rights reserved.</p>
      <p class="warning">If you didn't request this email, you can safely ignore it.</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate confirmation URL for auth actions
 */
function generateConfirmUrl(
  tokenHash: string,
  type: string,
  redirectTo: string,
  siteUrl: string
): string {
  const safeRedirect = getSafeRedirectUrl(redirectTo, siteUrl);
  // Use your Supabase project URL
  const baseUrl = Deno.env.get('SUPABASE_URL') || 'https://upaphmckhicnavihsaam.supabase.co';
  return `${baseUrl}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(type)}&redirect_to=${encodeURIComponent(safeRedirect)}`;
}

/**
 * Signup confirmation email
 */
function signupTemplate(data: EmailTemplateData): EmailTemplate {
  const confirmUrl = generateConfirmUrl(
    data.tokenHash || '',
    'signup',
    data.redirectTo || '',
    data.siteUrl || ''
  );

  return {
    subject: 'Confirm your Nested account',
    html: wrapHtml(`
      <h1>Welcome to Nested! 🎓</h1>
      <p>Thanks for signing up. Please confirm your email address to get started.</p>
      <p style="text-align: center;">
        <a href="${confirmUrl}" class="button">Confirm Email</a>
      </p>
      <p class="warning">This link expires in 24 hours.</p>
    `),
    text: `Welcome to Nested!\n\nConfirm your email: ${confirmUrl}\n\nThis link expires in 24 hours.`
  };
}

/**
 * Password recovery email
 */
function recoveryTemplate(data: EmailTemplateData): EmailTemplate {
  const confirmUrl = generateConfirmUrl(
    data.tokenHash || '',
    'recovery',
    data.redirectTo || '',
    data.siteUrl || ''
  );

  return {
    subject: 'Reset your Nested password',
    html: wrapHtml(`
      <h1>Reset your password</h1>
      <p>We received a request to reset your password. Click the button below to choose a new one.</p>
      <p style="text-align: center;">
        <a href="${confirmUrl}" class="button">Reset Password</a>
      </p>
      <p class="warning">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `),
    text: `Reset your Nested password\n\nClick here: ${confirmUrl}\n\nThis link expires in 1 hour.`
  };
}

/**
 * Magic link email
 */
function magiclinkTemplate(data: EmailTemplateData): EmailTemplate {
  const confirmUrl = generateConfirmUrl(
    data.tokenHash || '',
    'magiclink',
    data.redirectTo || '',
    data.siteUrl || ''
  );

  return {
    subject: 'Your Nested login link',
    html: wrapHtml(`
      <h1>Sign in to Nested</h1>
      <p>Click the button below to sign in to your account.</p>
      <p style="text-align: center;">
        <a href="${confirmUrl}" class="button">Sign In</a>
      </p>
      <p class="warning">This link expires in 1 hour.</p>
    `),
    text: `Sign in to Nested\n\nClick here: ${confirmUrl}\n\nThis link expires in 1 hour.`
  };
}

/**
 * Invite email
 */
function inviteTemplate(data: EmailTemplateData): EmailTemplate {
  const confirmUrl = generateConfirmUrl(
    data.tokenHash || '',
    'invite',
    data.redirectTo || '',
    data.siteUrl || ''
  );

  return {
    subject: "You've been invited to Nested",
    html: wrapHtml(`
      <h1>You're invited! 🎉</h1>
      <p>Someone invited you to join Nested, the social platform for college students.</p>
      <p style="text-align: center;">
        <a href="${confirmUrl}" class="button">Accept Invitation</a>
      </p>
      <p class="warning">This invitation expires in 7 days.</p>
    `),
    text: `You've been invited to Nested!\n\nAccept here: ${confirmUrl}\n\nThis invitation expires in 7 days.`
  };
}

/**
 * Email change confirmation
 */
function emailChangeTemplate(data: EmailTemplateData): EmailTemplate {
  const confirmUrl = generateConfirmUrl(
    data.tokenHash || '',
    'email_change',
    data.redirectTo || '',
    data.siteUrl || ''
  );
  const safeNewEmail = sanitizeHtml(data.newEmail);

  return {
    subject: 'Confirm your email change on Nested',
    html: wrapHtml(`
      <h1>Confirm email change</h1>
      <p>You requested to change your email address${safeNewEmail ? ` to <strong>${safeNewEmail}</strong>` : ''}.</p>
      <p style="text-align: center;">
        <a href="${confirmUrl}" class="button">Confirm Change</a>
      </p>
      <p class="warning">If you didn't request this change, please secure your account immediately.</p>
    `),
    text: `Confirm email change on Nested\n\nConfirm here: ${confirmUrl}`
  };
}

/**
 * Reauthentication email
 */
function reauthenticationTemplate(data: EmailTemplateData): EmailTemplate {
  const safeToken = sanitizeHtml(data.token);

  return {
    subject: 'Confirm your identity on Nested',
    html: wrapHtml(`
      <h1>Security verification</h1>
      <p>Please enter the code below to confirm your identity:</p>
      <p style="text-align: center;">
        <span class="code">${safeToken}</span>
      </p>
      <p class="warning">This code expires in 10 minutes. If you didn't request this, please secure your account.</p>
    `),
    text: `Security verification for Nested\n\nYour code: ${safeToken}\n\nThis code expires in 10 minutes.`
  };
}

/**
 * Get the appropriate email template based on action type
 */
export function getEmailTemplate(
  actionType: EmailActionType,
  data: EmailTemplateData
): EmailTemplate {
  switch (actionType) {
    case 'signup':
      return signupTemplate(data);
    case 'recovery':
      return recoveryTemplate(data);
    case 'magiclink':
      return magiclinkTemplate(data);
    case 'invite':
      return inviteTemplate(data);
    case 'email_change':
      return emailChangeTemplate(data);
    case 'reauthentication':
      return reauthenticationTemplate(data);
    default:
      // Fallback to signup template
      return signupTemplate(data);
  }
}

/**
 * Transactional email templates
 */
export interface TransactionalEmailData {
  type: 'welcome' | 'notification' | 'match' | 'event_reminder';
  recipientName?: string;
  subject?: string;
  message?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export function getTransactionalTemplate(data: TransactionalEmailData): EmailTemplate {
  const safeName = sanitizeHtml(data.recipientName) || 'there';
  const safeMessage = sanitizeHtml(data.message);
  const safeCta = data.ctaUrl ? getSafeRedirectUrl(data.ctaUrl) : null;

  switch (data.type) {
    case 'welcome':
      return {
        subject: 'Welcome to Nested! 🎓',
        html: wrapHtml(`
          <h1>Welcome, ${safeName}!</h1>
          <p>You're officially part of the Nested community. Here's what you can do:</p>
          <ul>
            <li>Connect with students at your university</li>
            <li>Discover events and activities</li>
            <li>Find study partners and friends</li>
          </ul>
          ${safeCta ? `<p style="text-align: center;"><a href="${safeCta}" class="button">Explore Nested</a></p>` : ''}
        `),
        text: `Welcome to Nested, ${safeName}!\n\nYou're officially part of the community.`
      };

    case 'notification':
      return {
        subject: data.subject || 'New notification from Nested',
        html: wrapHtml(`
          <h1>Hey ${safeName}!</h1>
          <p>${safeMessage || 'You have a new notification on Nested.'}</p>
          ${safeCta ? `<p style="text-align: center;"><a href="${safeCta}" class="button">${sanitizeHtml(data.ctaText) || 'View Details'}</a></p>` : ''}
        `),
        text: `${safeMessage || 'You have a new notification on Nested.'}`
      };

    case 'match':
      return {
        subject: "You've got a new match on Nested! 🎉",
        html: wrapHtml(`
          <h1>New match!</h1>
          <p>Hey ${safeName}, you've connected with someone new on Nested.</p>
          ${safeCta ? `<p style="text-align: center;"><a href="${safeCta}" class="button">Start Chatting</a></p>` : ''}
        `),
        text: `You've got a new match on Nested!`
      };

    case 'event_reminder':
      return {
        subject: data.subject || 'Event reminder from Nested',
        html: wrapHtml(`
          <h1>Event reminder 📅</h1>
          <p>Hey ${safeName}, ${safeMessage || "don't forget about your upcoming event!"}</p>
          ${safeCta ? `<p style="text-align: center;"><a href="${safeCta}" class="button">View Event</a></p>` : ''}
        `),
        text: `Event reminder: ${safeMessage || "Don't forget about your upcoming event!"}`
      };

    default:
      return {
        subject: data.subject || 'Message from Nested',
        html: wrapHtml(`
          <h1>Hey ${safeName}!</h1>
          <p>${safeMessage || 'You have a message from Nested.'}</p>
        `),
        text: safeMessage || 'You have a message from Nested.'
      };
  }
}
