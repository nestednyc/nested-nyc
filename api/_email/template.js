/* ============================================================
   NESTED NYC — transactional email template
   ------------------------------------------------------------
   ONE renderer, reused by every notification email. Email-safe:
   table layout + inline styles + hex colors (clients ignore
   oklch), web fonts with system fallbacks.

   Look: Anthropic-style warm ivory canvas, near-white card,
   Nested's vermillion as the single accent. Clean, no skeuomorphism.

   Lives under api/_email/ — the leading underscore keeps Vercel
   from treating it as a serverless route; it's a shared lib that
   api/notify.js imports.
   ============================================================ */

const T = {
  page:      "#F0EEE6", // Anthropic warm ivory — the canvas
  card:      "#FCFBF8", // near-white warm card
  border:    "#E7E3D7", // hairline card border
  ink:       "#23211C", // warm near-black
  inkSoft:   "#56514A", // body text
  inkFaint:  "#8C8779", // captions / kickers
  accent:    "#DB5338", // Nested vermillion (our color)
  accentInk: "#A6391F", // darker accent for small text / links on light
  noteBg:    "#F2F0E8", // subtle warm panel for the quoted note
};

const FONT_BODY = "'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const FONT_DISP = "'Bricolage Grotesque'," + FONT_BODY;
const FONT_MONO = "'Spline Sans Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace";

const SITE = "https://www.nested.social";
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400;500;600;700;800&family=Spline+Sans+Mono:wght@400;500;600&display=swap";

// User-supplied strings (names, titles, messages) are untrusted — escape them.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * The one reusable shell. Every notification just fills these slots.
 * @param {object} o
 * @param {string} o.preheader   inbox preview line (hidden in the body)
 * @param {string} o.eyebrow     mono kicker, rendered as "// EYEBROW"
 * @param {string} o.heading     display headline
 * @param {string} o.body        one paragraph of plain text
 * @param {string} [o.note]      optional quoted note (e.g. the join message)
 * @param {string} o.ctaLabel    button text
 * @param {string} o.ctaUrl      button link
 * @param {string} o.footerNote  why they're receiving this
 * @param {string} [o.unsubUrl]  manage-preferences / unsubscribe link
 */
export function renderEmail(o) {
  const note = o.note && String(o.note).trim()
    ? `<div style="border-left:3px solid ${T.accent};background:${T.noteBg};border-radius:0 8px 8px 0;padding:13px 16px;margin:0 0 26px;">
         <div style="font-family:${FONT_MONO};font-size:11px;letter-spacing:.04em;color:${T.inkFaint};text-transform:uppercase;margin-bottom:5px;">// their note</div>
         <div style="font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${T.ink};">${esc(o.note)}</div>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT_LINK}" rel="stylesheet">
<title>${esc(o.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${T.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader || o.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.page};border-collapse:collapse;">
  <tr><td align="center" style="padding:48px 18px;">
    <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="width:540px;max-width:540px;border-collapse:collapse;">

      <!-- wordmark -->
      <tr><td style="padding:0 4px 22px;">
        <span style="font-family:${FONT_DISP};font-weight:800;font-size:18px;color:${T.ink};letter-spacing:-0.02em;">nested<span style="color:${T.accent};">.</span>social</span>
      </td></tr>

      <!-- card -->
      <tr><td style="background:${T.card};border:1px solid ${T.border};border-radius:14px;box-shadow:0 1px 2px rgba(35,33,28,.04);">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr><td style="padding:34px 36px 36px;">

            <div style="font-family:${FONT_MONO};font-size:12px;letter-spacing:.06em;color:${T.accentInk};text-transform:uppercase;font-weight:600;margin-bottom:16px;">// ${esc(o.eyebrow)}</div>

            <h1 style="margin:0 0 14px;font-family:${FONT_DISP};font-weight:800;font-size:26px;line-height:1.18;letter-spacing:-0.02em;color:${T.ink};">${esc(o.heading)}</h1>

            <p style="margin:0 0 26px;font-family:${FONT_BODY};font-size:15.5px;line-height:1.62;color:${T.inkSoft};">${esc(o.body)}</p>

            ${note}

            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr><td style="border-radius:10px;background:${T.ink};">
                <a href="${o.ctaUrl}" style="display:inline-block;padding:13px 26px;font-family:${FONT_BODY};font-weight:700;font-size:15px;color:${T.card};text-decoration:none;border-radius:10px;">${esc(o.ctaLabel)} &nbsp;&rarr;</a>
              </td></tr>
            </table>

          </td></tr>
        </table>
      </td></tr>

      <!-- footer -->
      <tr><td style="padding:22px 8px 0;">
        <div style="font-family:${FONT_BODY};font-size:12.5px;line-height:1.5;color:${T.inkFaint};">${esc(o.footerNote || "")}</div>
        <div style="font-family:${FONT_MONO};font-size:11px;margin-top:9px;">
          <a href="${o.unsubUrl || (SITE + "/profile")}" style="color:${T.inkFaint};text-decoration:underline;">Manage email preferences</a>
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

const url = (path) => SITE + path;

/* The four Phase-1 notifications. Each is a thin filler over the one shell
   above and returns { subject, html } — add the next trigger by adding a
   function here, nothing else. The sender (api/notify.js) passes a
   per-recipient `unsubUrl` so the footer link + List-Unsubscribe header point
   at that person's own one-click opt-out. */
export const emails = {
  // → project owner (+ co-leads): someone asked to join their project
  joinRequest: ({ requesterName, school, role, projectTitle, projectId, message, unsubUrl }) => ({
    subject: `${requesterName} wants to join ${projectTitle}`,
    html: renderEmail({
      preheader: `${requesterName} wants to join ${projectTitle}`,
      eyebrow: "someone wants to build with you",
      heading: `${requesterName} wants to join ${projectTitle}`,
      body: `${requesterName}${school ? ` from ${school}` : ""} asked to join${role ? ` as ${role}` : ""}. Take a look and bring them on board if it's a fit.`,
      note: message,
      ctaLabel: "Review the request",
      ctaUrl: url(`/projects/${projectId}`),
      footerNote: "You're getting this because you lead a project on Nested.",
      unsubUrl,
    }),
  }),

  // → requester: their join request was approved
  joinApproved: ({ ownerName, role, projectTitle, projectId, unsubUrl }) => ({
    subject: `You're on the team for ${projectTitle}`,
    html: renderEmail({
      preheader: `You're on the team for ${projectTitle}`,
      eyebrow: "you're in",
      heading: `You're on the team for ${projectTitle}`,
      body: `${ownerName} approved your request to join${role ? ` as ${role}` : ""}. Time to start building.`,
      ctaLabel: "Open the project",
      ctaUrl: url(`/projects/${projectId}`),
      footerNote: "You're getting this because you asked to join a project on Nested.",
      unsubUrl,
    }),
  }),

  // → target: another student connected with them
  newConnection: ({ sourceName, school, sourceUsername, unsubUrl }) => ({
    subject: `${sourceName} connected with you on Nested`,
    html: renderEmail({
      preheader: `${sourceName} connected with you on Nested`,
      eyebrow: "new connection",
      heading: `${sourceName} connected with you`,
      body: `${sourceName}${school ? ` from ${school}` : ""} just connected with you on Nested. Check out their profile and connect back if you'd like to build together.`,
      ctaLabel: "View their profile",
      ctaUrl: url(sourceUsername ? `/u/${sourceUsername}` : `/people`),
      footerNote: "You're getting this because someone connected with you on Nested.",
      unsubUrl,
    }),
  }),

  // → recipient: another student sent them their FIRST direct message (once per pair)
  newMessage: ({ senderName, school, senderUsername, unsubUrl }) => ({
    subject: `${senderName} messaged you on Nested`,
    html: renderEmail({
      preheader: `${senderName} messaged you on Nested`,
      eyebrow: "new message",
      heading: `${senderName} sent you a message`,
      body: `${senderName}${school ? ` from ${school}` : ""} just messaged you on Nested. Open the conversation to read it and reply.`,
      ctaLabel: "Open conversation",
      ctaUrl: url(senderUsername ? `/messages/${senderUsername}` : `/messages`),
      footerNote: "You're getting this because someone messaged you for the first time on Nested.",
      unsubUrl,
    }),
  }),

  // → org owner: their organization was verified
  orgVerified: ({ orgName, unsubUrl }) => ({
    subject: `${orgName} is verified on Nested`,
    html: renderEmail({
      preheader: `${orgName} is verified on Nested`,
      eyebrow: "you're verified",
      heading: `${orgName} is verified on Nested`,
      body: `Your organization is verified. You can now post events to the Nested board and reach students across NYC.`,
      ctaLabel: "Post your first event",
      ctaUrl: url(`/dashboard/events/new`),
      footerNote: "You're getting this because you manage an org on Nested.",
      unsubUrl,
    }),
  }),
};

export default { renderEmail, emails };
