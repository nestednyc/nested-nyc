/* ============================================================
   NESTED NYC — Community post adapter (Supabase ⇄ board shape)

   Pure transforms between `posts` / `post_comments` rows and the
   shapes community.jsx renders, plus the read-time adapter that
   turns an `events` row into a board card (events are merged into
   the feed, never stored as posts). Author identity comes from the
   denormalized snapshot columns (profile reads are relationship-
   scoped by RLS, so the feed can't join profiles for strangers);
   personLabel keeps the @handle-first precedence used everywhere.
   ============================================================ */
import { normalizeCat, personLabel, resolveOrgUniSlug } from "./data";

// posts.kind — WHY a note is on the board (migration 20260830000000).
export const POST_KINDS = ["update", "win", "ask"];
function normalizeKind(k) {
  return POST_KINDS.includes(k) ? k : "update";
}

// Supabase `posts` row (+ embedded project) → community card shape.
export function fromDbPost(row) {
  if (!row) return null;
  const project = row.project && row.project.id
    ? { id: row.project.id, title: row.project.name || "", cat: normalizeCat(row.project.category) }
    : null;
  return {
    id: row.id,
    kind: normalizeKind(row.kind),
    authorId: row.author_id,
    author: personLabel({ username: row.author_handle, firstName: row.author_name }),
    authorHandle: row.author_handle || "",
    authorAvatar: row.author_avatar || "",
    // The author's first-ever post — "New on the board" (students only).
    isFirst: !!row.is_first,
    body: row.body || "",
    images: Array.isArray(row.images) ? row.images.filter((u) => typeof u === "string") : [],
    uni: row.university || null,
    project,
    // Pinned by an org (its owner posts as the org): who it's from, for the
    // badge + the link to the org page. Name falls back to the snapshot.
    org: row.org_id
      ? {
          id: row.org_id,
          slug: (row.org && row.org.slug) || "",
          name: (row.org && row.org.name) || row.author_name || "",
          verified: !!(row.org && row.org.verified),
        }
      : null,
    likes: row.like_count || 0,
    commentCount: row.comment_count || 0,
    at: row.created_at,
    editedAt: row.edited_at || null,
  };
}

export function fromDbComment(row) {
  if (!row) return null;
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    author: personLabel({ username: row.author_handle, firstName: row.author_name }),
    authorAvatar: row.author_avatar || "",
    body: row.body || "",
    at: row.created_at,
  };
}

// First usable photo URL from a cork-board profile's photos array (entries
// are either bare URLs or {src} objects — same tolerance as the shells).
function firstPhotoUrl(photos) {
  if (!Array.isArray(photos)) return "";
  for (const p of photos) {
    const url = typeof p === "string" ? p : (p && p.src);
    if (url) return url;
  }
  return "";
}

// Board shape → `posts` insert payload. The author snapshot fields are
// filled by the caller from the signed-in profile (services never guess).
export function toDbPost(p, profile) {
  return {
    author_id: profile.id,
    author_name: (((profile.firstName || "") + " " + (profile.lastName || "")).replace(/\s+/g, " ")).trim(),
    author_handle: profile.username || "",
    author_avatar: firstPhotoUrl(profile.photos),
    kind: normalizeKind(p.kind),
    body: p.body || "",
    project_id: p.projectId || null,
    images: Array.isArray(p.images) ? p.images.slice(0, 4) : [],
    university: profile.uni || null,
  };
}

// Board shape → `posts` insert payload for an ORG post. The owner's uid is
// the author (RLS, delete rights, rate limit); the org supplies the identity
// snapshot and org_id says who the post is from. No project tags for orgs;
// no "win" kind either (an org's milestone is just an update).
export function toDbOrgPost(p, org, userId) {
  return {
    author_id: userId,
    author_name: org.name || "",
    author_handle: "",
    author_avatar: org.logo || "",
    kind: p.kind === "ask" ? "ask" : "update",
    body: p.body || "",
    project_id: null,
    images: Array.isArray(p.images) ? p.images.slice(0, 4) : [],
    university: org.uni || null,
    org_id: org.id,
  };
}

// Comment snapshot payload for `post_comments`.
export function toDbComment(postId, body, profile) {
  return {
    post_id: postId,
    author_id: profile.id,
    author_name: (((profile.firstName || "") + " " + (profile.lastName || "")).replace(/\s+/g, " ")).trim(),
    author_handle: profile.username || "",
    author_avatar: firstPhotoUrl(profile.photos),
    body,
  };
}

// Today as the 'YYYY-MM-DD' string events.date uses (local time — an event
// tonight is still upcoming). events.is_past is never maintained, so the
// board decides "upcoming" from the date itself.
export function localDateISO(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

// Supabase `events` row (+ embedded organization) → board event card. The
// board merges these into the feed by created_at ("the org pinned this
// event on…"). `going` is the server count at load and `iWasGoing` says
// whether it already counts the viewer (from the my_reg embed), so the card
// can add the viewer's live RSVP without double-counting. `universities` is
// the seeded campus list, for the "My school" filter.
export function toBoardEvent(row, { universities } = {}) {
  if (!row || !row.id) return null;
  const org = row.organization || null;
  const uni = org
    ? resolveOrgUniSlug({ type: org.type || "club", slug: org.slug, university_id: org.university_id }, universities || [])
    : null;
  return {
    id: row.id,
    isEvent: true,
    kind: "event",
    title: row.title || "",
    blurb: row.description || "",
    date: row.date || "",
    time: row.time || "",
    place: row.location || "",
    type: row.event_type || "talk",
    org: org
      ? { id: org.id, slug: org.slug || "", name: org.name || row.organizer_name || "", logo: org.logo || "", verified: !!org.verified }
      : null,
    orgName: (org && org.name) || row.organizer_name || "Nested",
    going: row.attendees || 0,
    // The server count already includes me when my registration row embeds.
    iWasGoing: Array.isArray(row.my_reg) && row.my_reg.length > 0,
    questions: Array.isArray(row.questions) ? row.questions : [],
    capacity: row.max_attendees || null,
    uni,
    at: row.created_at,
  };
}

// "2m · 3h · 5d · Aug 12" — feed-style relative timestamp.
export function postTimeAgo(iso) {
  const t = new Date(iso).getTime();
  if (!isFinite(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  if (s < 86400 * 7) return Math.floor(s / 86400) + "d";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
