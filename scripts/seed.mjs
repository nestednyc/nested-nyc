/* ============================================================================
 * Nested NYC — production demo seed
 * ----------------------------------------------------------------------------
 * Creates a rich, realistic mock dataset in the LIVE Supabase project so every
 * cork-board screen (Discover, People, Events, project detail, org pages) looks
 * alive, plus a sign-in-able demo account whose RLS-scoped data (saved / joined
 * / connections / RSVPs) is pre-wired.
 *
 * Why a Node script and not a SQL migration?
 *   profiles.id is FK'd to auth.users(id), and a trigger auto-creates a stub
 *   profile on signup. The only robust way to make real, log-in-able users is
 *   the GoTrue Auth Admin API (email_confirm:true → no emails sent to fake
 *   addresses). We then UPSERT each profile and bypass RLS for the rest via the
 *   service_role key.
 *
 * Credentials: read from the gitignored ../.env.seed. The token there is a
 * Supabase *Management API* PAT (sbp_…); we use it once to fetch the project's
 * service_role key in-memory. Nothing secret is written to disk by this script.
 *
 * Idempotent: a run first TEARS DOWN everything it previously created (by
 * deleting the seeded auth users — every seeded row hangs off one of them via
 * ON DELETE CASCADE) and then recreates from scratch. Re-run freely.
 *
 *   node scripts/seed.mjs          # teardown seeded data, then seed
 *   node scripts/seed.mjs --down   # teardown only (same as npm run unseed)
 *
 * It NEVER touches the 3 real pre-existing accounts or their projects.
 * ==========================================================================*/

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

/* ── config ──────────────────────────────────────────────────────────────*/
function loadEnvSeed() {
  const out = { ...process.env }
  try {
    const raw = readFileSync(path.join(ROOT, '.env.seed'), 'utf8')
    for (const line of raw.split('\n')) {
      const s = line.trim()
      if (!s || s.startsWith('#')) continue
      const i = s.indexOf('=')
      if (i === -1) continue
      out[s.slice(0, i).trim()] = s.slice(i + 1).trim()
    }
  } catch { /* fall back to process.env */ }
  return out
}

async function fetchServiceRoleKey(apiBase, ref, token) {
  const res = await fetch(`${apiBase}/v1/projects/${ref}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Management API ${res.status}: ${await res.text()}`)
  const keys = await res.json()
  const svc = keys.find((k) => k.name === 'service_role')
  if (!svc?.api_key || !svc.api_key.startsWith('eyJ')) {
    throw new Error('Could not retrieve service_role JWT (got: ' + JSON.stringify(keys.map((k) => k.name)) + ')')
  }
  return svc.api_key
}

/* ── tiny helpers ────────────────────────────────────────────────────────*/
const log = (...a) => console.log(...a)
async function must(label, p) {
  const { data, error } = await p
  if (error) throw new Error(`${label} → ${error.message || JSON.stringify(error)}`)
  return data
}
const pw = 'NestedDemo2026!' // shared demo password (mock data only)

const UNI_DOMAIN = {
  nyu: 'nyu.edu', columbia: 'columbia.edu', 'cooper-union': 'cooper.edu',
  'new-school': 'newschool.edu', cuny: 'cuny.edu', fordham: 'fordham.edu',
  pratt: 'pratt.edu', sva: 'sva.edu', pace: 'pace.edu', nyit: 'nyit.edu',
  juilliard: 'juilliard.edu', fit: 'fitnyc.edu', 'st-johns': 'stjohns.edu',
  yeshiva: 'yu.edu', barnard: 'barnard.edu', 'manhattan-college': 'manhattan.edu',
  liu: 'liu.edu', marymount: 'mmm.edu',
}
const portrait = (g, n) => `https://randomuser.me/api/portraits/${g}/${n}.jpg`

/* ── students (every account is a full student → all show in People) ───────*/
// key, name, uni, major, year, bio, fields[], skills[], building, avail, links, photo
const STUDENTS = [
  { key: 'maya', username: 'mayachen', first: 'Maya', last: 'Chen', uni: 'nyu', major: 'Computer Science', year: 'Junior',
    bio: 'Building AI tools that actually ship. Founder of the NYU AI Collective. Always down to pair on a weekend hack.',
    fields: ['Engineering', 'Product'], skills: ['Full Stack', 'ML/AI', 'Product'], building: 'an AI study companion', avail: 'Nights & weekends',
    links: { github: 'https://github.com/mayachen', linkedin: 'https://linkedin.com/in/mayachen', portfolio: 'https://maya.build' }, photo: portrait('women', 68) },
  { key: 'arjun', username: 'arjunp', first: 'Arjun', last: 'Patel', uni: 'nyu', major: 'Data Science', year: 'Senior',
    bio: 'Data + ML. Spent last summer at a fintech, now want to build my own thing. Strong on backend and pipelines.',
    fields: ['Data Science', 'Engineering'], skills: ['Backend', 'Data', 'ML/AI'], building: 'a markets dashboard', avail: '15–20 hrs/week',
    links: { github: 'https://github.com/arjunp', linkedin: 'https://linkedin.com/in/arjunpatel' }, photo: portrait('men', 32) },
  { key: 'sofia', username: 'sofiar', first: 'Sofia', last: 'Ramirez', uni: 'columbia', major: 'Computer Science', year: 'Junior',
    bio: 'Founder-y engineer. Run Columbia Build — demo nights and hackathons every week. Love a clean React codebase.',
    fields: ['Engineering', 'Product'], skills: ['Frontend', 'Full Stack', 'Strategy'], building: 'Columbia Build', avail: 'Flexible',
    links: { github: 'https://github.com/sofiar', linkedin: 'https://linkedin.com/in/sofiaramirez', portfolio: 'https://sofia.dev' }, photo: portrait('women', 44) },
  { key: 'devin', username: 'devinpark', first: 'Devin', last: 'Park', uni: 'nyu', major: 'Cognitive Science', year: 'Sophomore',
    bio: 'Cog sci + code. Fascinated by how people learn. Prototyping fast, breaking things faster.',
    fields: ['Research', 'Engineering'], skills: ['Frontend', 'Research', 'Data Analysis'], building: 'a spaced-repetition app', avail: 'Weekends',
    links: { github: 'https://github.com/devinpark' }, photo: portrait('men', 75) },
  { key: 'priya', username: 'priyanair', first: 'Priya', last: 'Nair', uni: 'columbia', major: 'Computer Science', year: 'Junior',
    bio: 'iOS + design systems. I like small teams and shipping on Fridays. Coffee-fueled.',
    fields: ['Engineering', 'Design'], skills: ['Mobile', 'UI/UX', 'Frontend'], building: 'a campus events app', avail: 'Nights',
    links: { github: 'https://github.com/priyanair', linkedin: 'https://linkedin.com/in/priyanair' }, photo: portrait('women', 12) },
  { key: 'marcus', username: 'marcuslee', first: 'Marcus', last: 'Lee', uni: 'pace', major: 'Computer Science', year: 'Senior',
    bio: 'Full-stack + a bit of growth. Shipped two side projects to a few thousand users. Looking for cofounders.',
    fields: ['Engineering', 'Business'], skills: ['Full Stack', 'DevOps', 'Growth'], building: 'a dorm marketplace', avail: '20+ hrs/week',
    links: { github: 'https://github.com/marcuslee', linkedin: 'https://linkedin.com/in/marcuslee' }, photo: portrait('men', 51) },
  { key: 'ana', username: 'anagomez', first: 'Ana', last: 'Gomez', uni: 'pratt', major: 'Design / Comm Design', year: 'Junior',
    bio: 'Product & brand designer. Figma is my second language. Care a lot about typography and tiny interactions.',
    fields: ['Design', 'Arts & Media'], skills: ['Product Design', 'UI/UX', 'Graphic Design'], building: 'a design portfolio tool', avail: 'Flexible',
    links: { portfolio: 'https://anagomez.design', linkedin: 'https://linkedin.com/in/anagomez' }, photo: portrait('women', 21) },
  { key: 'liam', username: 'liamob', first: 'Liam', last: "O'Brien", uni: 'nyu', major: 'Economics', year: 'Senior',
    bio: 'Non-technical founder, technical enough to be dangerous. Run NYC Student Founders. I find the people and the money.',
    fields: ['Business', 'Product'], skills: ['Strategy', 'BD', 'Sales'], building: 'NYC Student Founders', avail: 'Flexible',
    links: { linkedin: 'https://linkedin.com/in/liamobrien', portfolio: 'https://nycstudentfounders.com' }, photo: portrait('men', 86) },
  { key: 'hana', username: 'hanasuzuki', first: 'Hana', last: 'Suzuki', uni: 'new-school', major: 'Fine Arts', year: 'Junior',
    bio: 'Illustrator turned creative technologist. I make weird, beautiful web things. Parsons.',
    fields: ['Arts & Media', 'Design'], skills: ['Graphic Design', 'Content', 'Video'], building: 'an interactive zine', avail: 'Nights & weekends',
    links: { portfolio: 'https://hanasuzuki.art', instagram: 'https://instagram.com/hana.makes' }, photo: portrait('women', 33) },
  { key: 'raj', username: 'rajmehta', first: 'Raj', last: 'Mehta', uni: 'fordham', major: 'Business', year: 'Senior',
    bio: 'Operator. Ran ops for a campus delivery startup. Spreadsheets, growth loops, and getting things over the line.',
    fields: ['Business', 'Marketing'], skills: ['Strategy', 'Growth', 'Project Mgmt'], building: 'a class-scheduling tool', avail: '10–15 hrs/week',
    links: { linkedin: 'https://linkedin.com/in/rajmehta' }, photo: portrait('men', 64) },
  { key: 'bella', username: 'bellacruz', first: 'Bella', last: 'Cruz', uni: 'sva', major: 'Film / Media', year: 'Junior',
    bio: 'Filmmaker + motion designer. I tell stories and cut trailers. Looking for builders who care about craft.',
    fields: ['Arts & Media'], skills: ['Video', 'Content', 'Graphic Design'], building: 'a short doc series', avail: 'Weekends',
    links: { portfolio: 'https://bellacruz.film', instagram: 'https://instagram.com/bella.cuts' }, photo: portrait('women', 56) },
  { key: 'wei', username: 'weizhang', first: 'Wei', last: 'Zhang', uni: 'columbia', major: 'Math', year: 'Grad',
    bio: 'Applied math grad student. Optimization, a little ML theory. I like hard problems and whiteboards.',
    fields: ['Research', 'Data Science'], skills: ['Research', 'Data', 'ML/AI'], building: 'a research notes graph', avail: '10 hrs/week',
    links: { github: 'https://github.com/weizhang' }, photo: portrait('men', 41) },
  { key: 'jordan', username: 'jordankim', first: 'Jordan', last: 'Kim', uni: 'cooper-union', major: 'Mechanical Eng', year: 'Senior',
    bio: 'Hardware + CAD + a soft spot for civic tech. I prototype with my hands. Cooper Union.',
    fields: ['Engineering', 'Design'], skills: ['Product', 'Research', 'Product Design'], building: 'an air-quality sensor', avail: 'Flexible',
    links: { github: 'https://github.com/jordankim', portfolio: 'https://jordankim.cc' }, photo: portrait('men', 11) },
  { key: 'tomas', username: 'tomasvidal', first: 'Tomas', last: 'Vidal', uni: 'nyit', major: 'Computer Science', year: 'Sophomore',
    bio: 'Backend + infra nerd. Homelab enthusiast. I will containerize your weekend project.',
    fields: ['Engineering'], skills: ['Backend', 'DevOps', 'Full Stack'], building: 'a self-host dashboard', avail: 'Nights',
    links: { github: 'https://github.com/tomasvidal' }, photo: portrait('men', 3) },
  { key: 'zoe', username: 'zoewilliams', first: 'Zoe', last: 'Williams', uni: 'barnard', major: 'Cognitive Science', year: 'Junior',
    bio: 'Researcher studying attention + learning. Python, R, and a lot of reading. Barnard.',
    fields: ['Research', 'Data Science'], skills: ['Research', 'Data Analysis', 'Writing'], building: 'a focus-tracking study', avail: '10 hrs/week',
    links: { linkedin: 'https://linkedin.com/in/zoewilliams' }, photo: portrait('women', 90) },
  { key: 'noah', username: 'noahbrooks', first: 'Noah', last: 'Brooks', uni: 'pace', major: 'Marketing', year: 'Junior',
    bio: 'Growth + community. I run Pace Founders Hub. Good at getting a room full of people to show up.',
    fields: ['Marketing', 'Business'], skills: ['Growth', 'Marketing', 'Content'], building: 'Pace Founders Hub', avail: 'Flexible',
    links: { linkedin: 'https://linkedin.com/in/noahbrooks', instagram: 'https://instagram.com/noah.builds' }, photo: portrait('men', 22) },
  { key: 'amara', username: 'amaraokafor', first: 'Amara', last: 'Okafor', uni: 'fit', major: 'Marketing', year: 'Senior',
    bio: 'Fashion-tech founder energy. AR try-on, drops, and brand. FIT. I bridge creative and commerce.',
    fields: ['Marketing', 'Design'], skills: ['Marketing', 'Product Design', 'Strategy'], building: 'an AR try-on tool', avail: 'Nights & weekends',
    links: { linkedin: 'https://linkedin.com/in/amaraokafor', portfolio: 'https://amara.studio' }, photo: portrait('women', 79) },
  { key: 'kenji', username: 'kenjitanaka', first: 'Kenji', last: 'Tanaka', uni: 'nyu', major: 'Music Tech', year: 'Junior',
    bio: 'Music-tech builder. Audio DSP, MIDI, and web audio. I make instruments out of code.',
    fields: ['Arts & Media', 'Engineering'], skills: ['Full Stack', 'Product', 'Content'], building: 'a browser DAW', avail: 'Weekends',
    links: { github: 'https://github.com/kenjitanaka', portfolio: 'https://kenji.audio' }, photo: portrait('men', 97) },
]

// The sign-in-able demo account. Owns no org → lands on the cork-board.
const DEMO = {
  key: 'demo', username: 'demostudent', first: 'Demo', last: 'Student', uni: 'nyu', major: 'Computer Science', year: 'Junior',
  email: 'demo.student@nyu.edu',
  bio: "This is the demo account — log in here to see Nested as a student: saved projects, a team you've joined, connections, and event RSVPs are all pre-wired.",
  fields: ['Engineering', 'Product'], skills: ['Full Stack', 'Product', 'UI/UX'], building: 'exploring Nested', avail: 'Flexible',
  links: { github: 'https://github.com/nested-demo' }, photo: portrait('men', 5),
}

const emailFor = (s) => s.email || `${s.username}@${UNI_DOMAIN[s.uni] || 'nyu.edu'}`
const fullName = (s) => `${s.first} ${s.last}`
const ALL_PEOPLE = [...STUDENTS, DEMO]
const SEEDED_EMAILS = ALL_PEOPLE.map(emailFor)

/* ── clubs (each owned by a student founder) ───────────────────────────────*/
// slug, name, type, uni (→ university_id), ownerKey, bio, website, instagram, location
const CLUBS = [
  { slug: 'nyu-ai-collective', name: 'NYU AI Collective', type: 'club', uni: 'nyu', owner: 'maya',
    bio: 'A student-run collective at NYU building and shipping AI projects — research demos to weekend hacks. Every major welcome.',
    website: 'https://nyuai.club', instagram: 'nyu.ai', location: 'NYU Tandon, Brooklyn' },
  { slug: 'columbia-build', name: 'Columbia Build', type: 'club', uni: 'columbia', owner: 'sofia',
    bio: "Columbia's home for builders. Demo nights, hackathons, and founder office hours every week of term.",
    website: 'https://columbiabuild.org', instagram: 'columbia.build', location: 'Columbia SEAS, Morningside Heights' },
  { slug: 'nyc-student-founders', name: 'NYC Student Founders', type: 'other', uni: 'nyu', owner: 'liam',
    bio: 'A cross-campus community for student founders across NYC. Monthly mixers, pitch nights, and a Slack of 600+ builders.',
    website: 'https://nycstudentfounders.com', instagram: 'nyc.founders', location: 'Across NYC campuses' },
  { slug: 'pace-founders-hub', name: 'Pace Founders Hub', type: 'club', uni: 'pace', owner: 'noah',
    bio: 'Pace University’s hub for founders and builders. Pitch practice, demo days, and a tight community downtown.',
    website: 'https://pacefounders.org', instagram: 'pace.founders', location: 'Pace University, Lower Manhattan' },
]

/* ── projects ──────────────────────────────────────────────────────────────*/
// owner, cat, uni, title, blurb, about, stage, status, alert, timeline, place,
// commitment, tags[], roles[{title,note,open}], members[keys], pending[{key,msg}],
// flyerColor, pinType, rot
const HEX = ['#e07a3f', '#3f7be0', '#e0b93f', '#3fae6b', '#9b6cd1', '#d1607a', null, null]
const ROT = ['-2.2deg', '1.6deg', '-1deg', '2.4deg', '-1.8deg', '0.8deg', '-2.6deg', '1.2deg', '-0.6deg', '2deg', '-1.4deg', '1deg']
const PROJECTS = [
  { owner: 'maya', cat: 'startup', uni: 'nyu', title: 'StudySync', blurb: 'An AI study companion that turns your notes into quizzes.',
    about: 'StudySync ingests your lecture notes and slides and generates spaced-repetition quizzes, summaries, and a “explain it back to me” mode. Live with ~300 NYU students this term.',
    stage: 'recruiting', status: 'looking', alert: 'Onboarding our first 500 users this month — need a mobile dev!', timeline: 'Spring 2026, ongoing', place: 'NYU Tandon, Brooklyn',
    commitment: 'serious-build', tags: ['AI / ML', 'Ed tech', 'Consumer apps'],
    roles: [{ title: 'Mobile Engineer', note: 'React Native; own the iOS build', open: true }, { title: 'ML Engineer', note: 'RAG + eval pipeline', open: true }, { title: 'Product Designer', note: 'Figma → ship', open: false }],
    members: ['arjun', 'priya'], pending: [{ key: 'tomas', msg: 'Backend/infra here — I can own your deploy + scaling. Would love to help.' }] },
  { owner: 'sofia', cat: 'side', uni: 'columbia', title: 'BuildBoard', blurb: 'A live job board for student-startup roles across NYC.',
    about: 'BuildBoard aggregates open roles on student projects and startups across NYC campuses into one feed. Apply with your Nested profile in one click.',
    stage: 'mvp', status: 'in-progress', alert: 'MVP shipping this week.', timeline: '3-month build', place: 'Columbia, Morningside',
    commitment: 'side-project', tags: ['Consumer apps', 'Open source'],
    roles: [{ title: 'Frontend Engineer', note: 'Next.js + Tailwind', open: true }, { title: 'Growth', note: 'campus ambassadors', open: true }],
    members: ['wei'], pending: [] },
  { owner: 'liam', cat: 'startup', uni: 'nyu', title: 'GreenRoute', blurb: 'Carbon-aware routing for NYC delivery riders.',
    about: 'GreenRoute helps couriers and small delivery ops pick lower-emission, faster routes across the five boroughs. Pilot with two Brooklyn restaurants.',
    stage: 'idea', status: 'need-help', alert: 'Looking for an ML/routing engineer — this is the whole thing right now.', timeline: 'This summer', place: 'Brooklyn, NY',
    commitment: 'startup-mode', tags: ['Climate', 'Civic / NYC', 'Hardware'],
    roles: [{ title: 'Routing/ML Engineer', note: 'graph + optimization', open: true }, { title: 'iOS Engineer', note: 'rider app', open: true }, { title: 'Ops Lead', note: 'restaurant pilots', open: false }],
    members: ['raj'], pending: [{ key: 'jordan', msg: 'I build hardware + sensors and care about civic tech. Happy to prototype the rider device.' }] },
  { owner: 'marcus', cat: 'startup', uni: 'pace', title: 'DormDash', blurb: 'A peer marketplace for dorm move-in/move-out.',
    about: 'DormDash lets students buy, sell, and hand off furniture and fridges at semester boundaries without the Facebook-group chaos. Verified by .edu.',
    stage: 'active-sprint', status: 'mvp', alert: 'Move-out season in 3 weeks — sprinting hard.', timeline: 'Live now', place: 'Pace, Lower Manhattan',
    commitment: 'serious-build', tags: ['Consumer apps', 'Social impact'],
    roles: [{ title: 'Full-Stack Engineer', note: 'Supabase + React', open: true }, { title: 'Designer', note: 'marketplace UX', open: false }],
    members: ['tomas', 'priya'], pending: [] },
  { owner: 'bella', cat: 'side', uni: 'sva', title: 'InkWell', blurb: 'A collaborative tool for comic and zine makers.',
    about: 'InkWell is a lightweight canvas for laying out panels, sharing drafts, and collecting feedback. Built for the SVA illustration crowd.',
    stage: 'mvp', status: 'looking', alert: 'Want a frontend engineer who loves canvas/SVG.', timeline: 'Fall 2026 launch', place: 'SVA, Manhattan',
    commitment: 'side-project', tags: ['Creative tools', 'Consumer apps'],
    roles: [{ title: 'Frontend Engineer', note: 'canvas/SVG, fun stuff', open: true }, { title: 'Illustrator', note: 'design partner', open: false }],
    members: ['hana'], pending: [] },
  { owner: 'zoe', cat: 'research', uni: 'barnard', title: 'NeuroPlay', blurb: 'A research game studying attention and learning.',
    about: 'NeuroPlay is a browser game that doubles as an attention study. Anonymized data feeds a Barnard cog-sci lab. IRB-approved.',
    stage: 'recruiting', status: 'in-progress', alert: 'Recruiting players + a frontend dev for the game loop.', timeline: 'This semester', place: 'Barnard, Morningside',
    commitment: 'side-project', tags: ['Health', 'Games', 'AI / ML'],
    roles: [{ title: 'Game Engineer', note: 'JS/Canvas game loop', open: true }, { title: 'Data Analyst', note: 'study data', open: true }],
    members: ['wei', 'devin'], pending: [{ key: 'kenji', msg: 'I do web-audio + interactive stuff — could make the game feel alive. Want a hand?' }] },
  { owner: 'devin', cat: 'hack', uni: 'nyu', title: 'HackMatch', blurb: 'Find a hackathon team in 10 minutes, not 10 group chats.',
    about: 'Built at a weekend hack: HackMatch pairs you with teammates by skills + vibe for the next event. We won “best use of Supabase.”',
    stage: 'idea', status: 'paused', alert: 'On pause until after finals — reviving for the fall hack season.', timeline: 'Weekend project', place: 'NYU, Brooklyn',
    commitment: 'hackathon', tags: ['Consumer apps', 'Social impact'],
    roles: [{ title: 'Frontend Engineer', note: 'revive the UI', open: true }],
    members: ['maya'], pending: [] },
  { owner: 'amara', cat: 'startup', uni: 'fit', title: 'RunwayAR', blurb: 'AR try-on for indie fashion drops.',
    about: 'RunwayAR lets small fashion brands add web-based AR try-on to their drops in a day. FIT senior thesis turning into a real product.',
    stage: 'mvp', status: 'looking', alert: 'Need a graphics/3D engineer for the try-on renderer.', timeline: 'This summer', place: 'FIT, Manhattan',
    commitment: 'serious-build', tags: ['Fashion tech', 'AR / VR', 'Consumer apps'],
    roles: [{ title: '3D/Graphics Engineer', note: 'WebGL/Three.js', open: true }, { title: 'Brand Designer', note: 'launch identity', open: false }],
    members: ['ana'], pending: [] },
  { owner: 'raj', cat: 'class', uni: 'fordham', title: 'ClassPilot', blurb: 'A smarter schedule builder for course registration.',
    about: 'ClassPilot started as a Fordham CS class project: it builds conflict-free schedules optimized for your commute and preferred times.',
    stage: 'idea', status: 'completed', alert: 'Shipped for the class — open-sourcing it.', timeline: 'Spring 2026 (done)', place: 'Fordham, Bronx',
    commitment: 'side-project', tags: ['Ed tech', 'Open source'],
    roles: [{ title: 'Maintainer', note: 'keep it alive', open: true }],
    members: ['arjun'], pending: [] },
  { owner: 'kenji', cat: 'side', uni: 'nyu', title: 'SoundForge', blurb: 'A browser DAW for quick musical sketches.',
    about: 'SoundForge is a tiny web-based DAW for capturing ideas fast — loops, MIDI, and a few synths. Built on the Web Audio API.',
    stage: 'active-sprint', status: 'live', alert: 'v1 is live — shipping a mobile layout next.', timeline: 'Ongoing', place: 'NYU, Manhattan',
    commitment: 'side-project', tags: ['Music', 'Creative tools'],
    roles: [{ title: 'Audio Engineer', note: 'DSP + Web Audio', open: true }, { title: 'Designer', note: 'mobile layout', open: true }],
    members: ['hana'], pending: [] },
  { owner: 'jordan', cat: 'research', uni: 'cooper-union', title: 'CivicLens', blurb: 'Crowd-sourced air-quality sensing for NYC blocks.',
    about: 'CivicLens is a cheap open-hardware air sensor + map. Cooper Union ME project; partnering with a Bronx community group.',
    stage: 'recruiting', status: 'looking', alert: 'Need a frontend dev for the live map.', timeline: 'This summer', place: 'Cooper Union, Manhattan',
    commitment: 'serious-build', tags: ['Climate', 'Civic / NYC', 'Hardware'],
    roles: [{ title: 'Frontend Engineer', note: 'maps + dataviz', open: true }, { title: 'Hardware', note: 'sensor firmware', open: false }],
    members: ['tomas'], pending: [{ key: 'wei', msg: 'Applied math — I can help with the calibration/modeling side.' }] },
  { owner: 'arjun', cat: 'side', uni: 'nyu', title: 'LedgerLite', blurb: 'Dead-simple shared expenses for student houses.',
    about: 'LedgerLite tracks who owes who in a shared apartment without the awkward texts. Splitwise, but lighter and free.',
    stage: 'mvp', status: 'in-progress', alert: 'Looking for a designer to make it feel friendly.', timeline: '2-month build', place: 'NYU, Manhattan',
    commitment: 'side-project', tags: ['Fintech', 'Consumer apps'],
    roles: [{ title: 'Product Designer', note: 'make it warm', open: true }],
    members: ['marcus'], pending: [] },
]

/* ── events (hosted by clubs; some upcoming, some past) ────────────────────*/
// slug, club, type, title, blurb, date(YYYY-MM-DD), time, location, address,
// tags[], highlights[], capacity, going(target attendee count), isPast
const EVENTS = [
  { slug: 'ai-spring-kickoff', club: 'nyu-ai-collective', type: 'talk', title: 'Spring AI Kickoff Night',
    blurb: 'Lightning talks from students shipping AI projects this semester.', date: '2026-06-04', time: '6:00 PM',
    location: 'NYU Tandon — Rogers Hall', address: '6 MetroTech Center, Brooklyn, NY', tags: ['AI / ML', 'Consumer apps'],
    highlights: ['Five 5-minute student lightning talks', 'Q&A with NYU AI faculty', 'Pizza + open networking after'], capacity: 120, going: 52, isPast: false },
  { slug: 'columbia-demo-night', club: 'columbia-build', type: 'demo', title: 'Columbia Demo Night',
    blurb: 'Ten student teams demo what they shipped this term.', date: '2026-06-06', time: '7:00 PM',
    location: 'Columbia SEAS — Davis Auditorium', address: '530 W 120th St, New York, NY', tags: ['Startup', 'Consumer apps'],
    highlights: ['10 live student demos', 'Judges from NYC startups', 'Afterparty + networking'], capacity: 150, going: 88, isPast: false },
  { slug: 'pace-pitch-practice', club: 'pace-founders-hub', type: 'workshop', title: 'Pitch Practice Night',
    blurb: 'Bring 3 slides, get real feedback from founders and operators.', date: '2026-06-09', time: '6:30 PM',
    location: 'Pace — Bianco Room', address: '1 Pace Plaza, New York, NY', tags: ['Startup', 'Social impact'],
    highlights: ['Rapid-fire pitch rounds', 'Feedback from NYC founders', 'Slide-deck teardown'], capacity: 60, going: 31, isPast: false },
  { slug: 'ai-agents-workshop', club: 'nyu-ai-collective', type: 'workshop', title: 'Build Your First AI Agent',
    blurb: 'Hands-on: ship a working tool-using agent in 90 minutes.', date: '2026-06-11', time: '5:30 PM',
    location: 'NYU Tandon — Makerspace', address: '6 MetroTech Center, Brooklyn, NY', tags: ['AI / ML', 'Open source'],
    highlights: ['Starter repo + API keys provided', 'A mentor for every 3 attendees', 'Demo your agent at the end'], capacity: 60, going: 47, isPast: false },
  { slug: 'founders-mixer-june', club: 'nyc-student-founders', type: 'mixer', title: 'Cross-Campus Founders Mixer',
    blurb: 'Student founders from every NYC campus, one rooftop.', date: '2026-06-13', time: '8:00 PM',
    location: 'Williamsburg Rooftop', address: 'Wythe Ave, Brooklyn, NY', tags: ['Startup', 'Social impact'],
    highlights: ['600+ founder community', 'Drinks + skyline views', 'Bring a cofounder, find a cofounder'], capacity: 200, going: 140, isPast: false },
  { slug: 'design-career-night', club: 'pace-founders-hub', type: 'career', title: 'Design + Product Career Night',
    blurb: 'Portfolio reviews and intros to NYC design teams.', date: '2026-06-17', time: '6:00 PM',
    location: 'Pace — Student Center', address: '1 Pace Plaza, New York, NY', tags: ['Creative tools', 'Consumer apps'],
    highlights: ['1:1 portfolio reviews', 'Recruiters from NYC studios', 'Resume + case-study clinic'], capacity: 80, going: 38, isPast: false },
  { slug: 'hack-the-summer', club: 'nyu-ai-collective', type: 'hack', title: 'Hack the Summer',
    blurb: 'A 24-hour build sprint to kick off summer projects.', date: '2026-06-20', time: '10:00 AM',
    location: 'NYU Tandon — Event Hall', address: '6 MetroTech Center, Brooklyn, NY', tags: ['AI / ML', 'Civic / NYC', 'Hardware'],
    highlights: ['24-hour build sprint', '$2k in prizes', 'Meals + cold brew all weekend'], capacity: 100, going: 71, isPast: false },
  // ---- past ----
  { slug: 'intro-to-figma', club: 'columbia-build', type: 'design', title: 'Intro to Figma for Builders',
    blurb: 'Engineers, learn to prototype your own MVPs fast.', date: '2026-05-21', time: '6:00 PM',
    location: 'Columbia SEAS — Mudd 233', address: '500 W 120th St, New York, NY', tags: ['Creative tools', 'Consumer apps'],
    highlights: ['A starter Figma file to keep', 'Live prototype demo', 'Open Q&A'], capacity: 45, going: 40, isPast: true },
  { slug: 'ai-welcome-social', club: 'nyu-ai-collective', type: 'social', title: 'AI Collective Welcome Social',
    blurb: 'Our first social of the term — 90 new members joined.', date: '2026-05-08', time: '7:00 PM',
    location: 'NYU Tandon — Lounge', address: '6 MetroTech Center, Brooklyn, NY', tags: ['Social impact'],
    highlights: ['90+ new members', 'Project pod sign-ups', 'Snacks + music'], capacity: 100, going: 90, isPast: true },
  { slug: 'founders-pitch-night', club: 'nyc-student-founders', type: 'demo', title: 'Spring Pitch Night',
    blurb: 'Eight student startups pitched for a $5k grant.', date: '2026-04-30', time: '7:00 PM',
    location: 'Cornell Tech — Verizon Hall', address: '2 W Loop Rd, New York, NY', tags: ['Startup', 'Fintech'],
    highlights: ['8 startup pitches', '$5k grant awarded', 'Angel investor panel'], capacity: 120, going: 96, isPast: true },
]

/* ── demo account wiring (RLS-scoped, only visible when logged in as demo) ──*/
const DEMO_SAVED = ['StudySync', 'GreenRoute', 'NeuroPlay']        // by project title
const DEMO_JOINED = ['DormDash', 'HackMatch']                      // approved member on these
const DEMO_FOLLOWS = ['maya', 'sofia', 'devin', 'ana', 'marcus']   // demo → them (outgoing)
const DEMO_FOLLOWERS = ['arjun', 'priya', 'bella', 'raj']          // them → demo (incoming)
const DEMO_RSVPS = ['ai-spring-kickoff', 'columbia-demo-night', 'founders-mixer-june']

/* ════════════════════════════════════════════════════════════════════════ */
async function buildEmailMap(admin) {
  const map = new Map()
  let page = 1
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error('listUsers → ' + error.message)
    for (const u of data.users) map.set((u.email || '').toLowerCase(), u.id)
    if (data.users.length < 1000) break
    page++
  }
  return map
}

async function teardown(admin) {
  const map = await buildEmailMap(admin)
  let n = 0
  for (const email of SEEDED_EMAILS) {
    const id = map.get(email.toLowerCase())
    if (!id) continue
    const { error } = await admin.auth.admin.deleteUser(id) // hard delete → cascades everything
    if (error) throw new Error(`deleteUser(${email}) → ${error.message}`)
    n++
  }
  log(`  ↳ removed ${n} previously-seeded account(s) (cascade cleared their data)`)
}

async function seed(admin) {
  // 0) university org ids (existing, NOT created by us) for club.university_id
  const uniOrgs = await must('load universities', admin.from('organizations').select('id, slug').eq('type', 'university'))
  const uniOrgId = Object.fromEntries(uniOrgs.map((o) => [o.slug, o.id]))

  // 1) auth users (+ profiles via upsert; trigger pre-creates a stub row)
  log('• creating auth users + profiles…')
  const id = {} // key → user id
  for (const s of ALL_PEOPLE) {
    const email = emailFor(s)
    const { data, error } = await admin.auth.admin.createUser({
      email, password: pw, email_confirm: true,
      user_metadata: { account_type: 'student', first_name: s.first, seed: true },
    })
    if (error) throw new Error(`createUser(${email}) → ${error.message}`)
    id[s.key] = data.user.id
  }
  const profileRows = ALL_PEOPLE.map((s) => ({
    id: id[s.key], username: s.username, first_name: s.first, last_name: s.last,
    university: s.uni, major: s.major, bio: s.bio, photos: [s.photo],
    fields: s.fields, skills: s.skills, year: s.year, building: s.building,
    availability: s.avail, links: s.links, onboarding_completed: true, account_type: 'student',
  }))
  await must('upsert profiles', admin.from('profiles').upsert(profileRows, { onConflict: 'id' }))
  log(`  ↳ ${ALL_PEOPLE.length} students (incl. demo)`)

  // 2) clubs (owned by student founders)
  log('• creating club orgs…')
  const clubId = {} // slug → org id
  for (const c of CLUBS) {
    const row = await must(`org ${c.slug}`, admin.from('organizations').insert({
      slug: c.slug, name: c.name, type: c.type, university_id: uniOrgId[c.uni] || null,
      bio: c.bio, website: c.website, instagram: c.instagram, location: c.location,
      verified: true, owner_user_id: id[c.owner],
    }).select('id').single())
    clubId[c.slug] = row.id
  }
  log(`  ↳ ${CLUBS.length} clubs`)

  // 3) projects + team members
  log('• creating projects + teams…')
  const projId = {} // title → project id
  let pi = 0
  for (const p of PROJECTS) {
    const ownerId = id[p.owner]
    const proj = await must(`project ${p.title}`, admin.from('projects').insert({
      name: p.title, tagline: p.blurb, description: p.about, category: p.cat, university: p.uni,
      author_name: fullName(STUDENTS.find((s) => s.key === p.owner)), commitment: p.commitment,
      communication_link: '', stage: p.stage, timeline: p.timeline, place: p.place,
      pin_type: pi % 3 === 0 ? 'pin' : 'tape', rot: ROT[pi % ROT.length], status: p.status,
      alert: p.alert, flyer_color: HEX[pi % HEX.length], tags: p.tags, admins: [ownerId],
      roles: p.roles, publish_to_discover: true, owner_id: ownerId,
    }).select('id').single())
    projId[p.title] = proj.id

    const team = [{
      project_id: proj.id, user_id: ownerId, name: fullName(STUDENTS.find((s) => s.key === p.owner)),
      school: p.uni, role: 'Project lead', status: 'approved',
    }]
    for (const mk of p.members) {
      const m = STUDENTS.find((s) => s.key === mk)
      team.push({ project_id: proj.id, user_id: id[mk], name: fullName(m), school: m.uni, role: 'Member', status: 'approved' })
    }
    for (const req of p.pending) {
      const m = STUDENTS.find((s) => s.key === req.key)
      team.push({ project_id: proj.id, user_id: id[req.key], name: fullName(m), school: m.uni, role: 'Applicant', status: 'pending', message: req.msg })
    }
    await must(`team ${p.title}`, admin.from('team_members').insert(team))
    pi++
  }
  log(`  ↳ ${PROJECTS.length} projects (with leads, members + pending requests)`)

  // 4) events
  log('• creating events…')
  const evId = {} // slug → event id
  for (const e of EVENTS) {
    const club = CLUBS.find((c) => c.slug === e.club)
    const row = await must(`event ${e.slug}`, admin.from('events').insert({
      title: e.title, description: e.blurb, date: e.date, time: e.time, location: e.location,
      address: e.address, event_type: e.type, tags: e.tags, highlights: e.highlights,
      max_attendees: e.capacity, is_past: e.isPast, organization_id: clubId[e.club],
      organizer_id: id[club.owner], organizer_name: club.name,
    }).select('id').single())
    evId[e.slug] = row.id
  }
  log(`  ↳ ${EVENTS.length} events`)

  // 5) event registrations (students attend; never the host org's owner)
  log('• registering attendees…')
  const studentKeys = STUDENTS.map((s) => s.key)
  let regCount = 0
  for (const e of EVENTS) {
    const club = CLUBS.find((c) => c.slug === e.club)
    const ownerKey = club.owner
    // rotate a believable subset of attendees per event, excluding the host owner
    const attendees = studentKeys.filter((k) => k !== ownerKey)
      .filter((_, i) => (i + EVENTS.indexOf(e)) % 2 === 0).slice(0, 9)
    const rows = attendees.map((k) => ({ event_id: evId[e.slug], user_id: id[k] }))
    if (rows.length) {
      await must(`rsvp ${e.slug}`, admin.from('event_registrations').upsert(rows, { onConflict: 'event_id,user_id' }))
      regCount += rows.length
    }
    // overwrite the trigger-maintained count with the believable "going" target
    await must(`count ${e.slug}`, admin.from('events').update({ attendees: e.going }).eq('id', evId[e.slug]))
  }
  log(`  ↳ ${regCount} registrations across ${EVENTS.length} events`)

  // 6) connection web among students (ring + a few cross edges)
  log('• wiring connections…')
  const edges = new Set()
  const addEdge = (a, b) => { if (a && b && a !== b) edges.add(`${a}|${b}`) }
  for (let i = 0; i < studentKeys.length; i++) {
    addEdge(studentKeys[i], studentKeys[(i + 1) % studentKeys.length])
    addEdge(studentKeys[i], studentKeys[(i + 3) % studentKeys.length])
    if (i % 2 === 0) addEdge(studentKeys[(i + 5) % studentKeys.length], studentKeys[i])
  }
  // demo edges
  for (const k of DEMO_FOLLOWS) addEdge('demo', k)
  for (const k of DEMO_FOLLOWERS) addEdge(k, 'demo')
  const connRows = [...edges].map((e) => { const [a, b] = e.split('|'); return { user_id: id[a], target_id: id[b] } })
  await must('connections', admin.from('connections').upsert(connRows, { onConflict: 'user_id,target_id' }))
  log(`  ↳ ${connRows.length} directed connections`)

  // 7) demo personal data: saved + joined (RLS-scoped to the demo login)
  log('• wiring the demo account…')
  const savedRows = DEMO_SAVED.map((t) => ({ user_id: id.demo, project_id: projId[t] })).filter((r) => r.project_id)
  await must('demo saved', admin.from('saved_projects').upsert(savedRows, { onConflict: 'user_id,project_id' }))
  const joinRows = DEMO_JOINED.map((t) => ({ project_id: projId[t], user_id: id.demo, name: 'Demo Student', school: 'nyu', role: 'Member', status: 'approved' })).filter((r) => r.project_id)
  await must('demo joined', admin.from('team_members').insert(joinRows))
  const demoRsvp = DEMO_RSVPS.map((s) => ({ event_id: evId[s], user_id: id.demo })).filter((r) => r.event_id)
  await must('demo rsvp', admin.from('event_registrations').upsert(demoRsvp, { onConflict: 'event_id,user_id' }))
  log(`  ↳ ${savedRows.length} saved · ${joinRows.length} joined · ${demoRsvp.length} RSVPs · ${DEMO_FOLLOWS.length} out / ${DEMO_FOLLOWERS.length} in connections`)

  return { id, projId, clubId, evId }
}

async function verify(admin) {
  const c = async (t, q) => { const { count } = await q; return `${t}: ${count}` }
  const rows = await Promise.all([
    c('profiles', admin.from('profiles').select('*', { count: 'exact', head: true })),
    c('published projects', admin.from('projects').select('*', { count: 'exact', head: true }).eq('publish_to_discover', true)),
    c('clubs+communities', admin.from('organizations').select('*', { count: 'exact', head: true }).neq('type', 'university')),
    c('events', admin.from('events').select('*', { count: 'exact', head: true })),
    c('registrations', admin.from('event_registrations').select('*', { count: 'exact', head: true })),
    c('team_members', admin.from('team_members').select('*', { count: 'exact', head: true })),
    c('connections', admin.from('connections').select('*', { count: 'exact', head: true })),
    c('saved_projects', admin.from('saved_projects').select('*', { count: 'exact', head: true })),
  ])
  log('\n── verification (live totals, incl. any pre-existing) ──')
  for (const r of rows) log('  ' + r)
}

export async function run({ down = false } = {}) {
  const env = loadEnvSeed()
  const token = env.SUPABASE_ACCESS_TOKEN
  const ref = env.SUPABASE_PROJECT_REF
  const url = env.SUPABASE_URL
  const apiBase = env.SUPABASE_API_BASE || 'https://api.supabase.com'
  if (!token || !ref || !url) throw new Error('Missing SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF / SUPABASE_URL in .env.seed')

  log(`→ target: ${url} (project ${ref})`)
  log('→ fetching service_role key via Management API…')
  const serviceKey = await fetchServiceRoleKey(apiBase, ref, token)
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  log('• teardown (remove anything this seed created before)…')
  await teardown(admin)

  if (down) { log('✓ teardown complete — seeded demo data removed.'); return }

  await seed(admin)
  await verify(admin)

  log('\n✓ Seed complete.')
  log('  Demo login →  email: ' + DEMO.email + '   password: ' + pw)
  log('  (All seeded accounts share that password; the demo account owns no org, so it lands on the board.)')
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  run({ down: process.argv.includes('--down') }).catch((e) => { console.error('\n✗ ' + e.message); process.exit(1) })
}
