/* ============================================================
   Apply the community-branch migrations (20260827000000 →
   20260902000000) to a HOSTED Supabase project through the
   Management API, in filename order, stopping on the first error,
   and record each applied file in supabase_migrations.schema_migrations
   so the ledger stays truthful. Skips versions already in the ledger.

   Run:  SUPABASE_PAT=sbp_… node scripts/apply-community-migrations.mjs --ref <ref> [--yes-prod]
   ============================================================ */
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const PROD_REF = 'fkiyjxxiysbvmflbibsu';
const refIdx = process.argv.indexOf('--ref');
const REF = refIdx > -1 ? process.argv[refIdx + 1] : null;
const PAT = process.env.SUPABASE_PAT;
if (!REF || !/^[a-z]{20}$/.test(REF)) { console.error('Usage: SUPABASE_PAT=sbp_… node scripts/apply-community-migrations.mjs --ref <ref> [--yes-prod]'); process.exit(2); }
if (REF === PROD_REF && !process.argv.includes('--yes-prod')) { console.error('REFUSING prod without --yes-prod.'); process.exit(3); }
if (!PAT || !PAT.startsWith('sbp_')) { console.error('Missing SUPABASE_PAT.'); process.exit(2); }

const FIRST = '20260827000000';
const files = readdirSync(new URL('../supabase/migrations/', import.meta.url))
  .filter((f) => f.endsWith('.sql') && /^\d{14}_/.test(f) && f.slice(0, 14) >= FIRST)
  .sort();

function mapi(query) {
  const out = execFileSync('curl', ['-sS', '-X', 'POST', `https://api.supabase.com/v1/projects/${REF}/database/query`,
    '-H', `Authorization: Bearer ${PAT}`, '-H', 'Content-Type: application/json',
    '-d', JSON.stringify({ query })], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  let res; try { res = JSON.parse(out); } catch { res = out; }
  if (res && res.error) throw new Error(JSON.stringify(res).slice(0, 600));
  return res;
}

const ledger = mapi(`SELECT version FROM supabase_migrations.schema_migrations`);
const applied = new Set((Array.isArray(ledger) ? ledger : []).map((r) => r.version));
console.log(`Target ${REF}${REF === PROD_REF ? ' (PRODUCTION)' : ''} — ${files.length} community migrations, ${files.filter((f) => applied.has(f.slice(0, 14))).length} already in the ledger.`);
for (const f of files) {
  const version = f.slice(0, 14);
  if (applied.has(version)) { console.log(`  skip   ${f} (in ledger)`); continue; }
  process.stdout.write(`  apply  ${f} … `);
  mapi(readFileSync(new URL('../supabase/migrations/' + f, import.meta.url), 'utf8'));
  mapi(`INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES ('${version}', '${f.replace(/'/g, "''")}') ON CONFLICT DO NOTHING`);
  console.log('ok');
}
console.log('Done.');
