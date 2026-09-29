import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';
import { applyLedgerAdjustment } from '@/lib/cash-in-hand-ledger';

export const dynamic = 'force-dynamic';

// GET /api/investment-returns -> every return, newest first.
export async function GET() {
  try {
    const { rows } = await getPool().query(`SELECT * FROM investment_returns ORDER BY returned_on DESC, id DESC`);
    return NextResponse.json({ items: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST { returnedOn, amount, notes } -> record a return and deduct it from
// Cash in Hand. The deduction is a negative ledger adjustment on the latest
// ledger day on/before returnedOn (cascading forward), so it flows through
// every later balance. If cash-in-hand tracking hasn't started (or the return
// predates it) the return is still recorded, just not deducted.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { returnedOn, amount, notes } = body || {};
  if (!returnedOn || !/^\d{4}-\d{2}-\d{2}$/.test(returnedOn)) {
    return NextResponse.json({ error: 'returnedOn (YYYY-MM-DD) is required' }, { status: 400 });
  }
  const amt = coerceLocaleNumber(amount);
  if (amt == null || amt <= 0) {
    return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
  }

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const target = await client.query(
      `SELECT entry_date FROM cash_in_hand_ledger WHERE entry_date <= $1 ORDER BY entry_date DESC LIMIT 1`,
      [returnedOn]
    );
    let ledgerDate = null;
    if (target.rows.length) {
      ledgerDate = target.rows[0].entry_date;
      await applyLedgerAdjustment(client, ledgerDate, -amt, `Investment return (${returnedOn})${notes ? ` — ${notes}` : ''}`);
    }
    const { rows } = await client.query(
      `INSERT INTO investment_returns (returned_on, amount, notes, ledger_entry_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [returnedOn, amt, notes || null, ledgerDate]
    );
    await client.query('COMMIT');
    return NextResponse.json({ item: rows[0], deductedFromCash: !!ledgerDate });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE ?id=N -> remove a return and put its amount back into Cash in Hand.
export async function DELETE(request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`DELETE FROM investment_returns WHERE id = $1 RETURNING *, to_char(returned_on, 'YYYY-MM-DD') AS returned_on_str`, [id]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const r = rows[0];
    if (r.ledger_entry_date) {
      await applyLedgerAdjustment(client, r.ledger_entry_date, Number(r.amount), `Reversed investment return of ${Number(r.amount)} (${r.returned_on_str})`);
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
