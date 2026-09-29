import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { applyLedgerAdjustment } from '@/lib/cash-in-hand-ledger';

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
      const updatedThrough = await applyLedgerAdjustment(client, entryDate, amount, note);
      if (!updatedThrough) {
        await client.query('ROLLBACK');
        return NextResponse.json({ error: 'No cash-in-hand ledger entry for that date' }, { status: 404 });
      }
      await client.query('COMMIT');
      return NextResponse.json({ ok: true, updatedThrough });
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
