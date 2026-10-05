import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';
import { transferEffect, validateTransfer } from '@/lib/accounts';
import { applyLedgerAdjustment } from '@/lib/cash-in-hand-ledger';

export const dynamic = 'force-dynamic';

// POST { date, fromId, toId, amount, charge, note } — fromId / toId null = cash in hand.
// The destination receives amount − charge. When cash is one side, the same amount is applied to Cash in Hand as a
// reconciliation adjustment on the latest ledger day on/before `date` (cascading forward), the way investment returns are.
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const fromId = body?.fromId == null || body.fromId === '' ? null : Number(body.fromId);
  const toId = body?.toId == null || body.toId === '' ? null : Number(body.toId);
  const amount = coerceLocaleNumber(body?.amount);
  const charge = coerceLocaleNumber(body?.charge) ?? 0;
  const date = body?.date;
  const note = String(body?.note || '').trim() || null;

  const client = await getPool().connect();
  try {
    const { rows: accounts } = await client.query(`SELECT id, name, active, to_char(starting_date, 'YYYY-MM-DD') AS starting_date FROM payment_accounts`);
    const problem = validateTransfer({ fromId, toId, amount, charge, date, accounts });
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const nameOf = (id) => (id == null ? 'Cash' : accounts.find((a) => a.id === id).name);
    const eff = transferEffect({ amount, charge });
    const cashDelta = fromId == null ? -eff.out : toId == null ? eff.in : 0;

    await client.query('BEGIN');
    let ledgerDate = null;
    if (cashDelta !== 0) {
      const target = await client.query(`SELECT entry_date FROM cash_in_hand_ledger WHERE entry_date <= $1 ORDER BY entry_date DESC LIMIT 1`, [date]);
      if (target.rows.length) {
        ledgerDate = target.rows[0].entry_date;
        await applyLedgerAdjustment(client, ledgerDate, cashDelta,
          `Transfer ${nameOf(fromId)} → ${nameOf(toId)} (${date})${eff.charge ? `, charge ${eff.charge}` : ''}${note ? ` — ${note}` : ''}`);
      }
    }
    const { rows } = await client.query(
      `INSERT INTO account_transfers (transfer_date, from_account_id, to_account_id, amount, charge, note, ledger_entry_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [date, fromId, toId, eff.out, eff.charge, note, ledgerDate]
    );
    await client.query('COMMIT');
    return NextResponse.json({ ok: true, id: rows[0].id, cashApplied: cashDelta === 0 ? null : !!ledgerDate });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE ?id=N — remove a transfer; if cash was one side, that Cash in Hand adjustment is reversed.
export async function DELETE(request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `DELETE FROM account_transfers WHERE id = $1
       RETURNING from_account_id, to_account_id, amount::float AS amount, charge::float AS charge, ledger_entry_date,
                 to_char(transfer_date, 'YYYY-MM-DD') AS transfer_date`, [id]);
    if (!rows.length) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Not found' }, { status: 404 }); }
    const t = rows[0];
    if (t.ledger_entry_date) {
      const eff = transferEffect(t);
      const reverse = t.from_account_id == null ? +eff.out : -eff.in; // undo what was applied to cash
      await applyLedgerAdjustment(client, t.ledger_entry_date, reverse, `Reversed transfer of ${eff.out} (${t.transfer_date})`);
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
