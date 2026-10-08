// One-off (2026-10-08): add payment_accounts.relay_from (when the bKash relay starts counting).
// The SQL is the "bkash-relay-cutover" block of schema.sql (idempotent: IF NOT EXISTS everywhere).
//   node scripts/2026-10-08-bkash-relay-cutover.mjs            # dry run (rolls back)
//   node scripts/2026-10-08-bkash-relay-cutover.mjs --apply
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');
const block = schema.slice(schema.indexOf('-- BEGIN bkash-relay-cutover'), schema.indexOf('-- END bkash-relay-cutover'));
if (!block.includes('relay_from')) throw new Error('bkash-relay-cutover block not found in schema.sql');
const url = process.env.TARGET_URL || fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8').match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];
// Verify the server certificate; plaintext only for a local target (e.g. a Docker restore database).
const isLocal = ['localhost', '127.0.0.1'].includes(new URL(url).hostname);
const pool = new pg.Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: true } });
const APPLY = process.argv.includes('--apply');
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query(block);
  const col = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='payment_accounts' AND column_name='relay_from'`);
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: relay_from column: ${col.rowCount ? 'yes' : 'NO'}`);
  if (!col.rowCount) throw new Error('relay_from is missing after the migration');
  if (APPLY) { await c.query('COMMIT'); console.log('COMMITTED'); } else { await c.query('ROLLBACK'); console.log('rolled back (dry run)'); }
} catch (e) { await c.query('ROLLBACK'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; }
finally { c.release(); await pool.end(); }
