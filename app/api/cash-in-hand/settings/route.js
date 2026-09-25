import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { backfillLedger } from '@/lib/cash-in-hand-ledger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getPool();
    const { rows } = await pool.query(`SELECT * FROM cash_in_hand_settings WHERE id = 1`);
    return NextResponse.json({ settings: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST { startingDate, startingBalance, note? } -> one-time setup. Backfills
// a ledger row for every existing daily_entries row from startingDate to
// today. Refuses if already set — correcting it afterward goes through a
// reconciliation adjustment instead (see /api/cash-in-hand/adjustments),
// never a silent overwrite.
export async function POST(request) {
  try {
    const body = await request.json();
    const startingDate = body.startingDate;
    const startingBalance = Number(body.startingBalance);
    const note = body.note ? String(body.note).trim() : null;

    if (!startingDate || !/^\d{4}-\d{2}-\d{2}$/.test(startingDate)) {
      return NextResponse.json({ error: 'startingDate (YYYY-MM-DD) is required' }, { status: 400 });
    }
    if (!Number.isFinite(startingBalance)) {
      return NextResponse.json({ error: 'startingBalance must be a number' }, { status: 400 });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(`SELECT starting_date FROM cash_in_hand_settings WHERE id = 1`);
      if (existing.rows[0]?.starting_date) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Starting balance is already set. To correct it, add a reconciliation adjustment instead.' },
          { status: 409 }
        );
      }
      await client.query(
        `UPDATE cash_in_hand_settings SET starting_date = $1, starting_balance = $2, note = $3, set_at = now() WHERE id = 1`,
        [startingDate, startingBalance, note]
      );
      await backfillLedger(client, startingDate, startingBalance);
      await client.query('COMMIT');
      return NextResponse.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
