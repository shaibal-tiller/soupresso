// One-off (2026-10-06): create the payment-account tables and daily_entries.digital_sales.
// The SQL is the "payment-accounts" block of schema.sql (idempotent: IF NOT EXISTS everywhere).
//   node scripts/2026-10-06-payment-accounts.mjs            # dry run (rolls back)
//   node scripts/2026-10-06-payment-accounts.mjs --apply
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');
const block = schema.slice(schema.indexOf('-- BEGIN payment-accounts'), schema.indexOf('-- END payment-accounts'));
if (!block.includes('CREATE TABLE')) throw new Error('payment-accounts block not found in schema.sql');
const url = process.env.TARGET_URL || fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8').match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];
const pool = new pg.Pool({ connectionString: url, ssl: process.env.TARGET_URL ? false : { rejectUnauthorized: false } });
const APPLY = process.argv.includes('--apply');
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query(block);
  const t = await c.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('payment_accounts','account_sales','account_transfers','account_adjustments') ORDER BY 1`);
  const col = await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='daily_entries' AND column_name='digital_sales'`);
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: tables ${t.rows.map((r) => r.table_name).join(', ')} | digital_sales column: ${col.rowCount ? 'yes' : 'NO'}`);
  if (t.rowCount !== 4 || !col.rowCount) throw new Error('something is missing after the migration');
  if (APPLY) { await c.query('COMMIT'); console.log('COMMITTED'); } else { await c.query('ROLLBACK'); console.log('rolled back (dry run)'); }
} catch (e) { await c.query('ROLLBACK'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; }
finally { c.release(); await pool.end(); }
