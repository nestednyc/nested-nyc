/* ============================================================
   Seed the LOCAL Supabase stack with the fake community — students,
   verified clubs, events, projects, board posts, likes, comments,
   saves, follows. Idempotent (re-run = refresh). Data + SQL live in
   scripts/_communityCast.mjs (shared with the staging seeder).

   Prereq: `supabase start` running in THIS worktree.
   Run:    node scripts/seed-community-demo.mjs

   Logins (password Passw0rd! for all):
     ada@nyu.edu          student  (@ada_nyu, follows 3 orgs, has saves)
     hello@nyudevs.club   org owner → "NYU Devs" (verified club)
   Refuses to run against anything that isn't 127.0.0.1 / localhost.
   ============================================================ */
import { execSync } from 'node:child_process';
import { PASSWORD, STUDENTS, ORGS, ensureUser, buildSeedSql } from './_communityCast.mjs';

// ---- local creds from `supabase status` -------------------------------------
function statusEnv() {
  let out;
  try { out = execSync('supabase status -o env', { encoding: 'utf8' }); }
  catch { console.error('Could not read `supabase status`. Is the local stack up?'); process.exit(2); }
  const env = {};
  for (const line of out.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  return env;
}
const env = statusEnv();
const API = env.API_URL || 'http://127.0.0.1:54321';
const SR = env.SERVICE_ROLE_KEY;
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(API)) {
  console.error(`Refusing to seed a non-local API: ${API}`); process.exit(3);
}
if (!SR) { console.error('Missing SERVICE_ROLE_KEY from `supabase status -o env`.'); process.exit(2); }

function runSql(sql) {
  const name = process.env.SUPABASE_DB_CONTAINER || 'supabase_db_';
  const container = execSync(`docker ps -qf name=${name}`, { encoding: 'utf8' }).trim().split('\n')[0];
  if (!container) throw new Error(`No running ${name}* container (set SUPABASE_DB_CONTAINER to pick one).`);
  execSync(`docker exec -i ${container} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f -`,
    { input: sql, stdio: ['pipe', 'inherit', 'inherit'] });
}

console.log(`Seeding local Supabase at ${API} …`);
for (const s of STUDENTS) await ensureUser(API, SR, s.email, {});
for (const o of ORGS) await ensureUser(API, SR, o.email, { account_type: 'org_admin' });
console.log('Applying data SQL …');
runSql(buildSeedSql({ guardMode: 'replica', includeProjects: true }));
console.log(`\nSeed complete. Password for all: ${PASSWORD}`);
console.log('  student:   ada@nyu.edu        → /community');
console.log('  org owner: hello@nyudevs.club → /dashboard → Community');
