/* Remove all demo data created by scripts/seed.mjs (deletes the seeded auth
 * users → every seeded row cascades away). Never touches real accounts.
 *   node scripts/unseed.mjs   (or: npm run unseed) */
import { run } from './seed.mjs'
run({ down: true }).catch((e) => { console.error('✗ ' + e.message); process.exit(1) })
