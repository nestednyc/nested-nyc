/* ============================================================
   The community demo cast + SQL builder, shared by the two seed
   runners: seed-community-demo.mjs (local Docker stack, full cast)
   and seed-staging-community.mjs (hosted staging project,
   community-only — no mock projects). Data + pure SQL text only;
   no I/O here.
   ============================================================ */
import { createHash } from 'node:crypto';

export const PASSWORD = 'Passw0rd!';

// ---- the cast ---------------------------------------------------------------
const STUDENTS = [
  { email: 'ada@nyu.edu',             username: 'ada_nyu',      first: 'Ada',   last: 'Lovelace', uni: 'nyu',          major: 'Computer Science', year: "'27", img: 47, bio: 'Shipping small tools for students. Currently: a study-room finder.', skills: ['React', 'Postgres', 'Figma'] },
  { email: 'maya.chen@newschool.edu', username: 'maya_chen',    first: 'Maya',  last: 'Chen',     uni: 'new-school',   major: 'Design',           year: "'27", img: 44, bio: 'Building tools for student designers.', skills: ['UI/UX', 'Product Design'] },
  { email: 'jake.r@columbia.edu',     username: 'jake_r',       first: 'Jake',  last: 'Ramirez',  uni: 'columbia',     major: 'Economics',        year: "'26", img: 12, bio: 'Data + campus logistics.', skills: ['Python', 'SQL'] },
  { email: 'priya.s@baruch.cuny.edu', username: 'priya_builds', first: 'Priya', last: 'Shah',     uni: 'cuny',         major: 'Marketing',        year: "'26", img: 32, bio: 'Mapping every bodega in Queens.', skills: ['Research', 'Maps'] },
  { email: 'leo.m@pratt.edu',         username: 'leo_draws',    first: 'Leo',   last: 'Martins',  uni: 'pratt',        major: 'Illustration',     year: "'28", img: 15, bio: 'Sketchbooks and screen prints.', skills: ['Illustration', 'Print'] },
  { email: 'sam.k@fordham.edu',       username: 'samk',         first: 'Sam',   last: 'Kim',      uni: 'fordham',      major: 'Film',             year: "'26", img: 60, bio: 'Docs about the city.', skills: ['Editing', 'Sound'] },
  { email: 'nia.o@nyu.edu',           username: 'nia_o',        first: 'Nia',   last: 'Okafor',   uni: 'nyu',          major: 'Music Technology', year: "'27", img: 49, bio: 'Field recordings + synths.', skills: ['Ableton', 'Max/MSP'] },
  { email: 'theo.b@cooper.edu',       username: 'theo_b',       first: 'Theo',  last: 'Brandt',   uni: 'cooper-union', major: 'Engineering',      year: "'28", img: 53, bio: 'Makes machines out of other machines.', skills: ['CAD', 'Arduino'] },
];

const ORGS = [
  { email: 'hello@nyudevs.club',        slug: 'nyu-devs',           name: 'NYU Devs',                   uni: 'nyu',        logo: 'nyudevs',   location: 'Bobst Library, 5th floor', bio: "NYU's builder collective — weekly hack nights, demo days, and the occasional 3am deploy.", links: [{ kind: 'instagram', url: 'https://instagram.com/nyudevs' }, { kind: 'site', url: 'https://nyudevs.club' }] },
  { email: 'team@columbiabuildlab.org', slug: 'columbia-build-lab', name: 'Columbia Build Lab',         uni: 'columbia',   logo: 'buildlab',  location: 'Uris Hall 301',            bio: '8-week build cohorts for Columbia students. Real users by week 6.', links: [{ kind: 'site', url: 'https://columbiabuildlab.org' }] },
  { email: 'crew@newschoolfilm.org',    slug: 'new-school-film',    name: 'New School Film Collective', uni: 'new-school', logo: 'nsfilm',    location: '66 W 12th St',             bio: 'Student crews for student films. Shorts, docs, the weird stuff in between.', links: [{ kind: 'instagram', url: 'https://instagram.com/newschoolfilm' }] },
  { email: 'hi@cunyfounders.org',       slug: 'cuny-founders',      name: 'CUNY Founders',              uni: 'cuny',       logo: 'cunyf',     location: 'Baruch Vertical Campus',   bio: 'Founders across all 25 CUNY campuses. Dinners, pitch nights, no gatekeeping.', links: [{ kind: 'site', url: 'https://cunyfounders.org' }] },
  { email: 'studio@prattmakers.org',    slug: 'pratt-makers',       name: 'Pratt Makers',               uni: 'pratt',      logo: 'prattmk',   location: 'Engineering Building, Pratt', bio: 'Shared shop for anyone at Pratt who builds physical things.', links: [] },
];

const PROJECTS = [
  { key: 'critcircle',  owner: 'maya.chen@newschool.edu', name: 'Crit Circle — peer critique for student portfolios', tagline: 'Sunday portfolio reviews, 9 people, no mercy.', category: 'personal', uni: 'new-school', stage: 'active-sprint', views: 212 },
  { key: 'ledger',      owner: 'jake.r@columbia.edu',     name: 'Ledger — which dining hall is actually open',        tagline: 'Campus dining hours that tell the truth.',   category: 'startup',  uni: 'columbia',   stage: 'mvp',           views: 340, roles: [{ title: 'Data scraper', note: 'Python', open: true }] },
  { key: 'bodegaindex', owner: 'priya.s@baruch.cuny.edu', name: 'Bodega Index — mapping every bodega in Queens',      tagline: '130 bodegas, one coffee price map.',        category: 'research', uni: 'cuny',       stage: 'active-sprint', views: 158 },
  { key: 'subwaysounds',owner: 'nia.o@nyu.edu',           name: 'Subway Sounds — a field-recording archive of the MTA', tagline: 'The 7 train at 5pm is a genre.',           category: 'music',    uni: 'nyu',        stage: 'recruiting',    views: 401, roles: [{ title: 'Sound designer', note: 'Ableton or Max/MSP', open: true }, { title: 'Web dev', note: 'the archive site', open: true }] },
];

// hoursAgo → created_at; images = picsum seeds; kind = update (default) | win | ask
const POSTS = [
  { key: 'p01', org: 'nyu-devs',           h: 3,   body: "Hack night #12 is Thursday 7pm, Bobst 5th floor. Bring a laptop and a problem. Pizza's on us 🍕", imgs: ['hacknight1'] },
  { key: 'p02', kind: 'win', student: 'ada@nyu.edu',    h: 5,   body: "Shipped the first version of the study-room finder tonight. Ugly, but it works.", imgs: ['studyroom'] },
  { key: 'p03', kind: 'ask', org: 'columbia-build-lab', h: 9,   body: "Applications for the fall cohort are open. 8 weeks, 10 teams, real users by week 6. Link on our page.", imgs: ['cohort'] },
  { key: 'p04', kind: 'update', student: 'maya.chen@newschool.edu', h: 14, body: "Week 3 of Crit Circle — 9 portfolios reviewed, 2 people got interviews. Next round Sunday.", imgs: ['crit1', 'crit2'], project: 'critcircle' },
  { key: 'p05', kind: 'ask', org: 'new-school-film',    h: 20,  body: "Short film crew call: we need a sound person + a gaffer for a 2-day shoot in Bushwick, Sept 20–21. DM us.", imgs: ['filmset1', 'filmset2'] },
  { key: 'p06', kind: 'ask', student: 'jake.r@columbia.edu', h: 26, body: "Anyone at Columbia doing anything with campus dining data? Trying to build a 'which dining hall is actually open right now' thing.", imgs: [], project: 'ledger' },
  { key: 'p07', org: 'nyu-devs',           h: 31,  body: "Demo day recap: 14 teams, 3 hours, one very confused campus security guard. Photos from the night ↓", imgs: ['demo1', 'demo2', 'demo3', 'demo4'] },
  { key: 'p08', kind: 'win', student: 'priya.s@baruch.cuny.edu', h: 40, body: "Bodega Index update: 130 bodegas mapped in Queens. Coffee prices range from $1 to $4.50 within four blocks.", imgs: ['bodega'], project: 'bodegaindex' },
  { key: 'p09', kind: 'ask', org: 'cuny-founders',      h: 47,  body: "First founder dinner of the semester — 12 seats, Baruch Vertical Campus. Reply if you're building something and want a table of people who get it.", imgs: ['dinner'] },
  { key: 'p10', student: 'leo.m@pratt.edu', h: 55, body: "Sketchbook dump from the last two weeks.", imgs: ['sk1', 'sk2', 'sk3', 'sk4'] },
  { key: 'p11', org: 'pratt-makers',       h: 62,  body: "Laser cutter is back online 🎉 Open studio hours Tue/Thu 4–8.", imgs: ['laser'] },
  { key: 'p12', student: 'sam.k@fordham.edu', h: 70, body: "Rough cut of the doc is done. 22 minutes. Screening in the Lincoln Center basement Friday if anyone wants to tear it apart.", imgs: ['doc'] },
  { key: 'p13', org: 'columbia-build-lab', h: 80,  body: "Office hours this week with a YC founder (W24). Sign-up sheet on the board outside Uris 301.", imgs: [] },
  { key: 'p14', kind: 'win', student: 'nia.o@nyu.edu',  h: 92,  body: "Subway Sounds got its first 100 recordings! The 7 train at 5pm is a genre.", imgs: ['subway'], project: 'subwaysounds' },
  { key: 'p15', org: 'cuny-founders',      h: 110, body: "Recap: 40 people showed up to the CUNY-wide pitch night. Winners below 👇", imgs: ['pitch1', 'pitch2', 'pitch3'] },
  { key: 'p16', kind: 'win', student: 'theo.b@cooper.edu', h: 125, body: "Built a plotter out of two old printers. It draws… slowly.", imgs: ['plotter1', 'plotter2'] },
  { key: 'p17', kind: 'ask', student: 'ada@nyu.edu',    h: 150, body: "Looking for a cofounder-ish person for the study-room thing. Not a startup. Just two people who like shipping.", imgs: [] },
  { key: 'p18', org: 'nyu-devs',           h: 180, body: "Welcome week photos. If you signed the sheet, you're on the mailing list — first hack night is next Thursday.", imgs: ['welcome1', 'welcome2'] },
  { key: 'p19', kind: 'ask', student: 'maya.chen@newschool.edu', h: 200, body: "The New School design fair is Oct 3 — who's showing?", imgs: [] },
  { key: 'p20', org: 'new-school-film',    h: 230, body: "Our spring shorts are finally online. Six films, all made by students, all under 10 minutes.", imgs: ['shorts'] },
];

// who liked / commented / saved what (emails)
const S = (i) => STUDENTS[i].email;
const LIKES = {
  p01: [S(0), S(1), S(6), S(7)], p02: [S(1), S(2), S(6)], p03: [S(2), S(0)], p04: [S(0), S(4), S(5), S(6), S(7)],
  p05: [S(5), S(1)], p07: [S(0), S(1), S(2), S(3), S(4), S(5), S(6), S(7)], p08: [S(0), S(2), S(3)], p09: [S(3), S(2)],
  p10: [S(0), S(1), S(5), S(7)], p11: [S(4), S(7)], p12: [S(1), S(4)], p14: [S(0), S(1), S(2), S(3), S(4)], p15: [S(3), S(2), S(0)],
  p16: [S(0), S(4), S(6)], p18: [S(6)], p20: [S(5), S(1), S(4)],
};
const COMMENTS = {
  p01: [[S(6), "Bringing the synth."], [S(0), "Is the 5th floor the one with the working outlets?"]],
  p02: [[S(1), "Ship it ugly. Fix it Tuesday."]],
  p04: [[S(4), "Can non-designers come to watch?"], [S(1), "Yes — bring snacks."]],
  p07: [[S(2), "The security guard deserves a plaque."]],
  p08: [[S(0), "$4.50 for bodega coffee is a crime."]],
  p14: [[S(7), "Need a recording of the G train doing nothing for 20 minutes."]],
  p15: [[S(3), "Congrats to everyone who pitched!"]],
  p16: [[S(1), "@ada_nyu this is the plotter I told you about"]],
};
const SAVES = { [S(0)]: ['p07', 'p04', 'p14'], [S(1)]: ['p05'], [S(2)]: ['p03', 'p09'] };
const FOLLOWS = {
  [S(0)]: ['nyu-devs', 'columbia-build-lab', 'cuny-founders'],
  [S(1)]: ['new-school-film', 'nyu-devs'],
  [S(2)]: ['columbia-build-lab', 'cuny-founders'],
  [S(3)]: ['cuny-founders', 'nyu-devs'],
  [S(4)]: ['pratt-makers', 'new-school-film'],
  [S(5)]: ['new-school-film'],
  [S(6)]: ['nyu-devs'],
  [S(7)]: ['pratt-makers', 'nyu-devs'],
};


// ---- helpers ----------------------------------------------------------------
export const q = (v) => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
export const uuid = (key) => { const h = createHash('md5').update('nested-demo:' + key).digest('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`; };
export const uid = (email) => `(SELECT id FROM auth.users WHERE email = ${q(email)})`;
export const orgId = (slug) => `(SELECT id FROM public.organizations WHERE slug = ${q(slug)})`;
// Self-contained images: deterministic inline SVGs (no picsum/pravatar —
// external placeholder hosts are flaky and rendered as broken "?" tiles).
const PALETTE = [['#c96342','#f0eee5'],['#7d9b76','#f5efe0'],['#8a7ba8','#efe9dc'],
  ['#b98a4e','#f4ede1'],['#5f7f99','#eee9df'],['#a85f5f','#f3ece2']];
const hashN = (str) => [...String(str)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const svgUri = (svg) => 'data:image/svg+xml,' + encodeURIComponent(svg.replace(/\s+/g, ' ').trim());
export const pic = (seed, w = 900, h = 700) => {
  const [bg, fg] = PALETTE[hashN(seed) % PALETTE.length];
  const r = Math.min(w, h) / 3.2, cx = w * (0.3 + (hashN(seed + 'x') % 40) / 100), cy = h * (0.32 + (hashN(seed + 'y') % 36) / 100);
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${bg}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fg}" opacity="0.85"/>
    <rect x="0" y="${h * 0.72}" width="${w}" height="${h * 0.28}" fill="${fg}" opacity="0.35"/>
  </svg>`);
};
export const avatar = (n) => {
  const [bg, fg] = PALETTE[hashN('av' + n) % PALETTE.length];
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="${bg}"/>
    <circle cx="100" cy="78" r="36" fill="${fg}"/>
    <ellipse cx="100" cy="172" rx="62" ry="46" fill="${fg}"/>
  </svg>`);
};
export const arr = (xs) => `ARRAY[${xs.map(q).join(',')}]::text[]`;


export { STUDENTS, ORGS, PROJECTS, POSTS, LIKES, COMMENTS, SAVES, FOLLOWS };

// Tables whose USER triggers get bypassed while raw demo rows go in.
const GUARDED_TABLES = ['profiles', 'organizations', 'events', 'posts'];

/** Create-or-confirm one auth user through the admin REST API (works the
    same against the local stack and a hosted project). */
export async function ensureUser(API, SR, email, meta, password = PASSWORD) {
  const res = await fetch(`${API}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: meta }),
  });
  if (res.ok) { console.log(`  created ${email}`); return; }
  const body = await res.text();
  if (res.status === 422 || /already.*registered|email_exists|already been registered/i.test(body)) { console.log(`  exists  ${email}`); return; }
  throw new Error(`admin create ${email} failed: ${res.status} ${body}`);
}

/** The full idempotent seed as one SQL script.
    guardMode: 'replica' (local, superuser) | 'disable-triggers' (hosted).
    includeProjects: false = community-page data only (no Discover flyers).
    includeStudents: false = clubs only — org posts/events/spotlight, no fake
    student identities, no likes/comments/saves/follows (all student actions);
    implies includeProjects: false (student-owned projects need owners). */
export function buildSeedSql({ guardMode = 'replica', includeProjects = true, includeStudents = true } = {}) {
if (!includeStudents) includeProjects = false;
const allEmails = [...STUDENTS.map((s) => s.email), ...ORGS.map((o) => o.email)];
const sql = [];
sql.push(`BEGIN;`);
// wipe previous demo rows FIRST, with triggers on — FK cascades are triggers
// too, so a delete under replica mode would strand likes/comments/RSVPs.
sql.push(`DELETE FROM public.post_comments WHERE author_id IN (SELECT id FROM auth.users WHERE email IN (${allEmails.map(q).join(',')}));`);
sql.push(`DELETE FROM public.post_likes WHERE user_id IN (SELECT id FROM auth.users WHERE email IN (${allEmails.map(q).join(',')}));`);
sql.push(`DELETE FROM public.post_saves WHERE user_id IN (SELECT id FROM auth.users WHERE email IN (${allEmails.map(q).join(',')}));`);
sql.push(`DELETE FROM public.posts WHERE author_id IN (SELECT id FROM auth.users WHERE email IN (${allEmails.map(q).join(',')}));`);
sql.push(`DELETE FROM public.org_follows WHERE user_id IN (SELECT id FROM auth.users WHERE email IN (${allEmails.map(q).join(',')}));`);
sql.push(`DELETE FROM public.notifications WHERE user_id IN (SELECT id FROM auth.users WHERE email IN (${allEmails.map(q).join(',')})) OR actor_id IN (SELECT id FROM auth.users WHERE email IN (${allEmails.map(q).join(',')}));`);
sql.push(`DELETE FROM public.reports WHERE reporter_id IN (SELECT id FROM auth.users WHERE email IN (${allEmails.map(q).join(',')}));`);
sql.push(`DELETE FROM public.events WHERE organizer_id IN (SELECT id FROM auth.users WHERE email IN (${ORGS.map((o) => q(o.email)).join(',')}));`);
sql.push(`DELETE FROM public.projects WHERE owner_id IN (SELECT id FROM auth.users WHERE email IN (${STUDENTS.map((s) => q(s.email)).join(',')}));`);
// orphans left by earlier replica-mode wipes (RSVPs whose event is gone)
sql.push(`DELETE FROM public.event_registrations r WHERE NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = r.event_id);`);
sql.push(`DELETE FROM public.post_comments c WHERE NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = c.post_id);`);
sql.push(`DELETE FROM public.post_likes l WHERE NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = l.post_id);`);

// now seed as DATA, not as user actions (rate limiters + first-post flags off)
if (guardMode === 'replica') {
  sql.push(`SET LOCAL session_replication_role = replica;`);
} else {
  // Hosted Postgres: `postgres` isn't superuser, so replica mode is out.
  // Disabling USER triggers on just these tables skips the same guards the
  // local path skips (rate limiters, verified-lock, is-first flag, photo
  // gate); FK integrity is system triggers, untouched.
  for (const t of GUARDED_TABLES) sql.push(`ALTER TABLE public.${t} DISABLE TRIGGER USER;`);
}

// students
for (const s of includeStudents ? STUDENTS : []) {
  sql.push(`UPDATE public.profiles SET onboarding_completed = TRUE, username = ${q(s.username)}, first_name = ${q(s.first)}, last_name = ${q(s.last)},
    university = ${q(s.uni)}, major = ${q(s.major)}, year = ${q(s.year)}, bio = ${q(s.bio)}, skills = ${arr(s.skills)},
    photos = ${arr([avatar(s.img)])}, avatar = ${q(avatar(s.img))}
    WHERE id = ${uid(s.email)};`);
}
// orgs (verified clubs parented to the seeded universities)
for (const o of ORGS) {
  sql.push(`INSERT INTO public.organizations (slug, name, type, university_id, owner_user_id, verified, location, bio, logo, links)
    VALUES (${q(o.slug)}, ${q(o.name)}, 'club', ${orgId(o.uni)}, ${uid(o.email)}, TRUE, ${q(o.location)}, ${q(o.bio)}, ${q(pic(o.logo, 200, 200))}, ${q(JSON.stringify(o.links))}::jsonb)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, university_id = EXCLUDED.university_id, owner_user_id = EXCLUDED.owner_user_id,
      verified = TRUE, location = EXCLUDED.location, bio = EXCLUDED.bio, logo = EXCLUDED.logo, links = EXCLUDED.links;`);
  // two events each: one upcoming, one past. NYU Devs' meetup asks attendees
  // three questions (the RSVP sheet + the host's responses table).
  const questions = o.slug === 'nyu-devs' ? JSON.stringify([
    { id: 'q_track', prompt: 'Which track are you coming for?', type: 'choice', options: ['Web', 'AI / ML', 'Hardware', 'Just curious'], required: true },
    { id: 'q_diet', prompt: 'Any dietary restrictions? (pizza night)', type: 'short', options: [], required: false },
    { id: 'q_bday', prompt: 'Birthday — we do cake for the month', type: 'date', options: [], required: false },
  ]) : '[]';
  sql.push(`INSERT INTO public.events (title, description, date, time, location, organizer_id, organizer_name, organization_id, event_type, attendees, is_past, questions)
    VALUES (${q(o.name + ' — open meetup')}, ${q('Come meet the crew. No experience needed.')}, '2026-09-18', '6:30 PM', ${q(o.location)}, ${uid(o.email)}, ${q(o.name)}, ${orgId(o.slug)}, 'talk', ${8 + Math.floor(Math.random() * 30)}, FALSE, ${q(questions)}::jsonb),
           (${q(o.name + ' — kickoff')}, ${q('Semester kickoff.')}, '2026-08-21', '7:00 PM', ${q(o.location)}, ${uid(o.email)}, ${q(o.name)}, ${orgId(o.slug)}, 'talk', ${20 + Math.floor(Math.random() * 40)}, TRUE, '[]'::jsonb);`);
}
// club spotlight: NYU Devs for the week (cleared on every other demo org)
sql.push(`UPDATE public.organizations SET spotlight_until = NULL WHERE slug IN (${ORGS.map((o) => q(o.slug)).join(',')});`);
sql.push(`UPDATE public.organizations SET spotlight_until = now() + interval '7 days' WHERE slug = 'nyu-devs';`);
// projects — the deploy/staging seed is community-only: no mock flyers on
// Discover, so asks render untagged there. (The DELETE above still clears
// previously seeded projects either way.)
for (const p of includeProjects ? PROJECTS : []) {
  const roles = p.roles ? JSON.stringify(p.roles) : '[]';
  sql.push(`INSERT INTO public.projects (id, name, tagline, description, category, university, author_name, owner_id, publish_to_discover, stage, status, pin_type, rot, view_count, admins, roles)
    VALUES (${q(uuid('proj:' + p.key))}, ${q(p.name)}, ${q(p.tagline)}, ${q(p.tagline)}, ${q(p.category)}, ${q(p.uni)}, ${q(STUDENTS.find((s) => s.email === p.owner).first)}, ${uid(p.owner)}, TRUE, ${q(p.stage)}, 'idea', 'tape', '-1.6deg', ${p.views}, ARRAY[${uid(p.owner)}::text], ${q(roles)}::jsonb);`);
}
// posts (clubs-only mode seeds just the org-authored ones)
for (const p of POSTS.filter((p) => includeStudents || p.org)) {
  const images = JSON.stringify(p.imgs.map((s) => pic(s)));
  if (p.org) {
    const o = ORGS.find((x) => x.slug === p.org);
    sql.push(`INSERT INTO public.posts (id, author_id, author_name, author_handle, author_avatar, body, images, university, org_id, kind, created_at)
      VALUES (${q(uuid('post:' + p.key))}, ${uid(o.email)}, ${q(o.name)}, '', ${q(pic(o.logo, 200, 200))}, ${q(p.body)}, ${q(images)}::jsonb, ${q(o.uni)}, ${orgId(o.slug)}, ${q(p.kind === 'ask' ? 'ask' : 'update')}, now() - interval '${p.h} hours');`);
  } else {
    const s = STUDENTS.find((x) => x.email === p.student);
    const proj = includeProjects && p.project ? q(uuid('proj:' + p.project)) : 'NULL';
    sql.push(`INSERT INTO public.posts (id, author_id, author_name, author_handle, author_avatar, body, images, university, project_id, kind, created_at)
      VALUES (${q(uuid('post:' + p.key))}, ${uid(s.email)}, ${q(s.first + ' ' + s.last)}, ${q(s.username)}, ${q(avatar(s.img))}, ${q(p.body)}, ${q(images)}::jsonb, ${q(s.uni)}, ${proj}, ${q(p.kind || 'update')}, now() - interval '${p.h} hours');`);
  }
}
// likes / comments / saves / follows — triggers back ON so the notification
// triggers fire (the bell has something to show) and counters keep themselves.
if (guardMode === 'replica') {
  sql.push(`SET LOCAL session_replication_role = DEFAULT;`);
} else {
  for (const t of GUARDED_TABLES) sql.push(`ALTER TABLE public.${t} ENABLE TRIGGER USER;`);
}
for (const [key, emails] of Object.entries(includeStudents ? LIKES : {})) for (const e of emails)
  sql.push(`INSERT INTO public.post_likes (post_id, user_id) VALUES (${q(uuid('post:' + key))}, ${uid(e)}) ON CONFLICT DO NOTHING;`);
for (const [key, list] of Object.entries(includeStudents ? COMMENTS : {})) list.forEach(([e, body], i) => {
  const s = STUDENTS.find((x) => x.email === e);
  sql.push(`INSERT INTO public.post_comments (post_id, author_id, author_name, author_handle, author_avatar, body, created_at)
    VALUES (${q(uuid('post:' + key))}, ${uid(e)}, ${q(s.first + ' ' + s.last)}, ${q(s.username)}, ${q(avatar(s.img))}, ${q(body)}, now() - interval '${i * 7 + 1} minutes');`);
});
for (const [e, keys] of Object.entries(includeStudents ? SAVES : {})) for (const k of keys)
  sql.push(`INSERT INTO public.post_saves (user_id, post_id) VALUES (${uid(e)}, ${q(uuid('post:' + k))}) ON CONFLICT DO NOTHING;`);
for (const [e, slugs] of Object.entries(includeStudents ? FOLLOWS : {})) for (const slug of slugs)
  sql.push(`INSERT INTO public.org_follows (user_id, org_id) VALUES (${uid(e)}, ${orgId(slug)}) ON CONFLICT DO NOTHING;`);

// counters were bypassed (replica mode) — derive them from the rows
sql.push(`UPDATE public.posts p SET like_count = (SELECT COUNT(*) FROM public.post_likes l WHERE l.post_id = p.id),
                                  comment_count = (SELECT COUNT(*) FROM public.post_comments c WHERE c.post_id = p.id);`);
sql.push(`COMMIT;`);


return sql.join('\n');
}
