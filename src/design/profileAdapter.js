/* ============================================================
   NESTED NYC — Profile adapter (Supabase ⇄ cork-board)

   Pure transformation between the cork-board profile shape used
   by src/design/* and the snake_case profiles row that Supabase
   stores. No service calls in this file.
   ============================================================ */

// Normalise links into the {github, portfolio, linkedin, discord} object shape.
// Cork-board profile.jsx already prefers the object shape; this helper covers
// legacy localStorage entries that still use the [{kind, label}] array shape.
export function linksToObject(maybeLinks) {
  if (!maybeLinks) return {};
  if (Array.isArray(maybeLinks)) {
    const obj = {};
    maybeLinks.forEach((l) => {
      if (l && l.kind && l.kind !== "email" && l.label) obj[l.kind] = l.label;
    });
    return obj;
  }
  return maybeLinks;
}

// Cork-board profile → Supabase profiles row payload (snake_case).
// Pass the row to profileService.upsertProfile(userId, payload).
export function toDbProfile(local, userId) {
  const photos = (local.photos || [])
    .map((slot) => {
      if (!slot) return null;
      if (typeof slot === "string") return slot; // already a URL
      return slot.src || null;                   // {src, file?} shape
    })
    .filter((u) => typeof u === "string" && u.length > 0 && !u.startsWith("data:"));
  // dataURLs aren't valid storage URLs — they should have been uploaded already.

  return {
    id: userId,
    username: local.username || null,
    first_name: local.firstName || null,
    last_name: local.lastName || null,
    university: local.uni || null,
    major: local.major || null,
    bio: local.bio || null,
    photos,
    fields: local.fields || local.interests || [],
    skills: local.skills || [],
    year: local.year || null,
    building: local.building || null,
    availability: local.availability || local.avail || null,
    links: linksToObject(local.links),
    onboarding_completed: true,
  };
}

// Supabase profiles row → cork-board profile shape (camelCase).
// Carries created_at along as joinedAt so the rail-card stat still works.
export function fromDbProfile(row, fallbackEmail) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username || "",
    firstName: row.first_name || "",
    lastName: row.last_name || "",
    uni: row.university || "",
    major: row.major || "",
    bio: row.bio || "",
    photos: (row.photos || []).map((url) => ({ src: url })),
    fields: row.fields || [],
    skills: row.skills || [],
    year: row.year || "",
    building: row.building || "",
    availability: row.availability || "",
    links: linksToObject(row.links),
    email: fallbackEmail || row.email || "",
    joinedAt: row.created_at ? new Date(row.created_at).getTime() : null,
    onboardingCompleted: !!row.onboarding_completed,
  };
}

// Convert a JPEG/PNG dataURL into a File ready for Supabase Storage upload.
// Used by the photo editor when a slot was just resized via canvas.
export async function dataUrlToFile(dataUrl, filename = "photo.jpg") {
  if (!dataUrl || !dataUrl.startsWith("data:")) return null;
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
