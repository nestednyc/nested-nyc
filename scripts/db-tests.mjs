/* ============================================================
   SQL acceptance proofs (supabase/tests/*.sql) against the LOCAL stack.

     supabase start && npm run test:db
     DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test:db

   Every *.sql in supabase/tests runs, except the files in SKIP (each with
   its reason), so a new proof is picked up without touching this file.
   A proof prints `TEST n PASS: …` / `TEST n FAIL: …` (or `PASS n: …` /
   `FAIL n: …`) NOTICE lines and never raises on a failed expectation, so
   this runner fails on any FAIL notice, on a file that prints no PASS at
   all, and on a psql error (ON_ERROR_STOP). Only NOTICE lines count — the
   proofs' own `\echo … (watch for PASS/FAIL)` banners do not.

   Never run against prod: the proofs rewrite auth.users. DB_URL must point
   at a loopback host; anything else is refused before any SQL runs.
   ============================================================ */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TESTS_DIR = path.join(ROOT, 'supabase', 'tests');

const SKIP = {
  'dm_s1_acceptance.sql': 'proves the state BEFORE 20260622000000 (direct INSERT still allowed) and fails by design on today\'s schema',
};

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
const RESULT = /NOTICE:\s+(?:TEST\s+\S+\s+)?(PASS|FAIL)\b/;

const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
function die(msg, code = 2) { console.error(msg); process.exit(code); }

// ── 1. where is the database? ───────────────────────────────
let dbUrl = process.env.DB_URL || '';
if (!dbUrl) {
  const r = run('supabase', ['status', '-o', 'env']);
  if (r.error || r.status !== 0) {
    const detail = (r.error ? r.error.message : `${r.stderr || ''}${r.stdout || ''}`).trim();
    die(`could not read \`supabase status\` — is the local stack running? (supabase start)\n${detail}`);
  }
  const m = r.stdout.match(/^DB_URL="?([^"\r\n]+)"?/m);
  if (!m) die('`supabase status -o env` printed no DB_URL');
  dbUrl = m[1];
}
let host = '';
try { host = new URL(dbUrl).hostname; } catch { die(`DB_URL is not a URL: ${dbUrl}`); }
if (!LOOPBACK.has(host)) die(`refusing: DB_URL host "${host}" is not loopback — the proofs rewrite auth.users and must never reach a real project`);

// ── 2. how do we reach psql? ────────────────────────────────
const PSQL_FLAGS = ['-X', '-q', '-v', 'ON_ERROR_STOP=1'];
let psql = (sql) => run('psql', [dbUrl, ...PSQL_FLAGS], { input: sql });
if (run('psql', ['--version']).error?.code === 'ENOENT') {
  // No psql on PATH → the one inside THIS project's db container. The CLI
  // names it after config.toml's project_id, else the directory name;
  // SUPABASE_DB_CONTAINER overrides (same knob as seed-community-demo.mjs).
  const cfg = readFileSync(path.join(ROOT, 'supabase', 'config.toml'), 'utf8');
  const id = (cfg.match(/^project_id\s*=\s*"([^"]+)"/m) || [])[1] || path.basename(ROOT);
  const name = process.env.SUPABASE_DB_CONTAINER || `supabase_db_${id}`;
  const ps = run('docker', ['ps', '--filter', `name=${name}`, '--format', '{{.Names}}']);
  const names = (ps.stdout || '').split(/\r?\n/).map((s) => s.trim());
  if (ps.error || ps.status !== 0 || !names.includes(name)) {
    die(`no psql on PATH and no running container named ${name} — install psql or start the stack (supabase start)`);
  }
  psql = (sql) => run('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-d', 'postgres', ...PSQL_FLAGS], { input: sql });
}

// ── 3. run every proof ──────────────────────────────────────
const files = readdirSync(TESTS_DIR).filter((f) => f.endsWith('.sql')).sort();
let ran = 0, failing = 0;
for (const f of files) {
  if (SKIP[f]) { console.log(`── ${f}: skipped — ${SKIP[f]}`); continue; }
  console.log(`── ${f}`);
  // CRLF checkouts: a psql meta-command must not see a trailing \r.
  const sql = readFileSync(path.join(TESTS_DIR, f), 'utf8').replace(/\r\n?/g, '\n');
  const r = psql(sql);
  const out = `${r.stdout || ''}\n${r.stderr || ''}`;
  const results = out.split('\n').filter((l) => RESULT.test(l));
  for (const l of results) console.log(`  ${l.trim()}`);
  const fails = results.filter((l) => RESULT.exec(l)[1] === 'FAIL').length;
  const passes = results.length - fails;
  let bad = fails > 0;
  if (r.error || r.status !== 0) {
    console.log(`  psql exited ${r.error ? r.error.message : r.status}:`);
    console.log(out.trim().split('\n').slice(-20).map((l) => `    ${l}`).join('\n'));
    bad = true;
  }
  if (!passes) { console.log('  no PASS notices — nothing ran?'); bad = true; }
  if (bad) failing++;
  ran++;
}
if (!ran) die('no proofs found in supabase/tests');
if (failing) { console.log(`✗ ${failing} of ${ran} proof file(s) failing`); process.exit(1); }
console.log(`✓ ${ran} proof file(s) passed`);
