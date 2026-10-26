// One-time fix: on 24 Oct 2026 the shop reopened after vacation and 3050 taka
// of starting bhangti was placed in the cash box from Cash in Hand. This was
// never recorded, leaving Cash in Hand overstated by 3050 from that date
// forward. This script applies a -3050 reconciliation adjustment to the Oct 24
// ledger row and cascades it through every later row.
//
// Run once:
//   node scripts/2026-10-24-bhangti-adjustment.js
// Requires DATABASE_URL to be set (loads .env.local automatically).

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

async function main() {
  loadEnvLocal();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Add it to .env.local first.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  const TARGET_DATE = '2026-10-24';
  const ADJUSTMENT = -3050;
  const NOTE = 'Starting bhangti (৳3050) placed in box from Cash in Hand at shop reopening after vacation';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find the ledger row at or nearest after the target date.
    const targetRes = await client.query(
      `SELECT entry_date FROM cash_in_hand_ledger WHERE entry_date >= $1 ORDER BY entry_date ASC LIMIT 1`,
      [TARGET_DATE]
    );
    if (!targetRes.rows.length) {
      console.log('No cash-in-hand ledger rows found on or after', TARGET_DATE);
      console.log('Make sure daily entries for that period have been saved first.');
      await client.query('ROLLBACK');
      return;
    }

    const adjustDate = targetRes.rows[0].entry_date;
    if (String(adjustDate).slice(0, 10) !== TARGET_DATE) {
      console.log(`No ledger row exactly on ${TARGET_DATE}; applying to nearest row: ${String(adjustDate).slice(0, 10)}`);
    }

    // Load all rows from that date forward to cascade the adjustment.
    const laterRes = await client.query(
      `SELECT * FROM cash_in_hand_ledger WHERE entry_date >= $1 ORDER BY entry_date ASC`,
      [adjustDate]
    );
    const rows = laterRes.rows;

    // Apply cascade.
    rows[0].adjustment_delta = round2(Number(rows[0].adjustment_delta) + ADJUSTMENT);
    for (let i = 0; i < rows.length; i++) {
      if (i > 0) rows[i].opening_balance = rows[i - 1].closing_balance;
      rows[i].closing_balance = round2(
        Number(rows[i].opening_balance) + Number(rows[i].day_delta) + Number(rows[i].adjustment_delta)
      );
    }

    for (const row of rows) {
      await client.query(
        `UPDATE cash_in_hand_ledger SET opening_balance = $1, adjustment_delta = $2, closing_balance = $3, updated_at = now()
         WHERE entry_date = $4`,
        [row.opening_balance, row.adjustment_delta, row.closing_balance, row.entry_date]
      );
    }

    await client.query(
      `INSERT INTO cash_in_hand_adjustments (entry_date, amount, note) VALUES ($1, $2, $3)`,
      [adjustDate, ADJUSTMENT, NOTE]
    );

    await client.query('COMMIT');

    const last = rows[rows.length - 1];
    console.log(`Done. Adjustment of ৳${ADJUSTMENT} applied from ${String(adjustDate).slice(0, 10)}.`);
    console.log(`Cash in Hand balance is now ৳${last.closing_balance} as of ${String(last.entry_date).slice(0, 10)}.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
