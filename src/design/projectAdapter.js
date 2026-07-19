/* ============================================================
   NESTED NYC — Project adapter (Supabase ⇄ cork-board)

   Pure transformation between the cork-board project shape used by
   src/design/* (create.jsx / edit.jsx / detail.jsx / discover.jsx) and the
   snake_case `projects` row Supabase stores. No service calls in this file.
   ============================================================ */
import { personLabel } from "./data";

// Cork-board project → Supabase `projects` row payload (snake_case).
// owner_id is injected by projectService.createProject, so we omit it here —
// that keeps the SAME payload safe to reuse for updateProject (which must
// never touch owner_id). `admins` defaults to [ownerId] for a fresh flyer.
export function toDbProject(p, ownerId) {
  const admins = Array.isArray(p.admins) && p.admins.length
    ? p.admins
    : (ownerId ? [ownerId] : []);
  return {
    name: p.title || "",
    tagline: p.blurb || "",
    description: p.about || "",
    category: p.cat || null,
    university: p.uni || null,
    author_name: p.ownerName || "",
    commitment: p.commitment || null,
    communication_link: p.communicationLink || "",
    stage: p.stage || null,
    timeline: p.event || "",            // UI calls the timeline string `event`
    place: p.place || "",
    pin_type: p.pinType || "tape",
    rot: p.rot || null,
    status: p.status || "idea",
    alert: p.alert || "",
    flyer_color: p.flyerColor || null,
    tags: Array.isArray(p.tags) ? p.tags : [],
    admins,
    roles: Array.isArray(p.roles) ? p.roles : [],
    publish_to_discover: true,
  };
}

// ---- Member identity: the ONE rule for "DB row → how we name a person" -------
// Everything that turns a team_members-shaped row (with an embedded `profiles`
// join) into a display identity routes through here, so the precedence lives in
// a single place instead of being recopied into every read.

// The live full name, collapsing the trailing/double whitespace some first/last
// fields carry. The single name-builder shared by every identity path.
function fullNameOf(first, last) {
  return ((first || "") + " " + (last || "")).replace(/\s+/g, " ").trim();
}

// Older creates persisted the literal placeholder "you" as a name (when the
// creator had no username yet). Never show it — treat it as empty. Applied to
// EVERY denormalised snapshot so it can't leak on one surface but not another.
function cleanName(s) {
  return s && s.trim().toLowerCase() === "you" ? "" : (s || "");
}

// Canonical identity for a team_members-shaped row carrying an embedded
// `profiles` join. Prefers the LIVE profile over the denormalised snapshot the
// row captured at request/create time:
//   name   = live full name → "@username" (always present) → cleaned snapshot → fallback
//   handle = the person's current username (for the @-mention sub-line); "" if unknown
//   image  = live first photo / avatar → row.image snapshot
// `fallback` is the neutral last resort ("Lead" / "Member" / "Team Member"),
// reached only when the join delivered no profile at all. `snapshots` are extra
// denormalised name sources (e.g. projects.author_name) tried before row.name.
export function memberIdentity(row, { fallback = "Member", snapshots = [] } = {}) {
  const pr = (row && row.profiles) || null;
  const full = pr ? fullNameOf(pr.first_name, pr.last_name) : "";
  const handle = (pr && pr.username) || "";
  const snap = [...snapshots, row && row.name].map(cleanName).find((s) => s) || "";
  const photo = pr && ((Array.isArray(pr.photos) && pr.photos[0]) || pr.avatar);
  return {
    name: full || (handle ? "@" + handle : "") || snap || fallback,
    handle,
    image: photo || (row && row.image) || null,
  };
}

// Join-request rows (the Notifications inbox + a project's "Requests to join"
// card). Thin wrapper over memberIdentity — kept as a named export so the
// services that read requests don't need to know the fallback word.
export function requestIdentity(row) {
  return memberIdentity(row, { fallback: "Team Member" });
}

// Supabase `projects` row (+ joined `team_members`) → cork-board project shape.
// Reproduces EXACTLY the object create.jsx builds, so ProjectCard / ProjectDetail
// render an API-backed project identically to a freshly-pinned one. Defaults are
// chosen so CAT[cat]/UNI[uni] and p.lead/p.team/p.roles never blow up the UI.
export function fromDbProject(row) {
  if (!row) return null;
  const members = Array.isArray(row.team_members) ? row.team_members : [];
  const ownerMember = members.find((m) => m.user_id === row.owner_id) || null;
  const crew = members.filter((m) => m.user_id !== row.owner_id);
  // Lead + crew identities both come from the one canonical resolver
  // (memberIdentity), so the flyer, the facepile, and the request inbox can't
  // drift. The lead additionally checks the projects.author_name snapshot
  // (before the owner's own team_members row) and falls back to "Lead".
  const leadId = memberIdentity(ownerMember, { fallback: "Lead", snapshots: [row.author_name] });
  return {
    id: row.id,
    cat: row.category || "side",
    uni: row.university || "nyu",
    title: row.name || "",
    blurb: row.tagline || "",
    about: row.description || "",
    rot: row.rot || "-2deg",
    pinType: row.pin_type || "tape",
    flyerColor: row.flyer_color || "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    roles: Array.isArray(row.roles) ? row.roles : [],
    // People who actually JOINED — excludes the owner, who LEADS the project
    // rather than joining it. So a solo, freshly-pinned project is 0 joined.
    joinedCount: crew.length,
    // Trigger-maintained total from projects.view_count (see migration
    // 20260609000000). Server-computed — deliberately absent from toDbProject.
    views: row.view_count || 0,
    ownerId: row.owner_id || null,
    ownerName: leadId.name,
    admins: Array.isArray(row.admins) && row.admins.length
      ? row.admins
      : (row.owner_id ? [row.owner_id] : []),
    lead: { name: leadId.name, handle: leadId.handle, role: "Project lead", bio: "", userId: row.owner_id || null, image: leadId.image },
    // memberId = the team_members row id, so owner actions that target the
    // row itself (kick) don't have to re-query by project+user.
    team: crew.map((m) => {
      const id = memberIdentity(m, { fallback: "Member" });
      return { name: id.name, handle: id.handle, role: m.role || "Member", userId: m.user_id || null, memberId: m.id || null, image: id.image };
    }),
    event: row.timeline || "",
    place: row.place || "",
    stage: row.stage || "",
    commitment: row.commitment || "",
    communicationLink: row.communication_link || "",
    status: row.status || "idea",
    alert: row.alert || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Build the team_members row for the creator so getProject's team join + the
// joinedCount derivation include the lead. Owner adds self as 'approved'
// (allowed by the team_members RLS "project owner can add members" branch).
export function creatorTeamMember(profile, ownerId) {
  // Snapshot the lead's first photo so the optimistic post-create render — and any
  // consumer reading this row without the embedded profiles join — shows their pfp.
  const firstPhoto = profile && profile.photos && profile.photos[0];
  const photoUrl = (firstPhoto && (firstPhoto.src || firstPhoto)) || null;
  // Username-led snapshot, same rule as the join-request snapshot
  // (personLabel): "@handle" → full name → "Lead". Never persists the old
  // "you" placeholder that used to leak "led by you" to every viewer.
  return {
    user_id: ownerId,
    name: personLabel(profile, "Lead"),
    school: (profile && profile.uni) || null,
    role: "Project lead",
    image: photoUrl,
    status: "approved",
  };
}
