/* ============================================================
   Seed the LOCAL Supabase stack with 3 personas for the org
   auth/branding E2E (e2e/org-auth-flows.mjs). Idempotent.

   Prereq: `supabase start` running.
   Run:    node scripts/seed-local.mjs

   Personas (password Passw0rd! for all):
     owner@nyu.edu  org owner (account_type=org_admin), owns verified club
                    'nyu-devs' parented to the seeded NYU university.
                    Email is on a supported campus domain so the STUDENT
                    sign-in door (which gates step 0 on .edu) is reachable —
                    that's how H1's org branch gets exercised through the UI.
     ada@nyu.edu    completed student (onboarding_completed=true)
     bob@nyu.edu    incomplete student (onboarding_completed=false)
   ============================================================ */
import { execSync } from 'node:child_process';

const PASSWORD = 'Passw0rd!';
const USERS = [
  { email: 'owner@nyu.edu', meta: { account_type: 'org_admin' } },
  { email: 'ada@nyu.edu', meta: {} },
  { email: 'bob@nyu.edu', meta: {} },
];

// ---- local creds from `supabase status` -------------------------------------
function statusEnv() {
  let out;
  try {
    out = execSync('supabase status -o env', { encoding: 'utf8' });
  } catch {
    console.error('Could not read `supabase status`. Is the local stack up (`supabase start`)?');
    process.exit(2);
  }
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
const DB = env.DB_URL;
if (!SR || !DB) {
  console.error('Missing SERVICE_ROLE_KEY / DB_URL from `supabase status -o env`.');
  process.exit(2);
}

// ---- create auth users via the GoTrue admin API -----------------------------
async function ensureUser(u) {
  const res = await fetch(`${API}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: PASSWORD, email_confirm: true, user_metadata: u.meta }),
  });
  if (res.ok) { console.log(`  created ${u.email}`); return; }
  const body = await res.text();
  if (res.status === 422 || /already.*registered|email_exists|already been registered/i.test(body)) {
    console.log(`  exists  ${u.email}`);
    return;
  }
  throw new Error(`admin create ${u.email} failed: ${res.status} ${body}`);
}

// ---- org row + profile flips (service-role SQL) -----------------------------
// psql connects as postgres → RLS bypassed, auth.uid() null, so verified=TRUE on
// INSERT is allowed (org_lock_verified is UPDATE-only). Prefer host psql; fall
// back to psql inside the supabase db container when the host has no client.
const SQL = `
INSERT INTO public.organizations (slug, name, type, university_id, owner_user_id, verified, location)
SELECT 'nyu-devs', 'NYU Devs', 'club',
       (SELECT id FROM public.organizations WHERE slug = 'nyu'),
       (SELECT id FROM auth.users WHERE email = 'owner@nyu.edu'),
       TRUE, 'New York, NY'
ON CONFLICT (slug) DO NOTHING;

UPDATE public.profiles p
SET onboarding_completed = TRUE, username = 'ada_nyu', first_name = 'Ada',
    last_name = 'Lovelace', university = 'nyu'
FROM auth.users u
WHERE u.id = p.id AND u.email = 'ada@nyu.edu';
`;

function hasHostPsql() {
  try { execSync('command -v psql', { stdio: 'ignore' }); return true; } catch { return false; }
}
function runSql(sql) {
  if (hasHostPsql()) {
    execSync(`psql "${DB}" -v ON_ERROR_STOP=1 -f -`, { input: sql, stdio: ['pipe', 'inherit', 'inherit'] });
    return;
  }
  const container = execSync('docker ps -qf name=supabase_db', { encoding: 'utf8' }).trim().split('\n')[0];
  if (!container) throw new Error('No host psql and no running supabase_db container to exec into.');
  console.log(`  (no host psql — running SQL inside container ${container})`);
  execSync(`docker exec -i ${container} psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -`,
    { input: sql, stdio: ['pipe', 'inherit', 'inherit'] });
}

console.log(`Seeding local Supabase at ${API} …`);
for (const u of USERS) await ensureUser(u);
console.log('Applying org + profile SQL …');
runSql(SQL);
console.log(`\nSeed complete. Password for all: ${PASSWORD}`);
console.log('  owner@nyu.edu → org "nyu-devs" (verified club, NYU)');
console.log('  ada@nyu.edu   → completed student (@ada_nyu)');
console.log('  bob@nyu.edu   → incomplete student');
