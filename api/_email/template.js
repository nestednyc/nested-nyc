/* ============================================================
   NESTED NYC — transactional email template
   ------------------------------------------------------------
   ONE renderer, reused by every notification email and the weekly
   digest. renderEmail(o) + emails.* (ten builders). The five
   person-actor builders (joinRequest, joinApproved,
   clubJoinRequest, newConnection, newMessage) take an optional
   `avatarUrl` (profiles.avatar — null is fine): a Supabase-storage
   public URL renders as the photo, anything else falls back to a
   self-contained initials disc (no image request). clubJoinAccepted,
   newReport, newOrg, weeklyDigest, orgVerified render without one.

   Look: brand red-orange band (ivory block mark + wordmark + mono
   eyebrow) over a white card with a red-ring avatar identity row,
   vermillion CTA, hatch-stripe motif.

   Assets/env: the band logo is /email/nested-mark-ivory.png in
   public/ (must exist there — the SPA rewrite answers any missing
   path with index.html, i.e. a silently broken image).
   EMAIL_LOGO_URL overrides it for local previews; leave it unset
   in production (documented in EMAIL_NOTIFICATIONS.md).

   The color-scheme "light only" metas keep Apple Mail from
   recoloring; Gmail's forced dark mode ignores them, so dark-mode
   changes still deserve a Gmail-app render check.

   Email-safe: table layout + inline styles + hex colors (clients
   ignore oklch). Lives under api/_email/ — the underscore keeps
   Vercel from routing it; api/notify.js + api/digest.js import it.
   ============================================================ */

const T = {
  page:      "#F0EEE6", // warm ivory canvas
  band:      "#D63B1F", // brand red-orange — the header band
  bandInk:   "#F5EFE1", // ivory type on the band
  card:      "#FFFFFF",
  border:    "#EBDCD2",
  ink:       "#23211C",
  inkSoft:   "#56514A",
  inkFaint:  "#8C8779",
  accent:    "#D63B1F",
  accentDark:"#A6391F", // darker accent — initials-disc letters, small text on light
  noteBg:    "#FBF3EE", // warm blush panel for the quoted note
  hatch2:    "#E98A6F", // hatch motif, mid tint
  hatch3:    "#F3BFAE", // hatch motif, light tint
  avatarBg:  "#F3E9E2",
};

const FONT_BODY = "'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const FONT_DISP = "'Bricolage Grotesque'," + FONT_BODY;
const FONT_MONO = "'Spline Sans Mono',ui-monospace,'SF Mono',Menlo,Consolas,monospace";

const SITE = "https://www.nested.social";
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Hanken+Grotesk:wght@400;500;600;700;800&family=Spline+Sans+Mono:wght@400;500;600&display=swap";

const LOGO = process.env.EMAIL_LOGO_URL || (SITE + "/email/nested-mark-ivory.png");

// User-supplied strings (names, titles, messages) are untrusted — escape them.
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* Person-actor emails carry the actor's photo. Only our own storage's
   public URLs are trusted into an <img> the recipient's client will fetch
   (profiles.avatar is user-writable); anything else renders the inline
   initials disc below — no network request, nothing leaves the email. */
const AVATAR_URL_MARKER = "/storage/v1/object/public/";
function safeAvatarUrl(url) {
  const s = String(url || "");
  return /^https:\/\//i.test(s) && s.includes(AVATAR_URL_MARKER) ? s : null;
}
function initialsOf(name) {
  const parts = String(name || "").replace(/^@/, "").trim().split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "N") + (parts[1]?.[0] || "")).toUpperCase();
}

/**
 * The one reusable shell. Every notification fills these slots.
 * @param {object}  o
 * @param {string}  o.preheader   inbox preview line (hidden in the body)
 * @param {string}  o.eyebrow     mono kicker in the band, rendered "// EYEBROW"
 * @param {string}  o.heading     display headline
 * @param {string}  o.body        one paragraph of plain text
 * @param {object} [o.actor]      { name, avatarUrl, meta } — the person this
 *                                email is about; renders the identity row
 * @param {string} [o.note]       optional quoted note (e.g. the join message)
 * @param {string}  o.ctaLabel    button text
 * @param {string}  o.ctaUrl      button link
 * @param {string}  o.footerNote  why they're receiving this
 * @param {string} [o.unsubUrl]   manage-preferences link (null for internal mail)
 * @param {Array}  [o.sections]   optional list blocks: [{ title, items: [{ label, sub, url }] }]
 * @param {Array}  [o.footerLinks] optional footer links [{ label, url }] (replaces the single preferences link)
 */
export function renderEmail(o) {
  const actorPhoto = o.actor ? safeAvatarUrl(o.actor.avatarUrl) : null;
  const actorDisc = o.actor
    ? (actorPhoto
      ? `<img src="${esc(actorPhoto)}" width="76" height="76" alt="Profile photo of ${esc(o.actor.name)}" style="display:block;width:76px;height:76px;border-radius:50%;border:3px solid ${T.band};background:${T.avatarBg};object-fit:cover;color:${T.ink};font-family:${FONT_BODY};font-size:11px;" />`
      : `<div style="width:70px;height:70px;line-height:70px;text-align:center;border-radius:50%;background:${T.page};border:3px solid ${T.band};font-family:${FONT_DISP};font-weight:800;font-size:26px;letter-spacing:.01em;color:${T.accentDark};">${esc(initialsOf(o.actor.name))}</div>`)
    : "";
  const actor = o.actor
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;">
         <tr>
           <td width="76" style="width:76px;" valign="middle">
             ${actorDisc}
           </td>
           <td width="18" style="width:18px;font-size:0;line-height:0;">&nbsp;</td>
           <td valign="middle">
             <div style="font-family:${FONT_DISP};font-weight:800;font-size:19px;letter-spacing:-0.01em;color:${T.ink};">${esc(o.actor.name)}</div>
             ${o.actor.meta ? `<div style="font-family:${FONT_MONO};font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:${T.inkFaint};margin-top:5px;">${esc(o.actor.meta)}</div>` : ""}
           </td>
         </tr>
       </table>`
    : "";

  const note = o.note && String(o.note).trim()
    ? `<div style="border-left:3px solid ${T.accent};background:${T.noteBg};border-radius:0 10px 10px 0;padding:14px 17px;margin:0 0 26px;">
         <div style="font-family:${FONT_MONO};font-size:11px;letter-spacing:.04em;color:${T.inkFaint};text-transform:uppercase;margin-bottom:5px;">// their note</div>
         <div style="font-family:${FONT_BODY};font-size:15px;line-height:1.55;color:${T.ink};">${esc(o.note)}</div>
       </div>`
    : "";

  const sections = (o.sections || [])
    .filter((s) => s && Array.isArray(s.items) && s.items.length)
    .map((s) => `<div style="margin:0 0 24px;">
         <div style="font-family:${FONT_MONO};font-size:11px;letter-spacing:.06em;color:${T.accent};text-transform:uppercase;font-weight:600;margin-bottom:6px;">// ${esc(s.title)}</div>
         ${s.items.map((it) => `<div style="padding:10px 0;border-top:1px dashed ${T.border};">
           <a href="${esc(it.url)}" style="font-family:${FONT_BODY};font-weight:700;font-size:15px;color:${T.ink};text-decoration:none;">${esc(it.label)}</a>
           ${it.sub ? `<div style="font-family:${FONT_BODY};font-size:13.5px;line-height:1.5;color:${T.inkSoft};margin-top:2px;">${esc(it.sub)}</div>` : ""}
         </div>`).join("")}
       </div>`)
    .join("");

  const footerLinks = (o.footerLinks && o.footerLinks.length
    ? o.footerLinks
    : [{ label: "Manage email preferences", url: o.unsubUrl || (SITE + "/profile") }])
    .map((l) => `<a href="${esc(l.url)}" style="color:${T.inkFaint};text-decoration:underline;">${esc(l.label)}</a>`)
    .join(" &nbsp;&middot;&nbsp; ");

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT_LINK}" rel="stylesheet">
<title>${esc(o.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${T.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader || o.heading)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${T.page};border-collapse:collapse;">
  <tr><td align="center" style="padding:44px 18px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;border-collapse:collapse;">

      <!-- band -->
      <tr><td style="background:${T.band};border-radius:18px 18px 0 0;padding:20px 36px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td valign="middle">
              <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td width="34" style="width:34px;" valign="middle"><img src="${esc(LOGO)}" width="34" height="34" alt="Nested" style="display:block;width:34px;height:34px;border-radius:9px;border:0;color:${T.bandInk};font-family:${FONT_BODY};font-size:11px;" /></td>
                  <td width="11" style="width:11px;font-size:0;">&nbsp;</td>
                  <td valign="middle"><span style="font-family:${FONT_DISP};font-weight:800;font-size:19px;color:${T.bandInk};letter-spacing:-0.02em;">nested</span></td>
                </tr>
              </table>
            </td>
            <td align="right" valign="middle">
              <span style="font-family:${FONT_MONO};font-size:11px;letter-spacing:.07em;color:${T.bandInk};text-transform:uppercase;font-weight:600;">// ${esc(o.eyebrow)}</span>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- card -->
      <tr><td style="background:${T.card};border:1px solid ${T.border};border-top:0;border-radius:0 0 18px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr><td style="padding:32px 36px 34px;">

            ${actor}

            <h1 style="margin:0 0 14px;font-family:${FONT_DISP};font-weight:800;font-size:30px;line-height:1.12;letter-spacing:-0.02em;color:${T.ink};">${esc(o.heading)}</h1>

            <p style="margin:0 0 26px;font-family:${FONT_BODY};font-size:15.5px;line-height:1.62;color:${T.inkSoft};">${esc(o.body)}</p>

            ${note}

            ${sections}

            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr><td style="border-radius:12px;background:${T.accent};mso-padding-alt:14px 28px;">
                <a href="${esc(o.ctaUrl)}" style="display:inline-block;padding:14px 28px;font-family:${FONT_BODY};font-weight:700;font-size:15px;color:#FFFFFF;text-decoration:none;border-radius:12px;">${esc(o.ctaLabel)} &nbsp;&rarr;</a>
              </td></tr>
            </table>

            <!-- hatch motif — nod to the block mark -->
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:30px;">
              <tr>
                <td width="34" height="4" style="width:34px;height:4px;background:${T.accent};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
                <td width="6" style="width:6px;font-size:0;">&nbsp;</td>
                <td width="22" height="4" style="width:22px;height:4px;background:${T.hatch2};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
                <td width="6" style="width:6px;font-size:0;">&nbsp;</td>
                <td width="12" height="4" style="width:12px;height:4px;background:${T.hatch3};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td>
              </tr>
            </table>

          </td></tr>
        </table>
      </td></tr>

      <!-- footer -->
      <tr><td style="padding:22px 8px 0;">
        <div style="font-family:${FONT_BODY};font-size:12.5px;line-height:1.5;color:${T.inkFaint};">${esc(o.footerNote || "")}</div>
        <div style="font-family:${FONT_MONO};font-size:11px;margin-top:9px;">
          ${footerLinks}
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

const url = (path) => SITE + path;

/* The ten notifications. Each returns { subject, html }. The senders
   (api/notify.js, api/digest.js) pass per-recipient unsub links; the five
   person-actor builders also take an optional `avatarUrl` (profiles.avatar —
   null is fine, the shell builds an initials fallback from the name). */
export const emails = {
  // → project owner (+ co-leads): someone asked to join their project
  joinRequest: ({ requesterName, school, role, projectTitle, projectId, message, avatarUrl, unsubUrl }) => ({
    subject: `${requesterName} wants to join ${projectTitle}`,
    html: renderEmail({
      preheader: `${requesterName} wants to join ${projectTitle}`,
      eyebrow: "join request",
      heading: `${requesterName} wants to join ${projectTitle}`,
      body: `${requesterName}${school ? ` from ${school}` : ""} asked to join${role ? ` as ${role}` : ""}. Take a look and bring them on board if it's a fit.`,
      actor: { name: requesterName, avatarUrl, meta: [school, role].filter(Boolean).join(" · ") },
      note: message,
      ctaLabel: "Review the request",
      ctaUrl: url(`/projects/${projectId}`),
      footerNote: "You're getting this because you lead a project on Nested.",
      unsubUrl,
    }),
  }),

  // → requester: their join request was approved
  joinApproved: ({ ownerName, role, projectTitle, projectId, avatarUrl, unsubUrl }) => ({
    subject: `You're on the team for ${projectTitle}`,
    html: renderEmail({
      preheader: `You're on the team for ${projectTitle}`,
      eyebrow: "you're in",
      heading: `You're on the team for ${projectTitle}`,
      body: `${ownerName} approved your request to join${role ? ` as ${role}` : ""}. Time to start building.`,
      // Only render the identity row for a real person — the planner falls back
      // to "The project lead" when the owner profile couldn't be read, and a
      // generic label around an initials disc reads broken, not personal.
      actor: ownerName && ownerName !== "The project lead"
        ? { name: ownerName, avatarUrl, meta: "project lead" }
        : undefined,
      ctaLabel: "Open the project",
      ctaUrl: url(`/projects/${projectId}`),
      footerNote: "You're getting this because you asked to join a project on Nested.",
      unsubUrl,
    }),
  }),

  // → club owner: a student applied to join their club
  clubJoinRequest: ({ applicantName, school, clubName, avatarUrl, unsubUrl }) => ({
    subject: `${applicantName} wants to join ${clubName}`,
    html: renderEmail({
      preheader: `${applicantName} applied to join ${clubName}`,
      eyebrow: "someone wants in",
      heading: `${applicantName} wants to join ${clubName}`,
      body: `${applicantName}${school ? ` from ${school}` : ""} tapped Join on your page and answered your questions. Take a look and bring them onto the roster if it's a fit.`,
      actor: { name: applicantName, avatarUrl, meta: school || "student" },
      ctaLabel: "Review applications",
      ctaUrl: url("/dashboard/members"),
      footerNote: "You're getting this because you run an org on Nested.",
      unsubUrl,
    }),
  }),

  // → applicant: the club accepted them
  clubJoinAccepted: ({ clubName, clubSlug, unsubUrl }) => ({
    subject: `You're in — welcome to ${clubName}`,
    html: renderEmail({
      preheader: `${clubName} accepted your application`,
      eyebrow: "you're in",
      heading: `Welcome to ${clubName}`,
      body: `${clubName} accepted your application. You're on the roster, and you'll see their posts and events on your board from here on.`,
      ctaLabel: `Open ${clubName}`,
      ctaUrl: url(`/org/${clubSlug}`),
      footerNote: "You're getting this because you applied to join a club on Nested.",
      unsubUrl,
    }),
  }),

  // → target: another student connected with them
  newConnection: ({ sourceName, school, sourceUsername, avatarUrl, unsubUrl }) => ({
    subject: `${sourceName} connected with you on Nested`,
    html: renderEmail({
      preheader: `${sourceName} connected with you on Nested`,
      eyebrow: "new connection",
      heading: `${sourceName} connected with you`,
      body: `${sourceName}${school ? ` from ${school}` : ""} just connected with you on Nested. Check out their profile and connect back if you'd like to build together.`,
      actor: { name: sourceName, avatarUrl, meta: school || "student" },
      ctaLabel: "View their profile",
      ctaUrl: url(sourceUsername ? `/u/${sourceUsername}` : `/people`),
      footerNote: "You're getting this because someone connected with you on Nested.",
      unsubUrl,
    }),
  }),

  // → recipient: another student sent them their FIRST direct message (once per pair)
  newMessage: ({ senderName, school, senderUsername, avatarUrl, unsubUrl }) => ({
    subject: `${senderName} messaged you on Nested`,
    html: renderEmail({
      preheader: `${senderName} messaged you on Nested`,
      eyebrow: "new message",
      heading: `${senderName} sent you a message`,
      body: `${senderName}${school ? ` from ${school}` : ""} just messaged you on Nested. Open the conversation to read it and reply.`,
      actor: { name: senderName, avatarUrl, meta: school || "student" },
      ctaLabel: "Open conversation",
      ctaUrl: url(senderUsername ? `/messages/${senderUsername}` : `/messages`),
      footerNote: "You're getting this because someone messaged you for the first time on Nested.",
      unsubUrl,
    }),
  }),

  // → the founders (REPORT_RECIPIENTS): a student flagged something on the board
  newReport: ({ reporterName, reporterSchool, targetLabel, excerpt, reason, targetType, targetId }) => {
    const clip = excerpt && excerpt.length > 280 ? excerpt.slice(0, 277) + "…" : excerpt;
    return {
      subject: `Report: ${targetLabel}`,
      html: renderEmail({
        preheader: `${reporterName} reported ${targetLabel}`,
        eyebrow: "community report",
        heading: `${reporterName} reported ${targetLabel}`,
        body: `${reporterName}${reporterSchool ? ` from ${reporterSchool}` : ""} flagged ${targetLabel} on the community board.${clip ? ` What they reported: “${clip}”` : ""} (${targetType} ${targetId})`,
        note: reason,
        ctaLabel: "Open the board",
        ctaUrl: url(`/community`),
        footerNote: "Internal alert — this address is on REPORT_RECIPIENTS for Nested. Three distinct reports auto-hide a post or comment; reset posts.report_count / post_comments.report_count to restore it.",
        unsubUrl: null,
      }),
    };
  },

  // → the founders (ADMIN_RECIPIENTS): a new org signed up and is waiting for verification
  newOrg: ({ name, type, slug, location, bio, ownerEmail, school }) => ({
    subject: `New org waiting for review: ${name}`,
    html: renderEmail({
      preheader: `${name} signed up on Nested`,
      eyebrow: "new org",
      heading: `${name} signed up`,
      body: `A new ${type || "org"}${school ? ` at ${school}` : ""}${location ? ` (${location})` : ""} just created its page${ownerEmail ? ` — owner ${ownerEmail}` : ""}. It stays invisible until verified. To approve it, run as service role: update public.organizations set verified = true where slug = '${slug}';`,
      note: bio,
      ctaLabel: "Open its page",
      ctaUrl: url(`/org/${encodeURIComponent(slug || "")}`),
      footerNote: "Internal alert — this address is on ADMIN_RECIPIENTS for Nested. The page 404s for everyone but the owner until the org is verified.",
      unsubUrl: null,
    }),
  }),

  // → every student who hasn't opted out: the week on the board, school first
  weeklyDigest: ({ firstName, school, posts, events, flyers, unsubUrl, digestUnsubUrl }) => ({
    subject: `This week on the board${school ? ` at ${school}` : ""}`,
    html: renderEmail({
      preheader: `${posts.length} notes, ${events.length} events and ${flyers.length} new flyers this week`,
      eyebrow: "this week",
      heading: `${firstName ? firstName + ", here's" : "Here's"} what happened on Nested this week`,
      body: `${school ? `What students at ${school} and across NYC pinned` : "What NYC students pinned"} in the last seven days — wins, asks, and what's coming up.`,
      sections: [
        { title: "on the board", items: posts },
        { title: "coming up", items: events },
        { title: "new flyers", items: flyers },
      ],
      ctaLabel: "Open the board",
      ctaUrl: url(`/community`),
      footerNote: "You're getting this weekly because you're a student on Nested. Once a week, never more.",
      footerLinks: [
        { label: "Unsubscribe from the weekly digest", url: digestUnsubUrl },
        { label: "All email preferences", url: unsubUrl },
      ],
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
