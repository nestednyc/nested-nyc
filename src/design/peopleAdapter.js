/* ============================================================
   NESTED NYC — People adapter (Supabase profiles → People card)

   Maps a profiles row to the cork-board People card shape. Connections
   ARE persisted (NestedApp drives connectionService.connect/disconnect)
   and are now visible to the person on the receiving end — see the
   People "Incoming" tab. This file stays a pure transformation: no
   service calls live here.
   ============================================================ */
import { UNI } from './data'

// The People card wants ONE discipline `role`; profiles carry interest tags
// (fields) + skills, both picked from a fixed chip vocabulary (FIELDS + SKILLS
// in data.jsx). Map every known tag straight to a discipline, then let the
// tags vote — skills are the more specific signal so they weigh more. Every
// onboarding interest maps to something, so "engineer" is a genuine last
// resort (zero recognised tags), not a default that swallows everyone.
const TAG_ROLE = {
  // interest tags (FIELDS)
  "engineering": "engineer", "design": "designer", "product": "founder",
  "data science": "researcher", "business": "founder", "marketing": "founder",
  "research": "researcher", "arts & media": "creative",
  // skills (SKILLS)
  "frontend": "engineer", "backend": "engineer", "full stack": "engineer",
  "mobile": "engineer", "devops": "engineer",
  "ui/ux": "designer", "product design": "designer", "graphic design": "designer",
  "project mgmt": "founder", "strategy": "founder", "growth": "founder",
  "sales": "founder", "bd": "founder",
  "data": "researcher", "data analysis": "researcher", "ml/ai": "researcher",
  "content": "creative", "writing": "creative", "video": "creative",
  "photography": "creative",
};

// Backstop for legacy / free-form values outside the chip vocabulary above.
function keywordRole(tag) {
  if (/found|startup|business|product|sales|\bbd\b|growth|market|strateg/.test(tag)) return "founder";
  if (/design|\bux\b|\bui\b|brand|visual|illustr/.test(tag)) return "designer";
  if (/research|data|\bml\b|\bai\b|science|neuro|biolog|analy/.test(tag)) return "researcher";
  if (/writ|film|music|\bart\b|creative|content|photo|video|\bmedia\b/.test(tag)) return "creative";
  if (/front|back|full.?stack|mobile|devops|engineer|coding|software|\bweb\b/.test(tag)) return "engineer";
  return null;
}

// Ties resolve in this order, so engineer only wins on a strict plurality.
const ROLE_PRIORITY = ["founder", "designer", "researcher", "creative", "engineer"];

function roleFromProfile(fields, skills) {
  const tally = { designer: 0, engineer: 0, founder: 0, researcher: 0, creative: 0 };
  const vote = (tag, weight) => {
    if (!tag) return;
    const key = String(tag).trim().toLowerCase();
    const role = TAG_ROLE[key] || keywordRole(key);
    if (role) tally[role] += weight;
  };
  (fields || []).forEach((t) => vote(t, 1)); // interests: weaker signal
  (skills || []).forEach((t) => vote(t, 2)); // skills: stronger, discipline-specific

  let best = null, bestN = 0;
  for (const role of ROLE_PRIORITY) {
    if (tally[role] > bestN) { best = role; bestN = tally[role]; }
  }
  return best || "engineer";
}

function initials(name) {
  const parts = String(name || "").replace(/^@+/, "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// Supabase profiles row → cork-board People card. Defaults keep UNI[uni],
// ROLE[role] and every array field safe so the People cards never crash.
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
