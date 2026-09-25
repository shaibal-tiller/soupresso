import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { applyAdjustmentCascade } from '@/lib/cash-in-hand';

export const dynamic = 'force-dynamic';

// POST { entryDate, amount, note } -> reconciliation correction. Always
// dated to when it's entered (entryDate is which ledger day it targets —
// any day, confirmed or pending). Never rewrites a confirmed day's own
// day_delta/status; only adjustment_delta on the target day, cascading
// opening/closing_balance forward through every later day.
export async function POST(request) {
  try {
    const body = await request.json();
    const entryDate = body.entryDate;
    const amount = Number(body.amount);
    const note = (body.note || '').trim();

    if (!entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      return NextResponse.json({ error: 'entryDate (YYYY-MM-DD) is required' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: 'amount must be a non-zero number' }, { status: 400 });
    }
    if (!note) {
      return NextResponse.json({ error: 'note is required — every adjustment must explain why' }, { status: 400 });
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const targetRes = await client.query(`SELECT 1 FROM cash_in_hand_ledger WHERE entry_date = $1`, [entryDate]);
      if (!targetRes.rows.length) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'No cash-in-hand ledger entry for that date' }, { status: 404 });
      }

      const laterRes = await client.query(
        `SELECT * FROM cash_in_hand_ledger WHERE entry_date >= $1 ORDER BY entry_date ASC`,
        [entryDate]
      );
      const updated = applyAdjustmentCascade(laterRes.rows, 0, amount);
      for (const row of updated) {
        await client.query(
          `UPDATE cash_in_hand_ledger SET opening_balance = $1, adjustment_delta = $2, closing_balance = $3, updated_at = now()
           WHERE entry_date = $4`,
          [row.opening_balance, row.adjustment_delta, row.closing_balance, row.entry_date]
        );
      }
      await client.query(
        `INSERT INTO cash_in_hand_adjustments (entry_date, amount, note) VALUES ($1, $2, $3)`,
        [entryDate, amount, note]
      );
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, updatedThrough: updated[updated.length - 1]?.entry_date });
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
