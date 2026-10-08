// Payment accounts (bKash, bank, …) next to Cash in Hand. Pure math + rules; API routes own the I/O.
// Cash in Hand itself stays the daily ledger (lib/cash-in-hand*.js); an account's balance is:
//   starting balance + sales received into it + transfers in (amount − charge) − transfers out (amount) ± corrections
// counting only things dated on/after the account's starting date.
// Relay (bKash notifications): once an account has relay_from (YYYY-MM-DD, Dhaka date), payments the relay received
// from that date on count as its sales and the sales typed in the daily entry from that date on are ignored for it.
// Before relay_from the relay payments are only recorded, never counted.
import { shiftDateStr } from './dates.js';

// Daily-entry sales can be split into accounts from this date on (nothing earlier).
export const ACCOUNTS_START_DATE = '2026-10-06';
export const ACCOUNT_KINDS = ['bkash', 'bank', 'other'];

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function accountsEnabledFor(date) {
  return typeof date === 'string' && date >= ACCOUNTS_START_DATE;
}

// A transfer takes `amount` out of the source; `charge` is lost on the way, so the destination
// receives amount − charge.
export function transferEffect({ amount, charge = 0 }) {
  const out = round2(amount);
  const fee = round2(charge);
  return { out, charge: fee, in: round2(out - fee) };
}

// fromId / toId: payment_accounts.id, or null for cash in hand. Returns an error message or null.
export function validateTransfer({ fromId, toId, amount, charge = 0, date, accounts }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'date (YYYY-MM-DD) is required';
  if (!(Number(amount) > 0)) return 'amount must be more than 0';
  if (!(Number(charge) >= 0)) return 'charge cannot be negative';
  if (Number(charge) > Number(amount)) return 'charge cannot be more than the amount';
  if ((fromId ?? null) === (toId ?? null)) return 'pick two different accounts';
  for (const [label, id] of [['from', fromId], ['to', toId]]) {
    if (id == null) continue;
    const a = accounts.find((x) => x.id === id);
    if (!a) return `${label} account not found`;
    if (!a.active) return `${a.name} is deactivated`;
    if (date < a.starting_date) return `${a.name} starts on ${a.starting_date} — pick a later date`;
  }
  return null;
}

// data = { sales: [{account_id, entry_date, amount}], relay: [{date, amount}] (optional), transfers: [{from_account_id, to_account_id, transfer_date, amount, charge}],
//          adjustments: [{account_id, adj_date, amount}] } — all dates as YYYY-MM-DD strings.
export function computeAccountBalance(account, data, asOf) {
  const from = account.starting_date;
  const inRange = (d) => d >= from && d <= asOf;
  let bal = Number(account.starting_balance);
  const relayOn = (d) => !!account.relay_from && d >= account.relay_from;
  for (const s of data.sales) if (s.account_id === account.id && inRange(s.entry_date) && !relayOn(s.entry_date)) bal += Number(s.amount);
  for (const r of data.relay || []) if (relayOn(r.date) && inRange(r.date)) bal += Number(r.amount);
  for (const t of data.transfers) {
    if (!inRange(t.transfer_date)) continue;
    if (t.to_account_id === account.id) bal += Number(t.amount) - Number(t.charge);
    if (t.from_account_id === account.id) bal -= Number(t.amount);
  }
  for (const a of data.adjustments) if (a.account_id === account.id && inRange(a.adj_date)) bal += Number(a.amount);
  return round2(bal);
}

// Balance at the end of the previous day, at the end of `date`, and what changed on `date`.
export function summarizeAccount(account, data, date) {
  const opening = date <= account.starting_date && date === account.starting_date
    ? round2(account.starting_balance) // on the starting day the opening is the starting balance itself
    : computeAccountBalance(account, data, shiftDateStr(date, -1));
  const closing = computeAccountBalance(account, data, date);
  const received = account.relay_from && date >= account.relay_from
    ? (data.relay || []).filter((r) => r.date === date)
    : data.sales.filter((s) => s.account_id === account.id && s.entry_date === date);
  const sales = round2(received.reduce((n, s) => n + Number(s.amount), 0));
  let transfersNet = 0;
  for (const t of data.transfers) {
    if (t.transfer_date !== date) continue;
    if (t.to_account_id === account.id) transfersNet += Number(t.amount) - Number(t.charge);
    if (t.from_account_id === account.id) transfersNet -= Number(t.amount);
  }
  const adjustments = round2(data.adjustments.filter((a) => a.account_id === account.id && a.adj_date === date).reduce((n, a) => n + Number(a.amount), 0));
  return { opening, closing, sales, transfersNet: round2(transfersNet), adjustments };
}
