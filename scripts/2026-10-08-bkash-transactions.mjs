// One-off (2026-10-08): create the bkash_transactions table (parsed relay payments).
// The SQL is the "bkash-transactions" block of schema.sql (idempotent: IF NOT EXISTS everywhere).
//   node scripts/2026-10-08-bkash-transactions.mjs            # dry run (rolls back)
//   node scripts/2026-10-08-bkash-transactions.mjs --apply
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');
const block = schema.slice(schema.indexOf('-- BEGIN bkash-transactions'), schema.indexOf('-- END bkash-transactions'));
if (!block.includes('CREATE TABLE')) throw new Error('bkash-transactions block not found in schema.sql');
const url = process.env.TARGET_URL || fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8').match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];
// Verify the server certificate; plaintext only for a local target (e.g. a Docker restore database).
const isLocal = ['localhost', '127.0.0.1'].includes(new URL(url).hostname);
const pool = new pg.Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: true } });
const APPLY = process.argv.includes('--apply');
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query(block);
  const t = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = 'bkash_transactions'`);
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: table ${t.rows.map((r) => r.table_name).join(', ') || 'MISSING'}`);
  if (t.rowCount !== 1) throw new Error('bkash_transactions is missing after the migration');
  if (APPLY) { await c.query('COMMIT'); console.log('COMMITTED'); } else { await c.query('ROLLBACK'); console.log('rolled back (dry run)'); }
} catch (e) { await c.query('ROLLBACK'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; }
finally { c.release(); await pool.end(); }
