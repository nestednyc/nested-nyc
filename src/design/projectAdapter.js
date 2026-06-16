/* ============================================================
   NESTED NYC — Project adapter (Supabase ⇄ cork-board)

   Pure transformation between the cork-board project shape used by
   src/design/* (create.jsx / edit.jsx / detail.jsx / discover.jsx) and the
   snake_case `projects` row Supabase stores. No service calls in this file.
   ============================================================ */

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

// Identity for a single `team_members` row that carries an embedded `profiles`
// join (the shape pending join-request reads use). Prefers the LIVE profile
// over the denormalised snapshot the row captured at request time, so a
// requester who only ever had a username — and was snapshotted as the literal
// "Team Member" placeholder — renders as their @handle instead.
//   name   = live full name → "@username" → row.name snapshot → "Team Member"
//   handle = the requester's current username (for an @-mention line)
//   image  = live first photo / avatar → row.image snapshot
export function requestIdentity(row) {
  const pr = (row && row.profiles) || null;
  const full = pr ? ((pr.first_name || "") + " " + (pr.last_name || "")).replace(/\s+/g, " ").trim() : "";
  const handle = (pr && pr.username) || "";
  const photo = pr && ((Array.isArray(pr.photos) && pr.photos[0]) || pr.avatar);
  return {
    name: full || (handle ? "@" + handle : "") || (row && row.name) || "Team Member",
    handle,
    image: photo || (row && row.image) || null,
  };
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
  // A live name from the embedded profiles join (preferred — always current),
  // collapsing the trailing/double whitespace some first/last fields carry.
  const liveName = (m) => {
    const pr = m && m.profiles;
    if (!pr) return "";
    const full = ((pr.first_name || "") + " " + (pr.last_name || "")).replace(/\s+/g, " ").trim();
    return full || pr.username || "";
  };
  // Older creates persisted the literal placeholder "you" as a name (when the
  // creator had no username yet). Never show it — treat it as empty.
  const notYou = (s) => (s && s.trim().toLowerCase() === "you" ? "" : (s || ""));
  // Prefer the live profile name; fall back to the denormalised snapshots
  // (author_name, then the team_members row), then a neutral "Lead".
  const leadName = liveName(ownerMember) || notYou(row.author_name) || notYou(ownerMember && ownerMember.name) || "Lead";
  // Avatar for a team_members row. Prefer the member's first live profile photo
  // (via the embedded `profiles` join); fall back to the denormalised
  // team_members.image snapshot taken at request/create time.
  const memberPhoto = (m) => {
    if (!m) return null;
    const pr = m.profiles;
    if (pr) {
      if (Array.isArray(pr.photos) && pr.photos[0]) return pr.photos[0];
      if (pr.avatar) return pr.avatar;
    }
    return m.image || null;
  };
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
    ownerName: leadName,
    admins: Array.isArray(row.admins) && row.admins.length
      ? row.admins
      : (row.owner_id ? [row.owner_id] : []),
    lead: { name: leadName, role: "Project lead", bio: "", userId: row.owner_id || null, image: memberPhoto(ownerMember) },
    // memberId = the team_members row id, so owner actions that target the
    // row itself (kick) don't have to re-query by project+user.
    team: crew.map((m) => ({ name: liveName(m) || notYou(m.name) || "Member", role: m.role || "Member", userId: m.user_id || null, memberId: m.id || null, image: memberPhoto(m) })),
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
  // Build a real display name; NEVER persist the old "you" placeholder, which
  // leaked into the DB and showed every viewer "led by you".
  const fullName = profile ? ((profile.firstName || "") + " " + (profile.lastName || "")).replace(/\s+/g, " ").trim() : "";
  return {
    user_id: ownerId,
    name: (profile && profile.username) || fullName || "Lead",
    school: (profile && profile.uni) || null,
    role: "Project lead",
    image: photoUrl,
    status: "approved",
  };
}
