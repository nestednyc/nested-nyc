/* ============================================================
   Nested AI intros — the runner. Sends a round of intro DMs from a JSON
   file, each one going out AS the sender through public.send_intro_message
   (service-role only; the row carries origin='intro' + the card's note), which
   also fires the live messages webhook → the receiver's "X messaged you" email.

   Run (DRY RUN is the default — it prints every check and every message and
   sends nothing):
     node scripts/send-intros.mjs --local                 # the local stack
     SUPABASE_PAT=sbp_… node scripts/send-intros.mjs --ref <project-ref>
   Add --send to actually send. Production (fkiyjxxiysbvmflbibsu) is refused
   unless --yes-prod is also given. --file <path> picks the round
   (default scripts/intros/round-1.json).

   Before each send the pair is re-checked against the live rows: both real,
   finished student accounts with a photo, seen in the last 30 days, a real
   first name (no "Fnu"/empty placeholder), not connected, no messages either
   way, never introduced, not blocked. A failed check skips that pair, loudly.
   ============================================================ */
import { execFileSync, execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const PROD_REF = 'fkiyjxxiysbvmflbibsu';
const argv = process.argv.slice(2);
const flag = (f) => argv.includes(f);
const val = (f, d = null) => { const i = argv.indexOf(f); return i > -1 ? argv[i + 1] : d; };
const LOCAL = flag('--local');
const REF = val('--ref');
const SEND = flag('--send');
const FILE = val('--file', 'scripts/intros/round-1.json');
const PLACEHOLDER_NAMES = new Set(['fnu', 'unknown', 'n/a', 'na', 'none', 'null', 'test', 'student']);

if (!LOCAL && !REF) { console.error('Usage: node scripts/send-intros.mjs (--local | --ref <project-ref>) [--send] [--yes-prod] [--file path]'); process.exit(2); }
if (REF && !/^[a-z]{20}$/.test(REF)) { console.error('--ref must be a 20-letter project ref.'); process.exit(2); }
if (REF === PROD_REF && !flag('--yes-prod')) { console.error('REFUSING: that is the PRODUCTION project. Re-run with --yes-prod only when Hamza has said go.'); process.exit(3); }

// ---- SQL runners: every query returns rows as JSON --------------------------
let runRows;
if (LOCAL) {
  const env = {};
  for (const line of execSync('supabase status -o env', { encoding: 'utf8' }).split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
  if (!env.DB_URL) { console.error('No DB_URL from `supabase status -o env` — is the local stack up?'); process.exit(2); }
  const hasPsql = (() => { try { execSync('command -v psql', { stdio: 'ignore' }); return true; } catch { return false; } })();
  const container = hasPsql ? null : execSync('docker ps -qf name=supabase_db', { encoding: 'utf8' }).trim().split('\n')[0];
  runRows = (sql) => {
    const wrapped = `select coalesce(json_agg(t), '[]'::json) from (${sql}) t`;
    const out = hasPsql
      ? execFileSync('psql', [env.DB_URL, '-v', 'ON_ERROR_STOP=1', '-At', '-c', wrapped], { encoding: 'utf8' })
      : execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-c', wrapped], { encoding: 'utf8' });
    return JSON.parse(out.trim() || '[]');
  };
} else {
  const PAT = process.env.SUPABASE_PAT;
  if (!PAT || !PAT.startsWith('sbp_')) { console.error('Missing SUPABASE_PAT (sbp_…) in the environment.'); process.exit(2); }
  // Management API via curl — fetch/urllib user-agents hit Cloudflare 1010.
  runRows = (sql) => {
    let out;
    try {
      out = execFileSync('curl', ['-sS', '-X', 'POST', `https://api.supabase.com/v1/projects/${REF}/database/query`,
        '-H', `Authorization: Bearer ${PAT}`, '-H', 'Content-Type: application/json',
        '-d', JSON.stringify({ query: sql })], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      // A transport failure makes curl exit non-zero and Node's error would carry the
      // whole argv, Authorization header included — never let that reach a log.
      throw new Error(`curl to the Management API failed (exit ${e.status ?? '?'}): ${String(e.stderr || '').replace(/sbp_[A-Za-z0-9]+/g, 'sbp_…').slice(0, 300)}`);
    }
    let res; try { res = JSON.parse(out); } catch { throw new Error('Non-JSON from the Management API: ' + out.slice(0, 300)); }
    // The API answers a failed statement with an object ({ message } / { error }), never an array.
    if (!Array.isArray(res)) throw new Error('SQL failed: ' + JSON.stringify(res).slice(0, 500));
    return res;
  };
}
// The migration must be on this database before anything can be sent; a dry run
// still reports every pair, minus the "never introduced" check, so it stays useful
// before the apply.
const [{ ok: MIGRATED }] = runRows(`select to_regprocedure('public.send_intro_message(uuid,uuid,uuid,text,text,text)') is not null as ok`);
if (!MIGRATED) {
  console.log('NOTE: migration 20260907000000_ai_intros is NOT applied here (send_intro_message missing).' + (SEND ? ' Refusing to send.' : ' Dry run continues without the intro_log check.'));
  if (SEND) process.exit(4);
}
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";   // SQL string literal
// One message id per (batch, sender, recipient), derived rather than random, so a
// re-run after a mid-request failure hands send_intro_message the SAME id and gets
// the original message back instead of a PT409 (its idempotency is keyed on the id).
const introId = (batch, sender, recipient) => {
  const h = createHash('sha256').update(`nested-intro:${batch}:${sender}:${recipient}`).digest();
  h[6] = (h[6] & 0x0f) | 0x40; h[8] = (h[8] & 0x3f) | 0x80;   // RFC 4122 version + variant bits
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
};

// ---- the round ----------------------------------------------------------------
const round = JSON.parse(readFileSync(FILE, 'utf8'));
if (!Array.isArray(round) || !round.length) { console.error(`${FILE}: expected a non-empty array of { sender, recipient, body, note, batch }`); process.exit(2); }
console.log(`${SEND ? 'SENDING' : 'DRY RUN'} — ${round.length} intro(s) from ${FILE} against ${LOCAL ? 'the LOCAL stack' : REF + (REF === PROD_REF ? ' (PRODUCTION)' : '')}\n`);

const strip = (u) => String(u || '').replace(/^@/, '').trim().toLowerCase();
const problems = (p, who) => {
  const out = [];
  if (!p) return [`${who}: no such username`];
  if (p.account_type !== 'student') out.push(`${who}: not a student account`);
  if (!p.onboarding_completed) out.push(`${who}: onboarding not completed`);
  if (!(p.photos > 0)) out.push(`${who}: no profile photo`);
  const fn = String(p.first_name || '').trim();
  if (!fn || PLACEHOLDER_NAMES.has(fn.toLowerCase())) out.push(`${who}: first name missing or a placeholder (${JSON.stringify(fn)})`);
  if (!p.last_sign_in || p.days_since_sign_in > 30) out.push(`${who}: last sign-in ${p.last_sign_in ? p.days_since_sign_in + ' days ago' : 'never'}`);
  return out;
};

let sent = 0, skipped = 0;
for (const [i, item] of round.entries()) {
  const s = strip(item.sender), r = strip(item.recipient);
  const label = `${i + 1}. @${s} → @${r}`;
  const body = String(item.body || '').trim();
  const note = String(item.note || '').trim();
  const batch = String(item.batch || 'round');
  const issues = [];
  if (!body) issues.push('empty body');
  if (body.length > 4000) issues.push('body over 4000 chars');
  if (note.length > 200) issues.push('note over 200 chars');
  if (s === r) issues.push('sender and recipient are the same');

  const people = runRows(`select p.id, p.username, p.first_name, p.account_type, p.onboarding_completed,
      coalesce(array_length(p.photos, 1), 0) as photos, u.last_sign_in_at as last_sign_in,
      extract(day from now() - u.last_sign_in_at)::int as days_since_sign_in
    from public.profiles p left join auth.users u on u.id = p.id
    where p.username in (${q(s)}, ${q(r)})`);
  const A = people.find((p) => p.username === s), B = people.find((p) => p.username === r);
  issues.push(...problems(A, '@' + s), ...problems(B, '@' + r));
  if (A && B) {
    const [rel] = runRows(`select
      exists (select 1 from public.connections c where (c.user_id = ${q(A.id)} and c.target_id = ${q(B.id)}) or (c.user_id = ${q(B.id)} and c.target_id = ${q(A.id)})) as connected,
      exists (select 1 from public.messages m where (m.sender_id = ${q(A.id)} and m.recipient_id = ${q(B.id)}) or (m.sender_id = ${q(B.id)} and m.recipient_id = ${q(A.id)})) as has_thread,
      exists (select 1 from public.blocks b where (b.blocker_id = ${q(A.id)} and b.blocked_id = ${q(B.id)}) or (b.blocker_id = ${q(B.id)} and b.blocked_id = ${q(A.id)})) as blocked,
      ${MIGRATED
        ? `exists (select 1 from public.intro_log l where least(l.sender_id, l.recipient_id) = least(${q(A.id)}::uuid, ${q(B.id)}::uuid) and greatest(l.sender_id, l.recipient_id) = greatest(${q(A.id)}::uuid, ${q(B.id)}::uuid))`
        : 'false'} as introduced`);
    if (rel.connected) issues.push('already connected');
    if (rel.has_thread) issues.push('already have a thread');
    if (rel.blocked) issues.push('a block exists between them');
    if (rel.introduced) issues.push('already introduced in an earlier round');
  }

  console.log(label);
  console.log(`   note: ${note || '(none)'}`);
  console.log(`   body: ${body.replace(/\s+/g, ' ')}`);
  if (issues.length) {
    skipped++;
    console.log(`   SKIP — ${issues.join('; ')}\n`);
    continue;
  }
  if (!SEND) { console.log('   ok — would send\n'); continue; }
  const [row] = runRows(`select public.send_intro_message(${q(introId(batch, A.id, B.id))}, ${q(A.id)}, ${q(B.id)}, ${q(body)}, ${q(note)}, ${q(batch)}) as id`);
  sent++;
  console.log(`   SENT — message ${row.id}\n`);
  await new Promise((res) => setTimeout(res, 1000));
}
console.log(`${SEND ? 'sent' : 'would send'} ${SEND ? sent : round.length - skipped}, skipped ${skipped}`);
process.exit(0);
