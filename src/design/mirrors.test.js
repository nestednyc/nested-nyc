/* ============================================================
   Client ↔ database mirrors. A few client constants are hand-copied
   from SQL (and the legal docs) and vice versa; these tests fail the
   moment one side moves without the other. Pure: reads the migration
   files + legal/*.md, imports data.js. Run: npm test

   How a definition is found: SQL comments are stripped, the LAST
   migration that creates the function (any `CREATE [OR REPLACE]
   FUNCTION [public.]name(` form) is taken, and the assertions run on
   that function's body only. If a later migration touches the function
   in a form this test does not recognise (e.g. a DROP without a CREATE,
   or a rename), it fails loud instead of silently checking a stale body.
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNIVERSITIES, UNI, isSupportedEduEmail, uniByEmailDomain, MAX_STUDENT_CLUBS, TERMS_VERSION } from './data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');

// [{ file, sql }] in apply order, `--` comments removed (header comments
// quote error strings verbatim, which would otherwise match).
const migrations = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((file) => ({ file, sql: readFileSync(path.join(MIGRATIONS, file), 'utf8').replace(/--[^\n]*/g, '') }));

// The live body of `name`: the function created by the last migration that
// creates it. Fails if any migration mentions the function in a CREATE/DROP
// form this does not parse, so an unrecognised redefinition can't go stale.
function liveFunction(name) {
  const create = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(?:public\\.)?${name}\\s*\\(`, 'i');
  const mention = new RegExp(`\\bFUNCTION\\s+(?:IF\\s+EXISTS\\s+)?(?:public\\.)?${name}\\b`, 'i');
  const touching = migrations.filter((m) => mention.test(m.sql));
  assert.ok(touching.length, `no migration mentions ${name}()`);
  const last = touching[touching.length - 1];
  const at = last.sql.search(create);
  assert.ok(at >= 0, `${last.file} touches ${name}() without a CREATE this test can parse — update liveFunction()`);
  const body = last.sql.slice(at);
  const open = body.indexOf('$$');
  const close = body.indexOf('$$', open + 2);
  assert.ok(open >= 0 && close > open, `${last.file}: ${name}() has no $$ body`);
  return { file: last.file, body: body.slice(0, close + 2) };
}

test('is_supported_edu_email(): the SQL allowlist equals UNIVERSITIES[].domain and matches the same way the client does', () => {
  const { file, body } = liveFunction('is_supported_edu_email');
  const m = body.match(/ARRAY\[([\s\S]*?)\]/);
  assert.ok(m, `${file}: could not find the ARRAY[...] allowlist`);
  const sqlDomains = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1].toLowerCase()).sort();
  const clientDomains = UNIVERSITIES.map((u) => u.domain.toLowerCase()).sort();
  assert.deepEqual(sqlDomains, clientDomains, `${file} and data.js UNIVERSITIES disagree`);
  assert.equal(new Set(sqlDomains).size, sqlDomains.length, 'duplicate domain in the allowlist');
  for (const u of UNIVERSITIES) assert.equal(UNI[u.id], u, `UNI is not keyed by id for ${u.id}`);
  // uniByEmailDomain: `at === u.domain || at.endsWith("." + u.domain)` — the
  // SQL must keep both halves (exact domain, or a subdomain of it).
  assert.match(body, /lower\(/, `${file}: the SQL no longer lower-cases the domain`);
  assert.match(body, /dom\.d\s*=\s*allowed\.dom_allowed/, `${file}: exact-domain match clause changed`);
  assert.match(body, /dom\.d\s+LIKE\s+'%\.'\s*\|\|\s*allowed\.dom_allowed/, `${file}: subdomain clause changed — the client accepts sub.nyu.edu`);
});

test('isSupportedEduEmail (client half): exact domain or a subdomain, case-insensitive, never a look-alike', () => {
  assert.equal(isSupportedEduEmail('ada@nyu.edu'), true);
  assert.equal(isSupportedEduEmail('Ada@Stern.NYU.EDU'), true);
  assert.equal(uniByEmailDomain('ada@stern.nyu.edu')?.id, uniByEmailDomain('ada@nyu.edu')?.id);
  assert.equal(isSupportedEduEmail('ada@notnyu.edu'), false);
  assert.equal(isSupportedEduEmail('ada@nyu.edu.evil.com'), false);
  assert.equal(isSupportedEduEmail('ada@harvard.edu'), false);
  assert.equal(isSupportedEduEmail('ada@gmail.com'), false);
  assert.equal(isSupportedEduEmail(''), false);
  assert.equal(isSupportedEduEmail(null), false);
  assert.equal(isSupportedEduEmail('nyu.edu'), false);
});

test('MAX_STUDENT_CLUBS mirrors the org_student_run_guard cap (the check and the PT422 message)', () => {
  const { file, body } = liveFunction('org_student_run_guard');
  const guard = body.match(/IF\s+v_n\s*>=\s*(\d+)\s+THEN/);
  const message = body.match(/RAISE\s+EXCEPTION\s+'you already run (\d+) clubs/);
  assert.ok(guard, `${file}: the \`IF v_n >= N THEN\` cap check is gone or reshaped — update this test with it`);
  assert.ok(message, `${file}: the 'you already run N clubs' message is gone or reworded — update this test with it`);
  assert.equal(Number(guard[1]), MAX_STUDENT_CLUBS, `${file} caps at ${guard[1]}, data.js says ${MAX_STUDENT_CLUBS}`);
  assert.equal(Number(message[1]), MAX_STUDENT_CLUBS, `${file}: the PT422 message says ${message[1]}, data.js says ${MAX_STUDENT_CLUBS}`);
});

test('TERMS_VERSION equals the effective date of both legal documents', () => {
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  assert.match(TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/, 'TERMS_VERSION is an ISO date');
  for (const doc of ['terms-of-service.md', 'privacy-policy.md']) {
    const md = readFileSync(path.join(ROOT, 'legal', doc), 'utf8');
    const m = md.match(/\*\*Effective date:\*\*\s*([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})/);
    assert.ok(m, `${doc}: no "**Effective date:** Month D, YYYY" line`);
    const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
    assert.ok(month > 0, `${doc}: unknown month ${m[1]}`);
    const iso = `${m[3]}-${String(month).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    assert.equal(iso, TERMS_VERSION, `${doc} is effective ${m[1]} ${m[2]}, ${m[3]} but TERMS_VERSION is ${TERMS_VERSION} — bump one or the other`);
  }
});
