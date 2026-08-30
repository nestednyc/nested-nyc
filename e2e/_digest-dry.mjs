// Dry-run the weekly digest handler against the LOCAL stack: no send, prints
// the plan and writes the sample email to e2e/shots/digest-sample.html.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const env = {};
for (const line of execSync('supabase status -o env', { encoding: 'utf8' }).split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
}
process.env.SUPABASE_URL = env.API_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SERVICE_ROLE_KEY;
process.env.WEBHOOK_SECRET = 'local-test-secret';
process.env.APP_URL = 'http://127.0.0.1:5174';
const { default: handler } = await import('../api/digest.js');
const req = { method: 'GET', headers: { 'x-webhook-secret': 'local-test-secret' }, query: { dry: '1' } };
let status = 0, body = null;
const res = { status(s) { status = s; return this; }, json(b) { body = b; return this; } };
await handler(req, res);
console.log('status', status);
console.log(JSON.stringify({ ...body, sample: body && body.sample ? { to: body.sample.to, subject: body.sample.subject, htmlBytes: body.sample.html.length } : null }, null, 2));
if (body && body.sample) writeFileSync(new URL('./shots/digest-sample.html', import.meta.url), body.sample.html);
// unauthorized probe
let s2 = 0; await handler({ method: 'GET', headers: {}, query: {} }, { status(s) { s2 = s; return this; }, json() { return this; } });
console.log('unauthorized →', s2);
