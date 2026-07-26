/* ============================================================
   NESTED NYC — People adapter (Supabase profiles → People card)

   Maps a profiles row to the cork-board People card shape. Connections
   ARE persisted (NestedApp drives connectionService.connect/disconnect)
   and are now visible to the person on the receiving end — see the
   People "Incoming" tab. This file stays a pure transformation: no
   service calls live here.
   ============================================================ */
import { UNI, bareHandle, fullNameOf, personLabel } from './data'

function initials(name) {
  const parts = String(name || "").replace(/^@+/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Supabase profiles row → cork-board People card. Defaults keep UNI[uni]
// and every array field safe so the People cards never crash.
export function toPerson(row) {
  // Usernames lead everywhere (the shared personLabel rule in data.js); the
  // real name demotes to the secondary meta line when the person set one.
  const name = personLabel(row, "Student");
  // realName feeds the secondary meta line — kept only when it adds info
  // beyond the label (for a username-less row personLabel IS the real name,
  // and rendering it again would print the name twice).
  const full = fullNameOf(row.first_name, row.last_name);
  const realName = full && full !== name ? full : "";
  const fields = Array.isArray(row.fields) ? row.fields : [];
  const skills = Array.isArray(row.skills) ? row.skills : [];
  const label = initials(name);
  // Real uploaded photos when present (a 3-slot gallery); empty slots fall back
  // to the initials polaroid so the card never breaks.
  const photoUrls = Array.isArray(row.photos) ? row.photos.filter((u) => typeof u === "string" && u.length) : [];
  return {
    id: row.id,
    name,
    realName,
    handle: bareHandle(row.username) || "student",
    uni: UNI[row.university] ? row.university : "nyu",
    major: row.major || "",
    year: row.year || "",
    bio: row.bio || "",
    avatar: photoUrls[0] || null,
    photos: [0, 1, 2].map((i) => ({ src: photoUrls[i] || null, l: label })),
    skills,
    building: row.building || "",
    interests: fields,
    links: row.links || {},
  };
}
