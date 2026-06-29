/* ============================================================
   NESTED NYC — People ranking (who surfaces first in Browse)

   Pure, side-effect-free ordering for the People → Browse grid. Ranks raw
   Supabase `profiles` rows relative to the signed-in viewer so the most
   collaboration-relevant students rise to the top. NestedApp calls rankPeople()
   on the raw rows BEFORE mapping them through toPerson (raw rows carry the exact
   university / skills / fields that the card shape normalises away).

   Two halves make up a person's score:
     • COMPLETENESS— how fleshed-out their profile is. LEADS the score, and
                     within it PHOTOS matter most, then BIO, then SKILLS.
     • RELEVANCE   — how well they match the viewer (same campus, shared skills &
                     interests, similar "building" goal, same major). Personalises
                     the order within similarly-complete profiles.

   Recency is the tiebreak and comes for free: getAllProfiles returns rows
   newest-first, and we sort stably, so equally-scored people keep that order.
   ============================================================ */

// ---- tunable weights -------------------------------------------------------
// Top-level split. completeness > relevance, so the most fleshed-out profiles
// lead (photos > bio > skills); relevance personalises within similar tiers.
const W = { completeness: 0.6, relevance: 0.4 };

// Relevance sub-weights (sum ~1): campus first, then the skill/interest overlap
// that signals "same world", with major and free-text "building" as light nudges.
const REL = { university: 0.34, skills: 0.28, interests: 0.24, major: 0.08, building: 0.06 };

// Completeness sub-weights (sum ~1): photos dominate, then bio, then skills —
// the product call for what makes a profile worth surfacing.
const COMP = { photos: 0.55, bio: 0.30, skills: 0.15 };

// Words too generic to count as a shared "building" signal.
const BUILDING_STOP = new Set([
  'the', 'and', 'for', 'with', 'app', 'that', 'this', 'from', 'your', 'our',
  'build', 'building', 'project', 'projects', 'platform', 'tool', 'tools',
  'using', 'make', 'making', 'want', 'looking', 'team', 'idea', 'something',
]);

const arr = (v) => (Array.isArray(v) ? v : []);
const norm = (s) => String(s == null ? '' : s).trim().toLowerCase();

// University reads from either shape: raw rows carry `university`, the viewer's
// cork-board profile (fromDbProfile) carries `uni`. skills/fields/major/building
// share names across both shapes, so only this one needs reconciling.
const uniOf = (o) => norm(o && (o.university || o.uni));

// Fraction of the VIEWER's values that this person also has (0..1). Anchored on
// the viewer's set so it answers "how many of MY skills do they share?" — a
// person with a huge skill list doesn't get a free boost. 0 when the viewer has
// none of that field filled in (relevance just leans on the other signals).
function overlapRatio(viewerVals, personVals) {
  const mine = new Set(arr(viewerVals).map(norm).filter(Boolean));
  if (mine.size === 0) return 0;
  const theirs = new Set(arr(personVals).map(norm).filter(Boolean));
  let hits = 0;
  for (const v of mine) if (theirs.has(v)) hits += 1;
  return hits / mine.size;
}

function buildingTokens(s) {
  return new Set(
    norm(s)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !BUILDING_STOP.has(w))
  );
}

// Token overlap of two free-text "building" blurbs, anchored on the viewer's
// tokens (same logic as overlapRatio, but tokenised first).
function buildingOverlap(viewerBuilding, personBuilding) {
  const mine = buildingTokens(viewerBuilding);
  if (mine.size === 0) return 0;
  const theirs = buildingTokens(personBuilding);
  let hits = 0;
  for (const w of mine) if (theirs.has(w)) hits += 1;
  return hits / mine.size;
}

// 0..~1 — how well this person matches the viewer. Guards every field so a
// half-filled profile (theirs or the viewer's) simply contributes less.
function relevanceScore(row, viewer) {
  if (!viewer) return 0;
  let s = 0;
  const ru = uniOf(row);
  const vu = uniOf(viewer);
  if (ru && vu && ru === vu) {
    s += REL.university;
  }
  s += REL.skills * overlapRatio(viewer.skills, row.skills);
  s += REL.interests * overlapRatio(viewer.fields, row.fields);
  if (row.major && viewer.major && norm(row.major) === norm(viewer.major)) {
    s += REL.major;
  }
  s += REL.building * buildingOverlap(viewer.building, row.building);
  return s;
}

// 0..1 — how complete the profile is. Photos > bio > skills.
function completenessScore(row) {
  const photos = arr(row.photos).filter((u) => typeof u === 'string' && u.length);
  const photoScore = Math.min(photos.length, 3) / 3;            // 0, .33, .67, 1

  const bioLen = String(row.bio || '').trim().length;
  const bioScore = bioLen ? Math.min(bioLen, 140) / 140 : 0;    // ramps to full at ~140 chars

  const skillCount = arr(row.skills).filter(Boolean).length;
  const skillScore = Math.min(skillCount, 4) / 4;               // full at 4+ skills

  return COMP.photos * photoScore + COMP.bio * bioScore + COMP.skills * skillScore;
}

// Combined 0..1 score for one candidate row relative to the viewer.
export function scorePerson(row, viewer) {
  return W.relevance * relevanceScore(row, viewer) + W.completeness * completenessScore(row);
}

/**
 * Order candidate profile rows best-first for the viewer. Pure: returns a new
 * array, never mutates the input. Stable — equally-scored people keep their
 * incoming order, so the newest-first order from getAllProfiles acts as the
 * recency tiebreak.
 * @param {Array<object>} rows  raw `profiles` rows (already filtered to students)
 * @param {object|null} viewer  the signed-in user's raw profile row
 * @returns {Array<object>} a new, ranked array of the same rows
 */
export function rankPeople(rows, viewer) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  return list
    .map((row, i) => ({ row, i, score: scorePerson(row, viewer) }))
    .sort((a, b) => b.score - a.score || a.i - b.i) // score desc, then stable by input order
    .map((d) => d.row);
}

export default rankPeople;
