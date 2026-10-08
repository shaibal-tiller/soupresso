import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';
import { todayStrTZ } from '@/lib/dates';
import { ACCOUNT_KINDS, ACCOUNTS_START_DATE, summarizeAccount, activityFlags } from '@/lib/accounts';
import { loadAll } from '@/lib/accounts-db';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// GET /api/payment-accounts?date=YYYY-MM-DD  (default: today)
// Every account with its balance at the end of `date`, the balance at the start of that day, and what moved on that
// day — plus the latest movements (sales into accounts, transfers, corrections). Returns an empty list (not an error)
// when the tables don't exist yet, so the app keeps working before the migration is applied.
export async function GET(request) {
  const date = new URL(request.url).searchParams.get('date');
  const day = DATE_RE.test(date || '') ? date : todayStrTZ();
  const client = await getPool().connect();
  try {
    const { accounts, data } = await loadAll(client);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const name = (id) => (id == null ? 'Cash' : byId.get(id)?.name || '?');

    const list = accounts.map((a) => {
      const s = summarizeAccount(a, data, day);
      const relayDay = a.kind === 'bkash' ? data.relay.filter((r) => r.date === day) : [];
      return {
        ...a, balance: s.closing, opening: s.opening, todaySales: s.sales, todayTransfersNet: s.transfersNet, todayAdjustments: s.adjustments,
        relayFrom: a.relay_from, relayDayCount: relayDay.length, relayDayTotal: Math.round(relayDay.reduce((n, r) => n + r.amount, 0) * 100) / 100,
      };
    });

    // What transfers did to cash in hand on `day` (cash is not an account row, so it is reported separately).
    let cashTransfersNetToday = 0;
    for (const t of data.transfers) {
      if (t.transfer_date !== day) continue;
      if (t.from_account_id == null) cashTransfersNetToday -= t.amount;
      if (t.to_account_id == null) cashTransfersNetToday += t.amount - t.charge;
    }
    cashTransfersNetToday = Math.round(cashTransfersNetToday * 100) / 100;

    // bKash relay payments belong to the (first active) bKash account; they count only from that account's relay_from.
    const relayAccount = accounts.find((a) => a.kind === 'bkash' && a.active) || accounts.find((a) => a.kind === 'bkash');
    // Per date: show a day's detailed relay/history rows instead of its typed lump when they add up to it.
    const sumBy = (rows, key) => rows.reduce((o, r) => { o[r[key]] = (o[r[key]] || 0) + r.amount; return o; }, {});
    const flags = relayAccount
      ? activityFlags({
          salesByDate: sumBy(data.sales.filter((x) => x.account_id === relayAccount.id), 'entry_date'),
          relayByDate: sumBy(data.relay, 'date'),
          relayFrom: relayAccount.relay_from,
        })
      : {};
    const movements = [
      ...data.sales.filter((s) => !(s.account_id === relayAccount?.id && flags[s.entry_date]?.hideSale)).map((s) => ({ type: 'sale', date: s.entry_date, sortKey: `${s.entry_date}|0`, accountId: s.account_id, account: name(s.account_id), amount: s.amount })),
      ...data.transfers.map((t) => ({ type: 'transfer', id: t.id, date: t.transfer_date, sortKey: `${t.transfer_date}|1|${String(t.id).padStart(8, '0')}`, fromId: t.from_account_id, toId: t.to_account_id, from: name(t.from_account_id), to: name(t.to_account_id), amount: t.amount, charge: t.charge, note: t.note })),
      ...(relayAccount ? data.relay.map((r) => ({
        type: 'relay', id: r.id, date: r.date, sortKey: `${r.date}|3|${new Date(r.occurred_at).toISOString()}`, accountId: relayAccount.id, account: relayAccount.name,
        amount: r.amount, sender: r.sender, operator: r.sender_operator, time: r.time_known ? r.time : null,
        source: r.source, trxId: r.trx_id, balanceAfter: r.balance_after,
        state: flags[r.date]?.relayState || 'not-counted',
      })) : []),
      ...data.adjustments.map((a) => ({ type: 'adjustment', id: a.id, date: a.adj_date, sortKey: `${a.adj_date}|2|${String(a.id).padStart(8, '0')}`, accountId: a.account_id, account: name(a.account_id), amount: a.amount, note: a.note })),
    ].sort((x, y) => y.sortKey.localeCompare(x.sortKey)).slice(0, 300);

    return NextResponse.json({ date: day, enabledFrom: ACCOUNTS_START_DATE, accounts: list, cashTransfersNetToday, movements });
  } catch (err) {
    if (err.code === '42P01') return NextResponse.json({ date: day, enabledFrom: ACCOUNTS_START_DATE, accounts: [], movements: [], notReady: true });
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST { name, kind, startingBalance, startingDate } -> new account (starts active)
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const name = String(body?.name || '').trim();
  const kind = ACCOUNT_KINDS.includes(body?.kind) ? body.kind : 'other';
  const startingBalance = coerceLocaleNumber(body?.startingBalance) ?? 0;
  const startingDate = DATE_RE.test(body?.startingDate || '') ? body.startingDate : (todayStrTZ() < ACCOUNTS_START_DATE ? ACCOUNTS_START_DATE : todayStrTZ());
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!Number.isFinite(startingBalance)) return NextResponse.json({ error: 'starting balance must be a number' }, { status: 400 });
  try {
    const { rows } = await getPool().query(
      `INSERT INTO payment_accounts (name, kind, starting_balance, starting_date, sort_order)
       VALUES ($1, $2, $3, $4, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM payment_accounts)) RETURNING id`,
      [name, kind, startingBalance, startingDate]
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (err) {
    if (err.code === '23505') return NextResponse.json({ error: 'An account with that name already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH { id, active?, name? } -> activate / deactivate / rename. History and balance are kept either way.
export async function PATCH(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const id = Number(body?.id);
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  const sets = []; const params = [];
  if (body.active !== undefined) { params.push(!!body.active); sets.push(`active = $${params.length}`); }
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    params.push(name); sets.push(`name = $${params.length}`);
  }
  if (!sets.length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  params.push(id);
  try {
    const { rowCount } = await getPool().query(`UPDATE payment_accounts SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    if (!rowCount) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return NextResponse.json({ error: 'An account with that name already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
