// Dry-run the notify PLANNER (no Resend, nothing sent) for the Nested AI intro
// emails, against the LOCAL stack after supabase/tests/dm_intro_acceptance.sql
// has run (it leaves an intro A→B and B's reply behind under fixed ids):
//   (a) the intro row        → a plan to the receiver, "… messaged you on Nested"
//   (b) B's first reply      → a plan to the intro's sender, "… wants to message you on Nested"
//   (c) B's second reply     → no plan (the sender was told once)
import { execSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
const env = {};
for (const line of execSync('supabase status -o env', { encoding: 'utf8' }).split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
process.env.SUPABASE_URL = env.API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SERVICE_ROLE_KEY;
process.env.WEBHOOK_SECRET = 'local-test-secret';
process.env.APP_URL = 'http://127.0.0.1:5174';
delete process.env.RESEND_VERCEL_KEY; delete process.env.RESEND_API_KEY;   // belt and braces: nothing can leave the box
const { planFor } = await import('../api/notify.js');

const A = 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', B = 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2';
const INTRO = '10000000-0000-0000-0000-000000000001', REPLY = '10000000-0000-0000-0000-000000000009';
function sql(q) {
  const c = execSync('docker ps -qf name=supabase_db_', { encoding: 'utf8' }).trim().split('\n')[0];
  return execSync(`docker exec -i ${c} psql -U postgres -d postgres -Atc "${q.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
}
// clean slate for the email-side state the acceptance SQL doesn't touch
sql(`delete from public.message_notify_log where sender_id in ('${A}','${B}')`);
sql(`update public.intro_log set sender_notified_at = null where sender_id = '${A}' and recipient_id = '${B}'`);
const row = (id) => {
  const [sender_id, recipient_id, created_at] = sql(`select sender_id, recipient_id, created_at from public.messages where id = '${id}'`).split('|');
  return { id, sender_id, recipient_id, created_at };
};
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };

// (a) the intro lands → the receiver's normal first-message email
const a = await planFor({ type: 'INSERT', table: 'messages', record: row(INTRO) });
check('(a) intro row plans an email to the receiver', !!a && a.recipientIds.length === 1 && a.recipientIds[0] === B, JSON.stringify(a && a.recipientIds));
const aMail = a ? a.make('https://example.test/unsub') : null;
check('(a) subject is the normal "messaged you"', !!aMail && /messaged you on Nested$/.test(aMail.subject), aMail && aMail.subject);
if (a && a.onSent) await a.onSent(B);   // mimic the confirmed send: logs the pair

// (b) B's first reply → the intro's sender hears back
const b = await planFor({ type: 'INSERT', table: 'messages', record: row(REPLY) });
check('(b) first reply plans an email to the intro sender', !!b && b.recipientIds.length === 1 && b.recipientIds[0] === A, JSON.stringify(b && b.recipientIds));
const bMail = b ? b.make('https://example.test/unsub') : null;
check('(b) subject is "wants to message you on Nested"', !!bMail && /wants to message you on Nested$/.test(bMail.subject), bMail && bMail.subject);
check('(b) CTA points at the replier\'s thread', !!bMail && bMail.html.includes('/messages/intro_b'));
if (b && b.onSent) await b.onSent(A);   // stamps intro_log.sender_notified_at
mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });
if (bMail) writeFileSync(new URL('./shots/intro-reply-email.html', import.meta.url), bMail.html);

// (c) a second reply from B → quiet
const c = await planFor({ type: 'INSERT', table: 'messages', record: { ...row(REPLY), id: '10000000-0000-0000-0000-00000000000a', created_at: new Date().toISOString() } });
check('(c) a second reply plans nothing', c === null, JSON.stringify(c && c.recipientIds));
check('(c) intro_log.sender_notified_at is stamped', sql(`select sender_notified_at is not null from public.intro_log where sender_id='${A}' and recipient_id='${B}'`) === 't');

// (d) the sender writes again BEFORE any reply → quiet (the pair is logged, and it's the wrong direction for the intro branch)
sql(`update public.intro_log set sender_notified_at = null where sender_id = '${A}' and recipient_id = '${B}'`);
const d = await planFor({ type: 'INSERT', table: 'messages', record: { ...row(INTRO), id: '10000000-0000-0000-0000-00000000000b', created_at: new Date().toISOString() } });
check('(d) the sender\'s own second message plans nothing', d === null, JSON.stringify(d && d.recipientIds));
check('(d) … and does not stamp the intro', sql(`select sender_notified_at is null from public.intro_log where sender_id='${A}' and recipient_id='${B}'`) === 't');

// (e) the same intro row delivered twice by the webhook → the receiver is NOT emailed twice
const e = await planFor({ type: 'INSERT', table: 'messages', record: row(INTRO) });
check('(e) redelivery of the intro row plans nothing (pair already logged)', e === null, JSON.stringify(e && e.recipientIds));

// (f) a normal pair with no intro: first message emails, second is quiet (regression)
const C = 'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3';
sql(`delete from public.message_notify_log where sender_id in ('${B}','${C}') or recipient_id in ('${B}','${C}')`);
sql(`delete from public.messages where (sender_id='${B}' and recipient_id='${C}') or (sender_id='${C}' and recipient_id='${B}')`);
const first = { id: '10000000-0000-0000-0000-00000000000c', sender_id: B, recipient_id: C, created_at: new Date().toISOString() };
const f1 = await planFor({ type: 'INSERT', table: 'messages', record: first });
check('(f) a normal first message still plans the receiver email', !!f1 && f1.recipientIds[0] === C, JSON.stringify(f1 && f1.recipientIds));
if (f1 && f1.onSent) await f1.onSent(C);
sql(`insert into public.messages (id, sender_id, recipient_id, body_enc, created_at) values ('${first.id}', '${B}', '${C}', '\\x00'::bytea, '${first.created_at}')`);
const f2 = await planFor({ type: 'INSERT', table: 'messages', record: { id: '10000000-0000-0000-0000-00000000000d', sender_id: C, recipient_id: B, created_at: new Date(Date.now() + 1000).toISOString() } });
check('(f) the normal pair\'s reply plans nothing (no intro → no reply email)', f2 === null, JSON.stringify(f2 && f2.recipientIds));
sql(`delete from public.messages where id = '${first.id}'`);

const fails = results.filter((r) => !r).length;
console.log(`${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
