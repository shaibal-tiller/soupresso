// One-off (2026-10-03): add bazar_items.expense_type and tag every item using lib/expense-type-map.js.
//   node scripts/2026-10-03-expense-types.mjs            # dry run: shows what would be set, changes nothing
//   node scripts/2026-10-03-expense-types.mjs --apply    # adds the column (if needed) and tags every item, in one transaction
// Items that already have a type are left alone unless --overwrite is given (so manual choices survive a re-run).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { expenseTypeFor } from '../lib/expense-types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8');
const pool = new pg.Pool({ connectionString: env.match(/^DATABASE_URL="?([^"\n]+)"?/m)[1], ssl: { rejectUnauthorized: false } });
const APPLY = process.argv.includes('--apply');
const OVERWRITE = process.argv.includes('--overwrite');

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(`ALTER TABLE bazar_items ADD COLUMN IF NOT EXISTS expense_type TEXT CHECK (expense_type IN ('cost_of_goods', 'operational', 'overhead'))`);
  const { rows } = await client.query(`SELECT id, name, category, expense_type, active FROM bazar_items ORDER BY category, name`);
  const counts = {}; let untouched = 0; const unknown = [];
  for (const it of rows) {
    if (it.expense_type && !OVERWRITE) { untouched++; continue; }
    const m = expenseTypeFor(it.category, it.name);
    if (!m) { unknown.push(`${it.category} / ${it.name}`); continue; }
    await client.query(`UPDATE bazar_items SET expense_type = $1 WHERE id = $2`, [m[0], it.id]);
    counts[m[0]] = (counts[m[0]] || 0) + 1;
  }
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${rows.length} items`, counts, `| already tagged (kept): ${untouched}`, `| no rule (left blank): ${unknown.length}`);
  unknown.forEach((u) => console.log('  no rule for:', u));
  const check = await client.query(`SELECT expense_type, count(*)::int n FROM bazar_items GROUP BY 1 ORDER BY 1`);
  console.log('result:', JSON.stringify(check.rows));
  if (APPLY) { await client.query('COMMIT'); console.log('COMMITTED'); } else { await client.query('ROLLBACK'); console.log('rolled back (dry run)'); }
} catch (e) { await client.query('ROLLBACK'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; }
finally { client.release(); await pool.end(); }
