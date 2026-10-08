// One-off (2026-10-08): create the bkash_notifications table (raw relay notifications).
// The SQL is the "bkash-notifications" block of schema.sql (idempotent: IF NOT EXISTS everywhere).
//   node scripts/2026-10-08-bkash-notifications.mjs            # dry run (rolls back)
//   node scripts/2026-10-08-bkash-notifications.mjs --apply
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');
const block = schema.slice(schema.indexOf('-- BEGIN bkash-notifications'), schema.indexOf('-- END bkash-notifications'));
if (!block.includes('CREATE TABLE')) throw new Error('bkash-notifications block not found in schema.sql');
const url = process.env.TARGET_URL || fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8').match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];
const pool = new pg.Pool({ connectionString: url, ssl: process.env.TARGET_URL ? false : { rejectUnauthorized: false } });
const APPLY = process.argv.includes('--apply');
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query(block);
  const t = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = 'bkash_notifications'`);
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: table ${t.rows.map((r) => r.table_name).join(', ') || 'MISSING'}`);
  if (t.rowCount !== 1) throw new Error('bkash_notifications is missing after the migration');
  if (APPLY) { await c.query('COMMIT'); console.log('COMMITTED'); } else { await c.query('ROLLBACK'); console.log('rolled back (dry run)'); }
} catch (e) { await c.query('ROLLBACK'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; }
finally { c.release(); await pool.end(); }
