import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';
import { todayStrTZ } from '@/lib/dates';
import { computeAccountBalance } from '@/lib/accounts';
import { loadAll } from '@/lib/accounts-db';

export const dynamic = 'force-dynamic';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// POST { accountId, actualBalance }                    -> compare only: { ledger, actual, difference, reconciled, startsRelay }
// POST { accountId, actualBalance, confirm: true, difference, note? }
//   -> starts counting relay payments from today (first time), and if there is a difference records a correction for it.
// The ledger is computed as if the relay counts from today (or from the account's relay_from once set). Nothing is ever
// corrected without the caller confirming the difference it saw and giving a reason.
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const accountId = Number(body?.accountId);
  const actual = coerceLocaleNumber(body?.actualBalance);
  if (!accountId) return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
  if (actual == null) return NextResponse.json({ error: 'actualBalance must be a number' }, { status: 400 });
  const today = todayStrTZ();
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE payment_accounts IN SHARE ROW EXCLUSIVE MODE');
    const { accounts, data } = await loadAll(client);
    const account = accounts.find((a) => a.id === accountId);
    if (!account) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Account not found' }, { status: 404 }); }
    if (account.kind !== 'bkash') { await client.query('ROLLBACK'); return NextResponse.json({ error: 'Only the bKash account is reconciled against the relay' }, { status: 400 }); }
    const startsRelay = !account.relay_from;
    if (startsRelay && accounts.some((a) => a.id !== accountId && a.relay_from)) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Another account is already counting relay payments' }, { status: 409 });
    }
    const relayFrom = account.relay_from || today;
    const ledger = computeAccountBalance({ ...account, relay_from: relayFrom }, data, today);
    const difference = round2(actual - ledger);
    const result = { ledger, actual: round2(actual), difference, reconciled: difference === 0, startsRelay, relayFrom };
    if (!body.confirm) { await client.query('ROLLBACK'); return NextResponse.json(result); }

    if (round2(Number(body.difference)) !== difference) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'The balance changed since you checked (a payment may have just arrived) — check again.' }, { status: 409 });
    }
    const note = String(body.note || '').trim();
    if (difference !== 0 && !note) { await client.query('ROLLBACK'); return NextResponse.json({ error: 'A reason is required to correct the difference' }, { status: 400 }); }
    if (startsRelay) await client.query(`UPDATE payment_accounts SET relay_from = $2 WHERE id = $1`, [accountId, relayFrom]);
    if (difference !== 0) {
      await client.query(`INSERT INTO account_adjustments (account_id, adj_date, amount, note) VALUES ($1, $2, $3, $4)`, [accountId, today, difference, `Reconcile: ${note}`]);
    }
    await client.query('COMMIT');
    return NextResponse.json({ ...result, ok: true, adjusted: difference !== 0 });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
