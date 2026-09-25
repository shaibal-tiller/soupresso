// Server-side (DB-touching) helpers for the Cash in Hand ledger. Pure math
// lives in lib/cash-in-hand.js; this file is the I/O layer API routes call.
// All functions take a connected pg client (so callers control the
// transaction) rather than the shared pool directly.
import { computeClosingBalance } from './cash-in-hand';

// Confirms any pending day whose 24h window has elapsed — the lazy
// alternative to a cron job (see spec, Decision 2). Cheap, idempotent; call
// at the top of any GET route that reads the ledger.
export async function confirmEligibleDays(client) {
  await client.query(
    `UPDATE cash_in_hand_ledger SET status = 'confirmed', confirmed_at = now()
     WHERE status = 'pending' AND pending_since <= now() - interval '24 hours'`
  );
}

// Called after a daily_entries upsert (see app/api/entries/route.js). If
// cash-in-hand tracking is active for this date, upserts its ledger row
// (unless already confirmed — a regular entry edit never touches a frozen
// row) and confirms the previous calendar day if it's still pending.
export async function upsertLedgerForEntry(client, entryDate, cashTakenHome) {
  const settingsRes = await client.query(
    `SELECT starting_balance FROM cash_in_hand_settings
      WHERE id = 1 AND starting_date IS NOT NULL AND starting_date <= $1`,
    [entryDate]
  );
  if (!settingsRes.rows.length) return; // tracking not active, or this date predates it

  const existing = await client.query(`SELECT * FROM cash_in_hand_ledger WHERE entry_date = $1`, [entryDate]);
  if (existing.rows.length && existing.rows[0].status === 'confirmed') return;

  const prevRes = await client.query(
    `SELECT closing_balance FROM cash_in_hand_ledger WHERE entry_date < $1 ORDER BY entry_date DESC LIMIT 1`,
    [entryDate]
  );
  const opening = prevRes.rows.length ? Number(prevRes.rows[0].closing_balance) : Number(settingsRes.rows[0].starting_balance);
  const adjustmentDelta = existing.rows.length ? Number(existing.rows[0].adjustment_delta) : 0;
  const closing = computeClosingBalance({ openingBalance: opening, dayDelta: cashTakenHome, adjustmentDelta });

  await client.query(
    `INSERT INTO cash_in_hand_ledger (entry_date, opening_balance, day_delta, adjustment_delta, closing_balance, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')
     ON CONFLICT (entry_date) DO UPDATE SET
       opening_balance = EXCLUDED.opening_balance, day_delta = EXCLUDED.day_delta,
       closing_balance = EXCLUDED.closing_balance, updated_at = now()`,
    [entryDate, opening, cashTakenHome, adjustmentDelta, closing]
  );

  // "Next day's entry exists" confirms yesterday, if it's still pending.
  await client.query(
    `UPDATE cash_in_hand_ledger SET status = 'confirmed', confirmed_at = now()
     WHERE entry_date = ($1::date - interval '1 day')::date AND status = 'pending'`,
    [entryDate]
  );
}

// Called once, when the starting balance is first set. Walks every
// daily_entries row from startingDate to today and creates its ledger row.
// All but the most recent are marked confirmed immediately (they're
// history, not subject to a cooling period); the most recent stays pending
// so the normal lifecycle picks up from there.
export async function backfillLedger(client, startingDate, startingBalance) {
  const entriesRes = await client.query(
    `SELECT entry_date, cash_taken_home FROM daily_entries WHERE entry_date >= $1 ORDER BY entry_date ASC`,
    [startingDate]
  );
  let opening = Number(startingBalance);
  const rows = entriesRes.rows;
  for (let i = 0; i < rows.length; i++) {
    const dayDelta = Number(rows[i].cash_taken_home);
    const closing = computeClosingBalance({ openingBalance: opening, dayDelta, adjustmentDelta: 0 });
    const isLast = i === rows.length - 1;
    await client.query(
      `INSERT INTO cash_in_hand_ledger (entry_date, opening_balance, day_delta, adjustment_delta, closing_balance, status, confirmed_at)
       VALUES ($1, $2, $3, 0, $4, $5, $6)
       ON CONFLICT (entry_date) DO NOTHING`,
      [rows[i].entry_date, opening, dayDelta, closing, isLast ? 'pending' : 'confirmed', isLast ? null : new Date()]
    );
    opening = closing;
  }
}
