/* ============================================================
   NESTED NYC — People adapter (Supabase profiles → People card)

   Maps a profiles row to the cork-board People card shape. Connections
   ARE persisted (NestedApp drives connectionService.connect/disconnect)
   and are now visible to the person on the receiving end — see the
   People "Incoming" tab. This file stays a pure transformation: no
   service calls live here.
   ============================================================ */
import { UNI } from './data'

// The People deck wants ONE discipline `role`; profiles carry fields + skills.
// Best-effort bucket into one of the five ROLE ids (defaults to engineer).
function roleFromProfile(fields, skills) {
  const hay = [...(fields || []), ...(skills || [])].join(" ").toLowerCase();
  if (/found|startup|business|product/.test(hay)) return "founder";
  if (/design|ux|ui|brand|visual|illustr/.test(hay)) return "designer";
  if (/research|data|\bml\b|\bai\b|science|neuro|biolog/.test(hay)) return "researcher";
  if (/writ|film|music|\bart\b|creative|content|photo/.test(hay)) return "creative";
  return "engineer";
}

function initials(name) {
  const parts = (name || "").split(" ").filter(Boolean);
  return parts.slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
}

// Supabase profiles row → cork-board People card. Defaults keep UNI[uni],
// ROLE[role] and every array field safe so the swipe deck never crashes.
export function toPerson(row) {
  const name = `${row.first_name || ""} ${row.last_name || ""}`.trim() || row.username || "Student";
  const fields = Array.isArray(row.fields) ? row.fields : [];
  const skills = Array.isArray(row.skills) ? row.skills : [];
  const label = initials(name);
  // Real uploaded photos when present (a 3-slot gallery); empty slots fall back
  // to the initials polaroid so the card never breaks.
  const photoUrls = Array.isArray(row.photos) ? row.photos.filter((u) => typeof u === "string" && u.length) : [];
  return {
    id: row.id,
    name,
    handle: row.username || "student",
    uni: UNI[row.university] ? row.university : "nyu",
    major: row.major || "",
    year: row.year || "",
    bio: row.bio || "",
    role: roleFromProfile(fields, skills),
    avatar: photoUrls[0] || null,
    photos: [0, 1, 2].map((i) => ({ src: photoUrls[i] || null, l: label })),
    skills,
    building: row.building || "",
    avail: row.availability || "",
    interests: fields,
    links: row.links || {},
  };
}
