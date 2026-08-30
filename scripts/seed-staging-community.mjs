/* ============================================================
   Seed a HOSTED staging Supabase project with the community-only
   demo cast (no mock projects — Discover stays clean; everything
   the /community page shows: students, clubs, posts, likes,
   comments, saves, follows, spotlight, org events). Idempotent.

   Run:  SUPABASE_PAT=sbp_… node scripts/seed-staging-community.mjs --ref <staging-ref>

   Hard guards: --ref is required, and production
   (fkiyjxxiysbvmflbibsu) is refused outright. The PAT comes from
   the environment, never argv; nothing is written to disk.
   ============================================================ */
import { execFileSync } from 'node:child_process';
import { PASSWORD, STUDENTS, ORGS, ensureUser, buildSeedSql } from './_communityCast.mjs';

const PROD_REF = 'fkiyjxxiysbvmflbibsu';
const refIdx = process.argv.indexOf('--ref');
const REF = refIdx > -1 ? process.argv[refIdx + 1] : null;
const PAT = process.env.SUPABASE_PAT;
if (!REF || !/^[a-z]{20}$/.test(REF)) { console.error('Usage: SUPABASE_PAT=sbp_… node scripts/seed-staging-community.mjs --ref <project-ref>'); process.exit(2); }
const yesProd = process.argv.includes('--yes-prod');
if (REF === PROD_REF && !yesProd) { console.error('REFUSING: that is the PRODUCTION project. Re-run with --yes-prod if Hamza explicitly asked for the shared-DB preview seed.'); process.exit(3); }
if (!PAT || !PAT.startsWith('sbp_')) { console.error('Missing SUPABASE_PAT (sbp_…) in the environment.'); process.exit(2); }
// On prod the demo accounts must NOT use the published Passw0rd! — require a
// private password so nobody can walk into the fake accounts on the live site.
const SEED_PW = process.env.SEED_PASSWORD;
if (REF === PROD_REF && (!SEED_PW || SEED_PW.length < 12)) { console.error('Prod seeding requires SEED_PASSWORD (12+ chars) in the environment.'); process.exit(2); }

// Management API via curl — urllib/fetch user-agents hit Cloudflare 1010.
function mapi(method, path, body) {
  const args = ['-sS', '-X', method, `https://api.supabase.com/v1${path}`,
    '-H', `Authorization: Bearer ${PAT}`, '-H', 'Content-Type: application/json'];
  if (body !== undefined) args.push('-d', JSON.stringify(body));
  const out = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  try { return JSON.parse(out); } catch { return out; }
}
function runSql(sql) {
  const res = mapi('POST', `/projects/${REF}/database/query`, { query: sql });
  if (res && res.error) throw new Error('SQL failed: ' + JSON.stringify(res).slice(0, 500));
  return res;
}

// service-role key for the auth admin API
const keys = mapi('GET', `/projects/${REF}/api-keys`);
const sr = (Array.isArray(keys) ? keys : []).find((k) => k.name === 'service_role');
if (!sr) { console.error('Could not fetch the service_role key: ' + JSON.stringify(keys).slice(0, 300)); process.exit(1); }
const API = `https://${REF}.supabase.co`;

console.log(`Seeding STAGING ${REF} (community-only cast) …`);
const pw = SEED_PW || PASSWORD;
for (const s of STUDENTS) await ensureUser(API, sr.api_key, s.email, {}, pw);
for (const o of ORGS) await ensureUser(API, sr.api_key, o.email, { account_type: 'org_admin' }, pw);
console.log('Applying data SQL …');
runSql(buildSeedSql({ guardMode: 'disable-triggers', includeProjects: false }));

const counts = runSql(`SELECT (SELECT count(*) FROM auth.users) AS users, (SELECT count(*) FROM public.organizations WHERE type='club') AS clubs,
  (SELECT count(*) FROM public.posts) AS posts, (SELECT count(*) FROM public.projects) AS projects, (SELECT count(*) FROM public.events) AS events`);
console.log('Counts:', JSON.stringify(counts));
console.log(`\nSeed complete. Demo-account password: ${SEED_PW ? '(the SEED_PASSWORD you provided)' : PASSWORD}`);
