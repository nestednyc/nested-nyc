/* ============================================================
   NESTED NYC — Community post adapter (Supabase ⇄ board shape)

   Pure transforms between `posts` / `post_comments` rows and the
   shapes community.jsx renders. Author identity comes from the
   denormalized snapshot columns (profile reads are relationship-
   scoped by RLS, so the feed can't join profiles for strangers);
   personLabel keeps the @handle-first precedence used everywhere.
   ============================================================ */
import { normalizeCat, personLabel } from "./data";

// Supabase `posts` row (+ embedded project) → community card shape.
export function fromDbPost(row) {
  if (!row) return null;
  const project = row.project && row.project.id
    ? { id: row.project.id, title: row.project.name || "", cat: normalizeCat(row.project.category) }
    : null;
  return {
    id: row.id,
    authorId: row.author_id,
    author: personLabel({ username: row.author_handle, firstName: row.author_name }),
    authorAvatar: row.author_avatar || "",
    body: row.body || "",
    images: Array.isArray(row.images) ? row.images.filter((u) => typeof u === "string") : [],
    uni: row.university || null,
    project,
    likes: row.like_count || 0,
    commentCount: row.comment_count || 0,
    at: row.created_at,
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
    body: p.body || "",
    project_id: p.projectId || null,
    images: Array.isArray(p.images) ? p.images.slice(0, 4) : [],
    university: profile.uni || null,
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
