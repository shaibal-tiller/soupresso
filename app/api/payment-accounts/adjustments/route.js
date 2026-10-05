import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';

export const dynamic = 'force-dynamic';

// POST { accountId, date, amount, note } — a correction (+/−) so the account matches its real balance. Note required.
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const accountId = Number(body?.accountId);
  const amount = coerceLocaleNumber(body?.amount);
  const note = String(body?.note || '').trim();
  const date = body?.date;
  if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 });
  if (amount == null || amount === 0) return NextResponse.json({ error: 'amount must be a non-zero number' }, { status: 400 });
  if (!note) return NextResponse.json({ error: 'note is required — say why the balance is being corrected' }, { status: 400 });
  try {
    const acc = await getPool().query(`SELECT to_char(starting_date, 'YYYY-MM-DD') AS starting_date FROM payment_accounts WHERE id = $1`, [accountId]);
    if (!acc.rows.length) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    if (date < acc.rows[0].starting_date) return NextResponse.json({ error: `The account starts on ${acc.rows[0].starting_date} — pick a later date` }, { status: 400 });
    const { rows } = await getPool().query(`INSERT INTO account_adjustments (account_id, adj_date, amount, note) VALUES ($1, $2, $3, $4) RETURNING id`, [accountId, date, amount, note]);
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE ?id=N
export async function DELETE(request) {
  const id = Number(new URL(request.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    const { rowCount } = await getPool().query(`DELETE FROM account_adjustments WHERE id = $1`, [id]);
    if (!rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
