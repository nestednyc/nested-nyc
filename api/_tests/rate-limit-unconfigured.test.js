/* ============================================================
   api/_rate-limit.js with no service-role key: the module must build no
   client and limit() must allow everything without touching the network.
   (Its own file because the client is created at import time.) The
   configured contract is in rate-limit.test.js. Run: npm test
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';

delete process.env.SUPABASE_URL;
delete process.env.VITE_SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
globalThis.fetch = () => { throw new Error('the limiter must not touch the network when unconfigured'); };
const { limit } = await import('../_rate-limit.js');

test('limit: unconfigured → every call allowed, nothing counted, no network', async () => {
  for (let i = 0; i < 3; i++) assert.equal(await limit('check-email:1.2.3.4', 1, 60), true);
});
