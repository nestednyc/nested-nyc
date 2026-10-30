/* ============================================================
   Canary for scripts/test-env.mjs: `npm test` preloads it with
   `node --import`, and node's test runner must carry that flag into
   this child process. If the scrub ever stops running, api tests would
   import their modules against whatever secrets the shell (or the
   Vercel build) carries. Run: npm test
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('the test-env preload ran in this process and left no backend secrets behind', () => {
  assert.equal(process.env.NESTED_TEST_ENV_SCRUBBED, '1', 'scripts/test-env.mjs was not preloaded — is `npm test` still `node --import ./scripts/test-env.mjs --test`?');
  for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'VITE_SUPABASE_URL', 'RESEND_VERCEL_KEY', 'RESEND_API_KEY', 'WEBHOOK_SECRET', 'UNSUBSCRIBE_SECRET', 'CRON_SECRET']) {
    assert.equal(process.env[k], undefined, `${k} survived the scrub`);
  }
});
