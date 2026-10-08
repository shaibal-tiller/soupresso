// One-off (2026-10-08): add the history/SMS columns to bkash_transactions (the "bkash-history" block of schema.sql),
// then import payments copied from the phone's notification history. Idempotent: rows are keyed by event_id.
//   node scripts/2026-10-08-bkash-history.mjs            # dry run (rolls back)
//   node scripts/2026-10-08-bkash-history.mjs --apply
//   node scripts/2026-10-08-bkash-history.mjs --apply --schema-only   # columns only, no history rows yet
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// 7 Oct 2026, from the Merchant app's notification history (it shows only the date for older entries). Listed
// oldest → newest as the screenshot orders them (newest first); the stored time is a placeholder, time_known = false.
// Together they are the ৳330 typed for the day in the daily entry.
const HISTORY = [
  { eventId: 'history-2026-10-07-1', date: '2026-10-07', minute: 1, amount: 80,  sender: '0168XXX7142',   operator: 'bKash' },
  { eventId: 'history-2026-10-07-2', date: '2026-10-07', minute: 2, amount: 70,  sender: '0168XXX7142',   operator: 'bKash' },
  { eventId: 'history-2026-10-07-3', date: '2026-10-07', minute: 3, amount: 180, sender: '1073XXXXX0001', operator: 'NPSB - Other Banks' },
];

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');
const block = schema.slice(schema.indexOf('-- BEGIN bkash-history'), schema.indexOf('-- END bkash-history'));
if (!block.includes('time_known')) throw new Error('bkash-history block not found in schema.sql');
const url = process.env.TARGET_URL || fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8').match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];
// Verify the server certificate; plaintext only for a local target.
const isLocal = ['localhost', '127.0.0.1'].includes(new URL(url).hostname);
const pool = new pg.Pool({ connectionString: url, ssl: isLocal ? false : { rejectUnauthorized: true } });
const APPLY = process.argv.includes('--apply');
const SCHEMA_ONLY = process.argv.includes('--schema-only');
const c = await pool.connect();
try {
  await c.query('BEGIN');
  await c.query(block);
  let added = 0;
  for (const h of SCHEMA_ONLY ? [] : HISTORY) {
    // midnight Asia/Dhaka (+06:00) of that date, plus the placeholder minute that keeps the day's order
    const at = `${h.date}T00:0${h.minute}:00+06:00`;
    const r = await c.query(
      `INSERT INTO bkash_transactions (event_id, amount, occurred_at, sender, sender_operator, sender_last4, source, time_known)
       VALUES ($1, $2, $3, $4, $5, $6, 'history', false) ON CONFLICT (event_id) DO NOTHING`,
      [h.eventId, h.amount, at, h.sender, h.operator, /(\d{4})$/.exec(h.sender)[1]]);
    added += r.rowCount;
  }
  const day = await c.query(`SELECT count(*)::int AS n, sum(amount)::float AS total FROM bkash_transactions WHERE source = 'history' AND (occurred_at AT TIME ZONE 'Asia/Dhaka')::date = '2026-10-07'`);
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: added ${added}; 7 Oct history rows: ${day.rows[0].n}, total ৳${day.rows[0].total}`);
  if (!SCHEMA_ONLY && day.rows[0].total !== 330) throw new Error('7 Oct history should add up to the 330 typed in the daily entry');
  if (APPLY) { await c.query('COMMIT'); console.log('COMMITTED'); } else { await c.query('ROLLBACK'); console.log('rolled back (dry run)'); }
} catch (e) { await c.query('ROLLBACK'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; }
finally { c.release(); await pool.end(); }
