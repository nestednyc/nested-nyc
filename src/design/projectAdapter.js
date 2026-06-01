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

// Supabase `projects` row (+ joined `team_members`) → cork-board project shape.
// Reproduces EXACTLY the object create.jsx builds, so ProjectCard / ProjectDetail
// render an API-backed project identically to a freshly-pinned one. Defaults are
// chosen so CAT[cat]/UNI[uni] and p.lead/p.team/p.roles never blow up the UI.
export function fromDbProject(row) {
  if (!row) return null;
  const members = Array.isArray(row.team_members) ? row.team_members : [];
  const ownerMember = members.find((m) => m.user_id === row.owner_id) || null;
  const crew = members.filter((m) => m.user_id !== row.owner_id);
  const leadName = row.author_name || (ownerMember && ownerMember.name) || "Lead";
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
    joinedCount: members.length || 1,
    ownerId: row.owner_id || null,
    ownerName: row.author_name || leadName,
    admins: Array.isArray(row.admins) && row.admins.length
      ? row.admins
      : (row.owner_id ? [row.owner_id] : []),
    lead: { name: leadName, role: "Project lead", bio: "", userId: row.owner_id || null },
    team: crew.map((m) => ({ name: m.name, role: m.role || "Member", userId: m.user_id || null })),
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
  return {
    user_id: ownerId,
    name: (profile && profile.username) || "you",
    school: (profile && profile.uni) || null,
    role: "Project lead",
    status: "approved",
  };
}
