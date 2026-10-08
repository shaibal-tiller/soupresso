import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityFlags, accountsEnabledFor, transferEffect, validateTransfer, computeAccountBalance, summarizeAccount, ACCOUNTS_START_DATE } from './accounts.js';

const bkash = { id: 1, name: 'bKash', active: true, starting_balance: 1000, starting_date: '2026-10-06' };
const bank = { id: 2, name: 'City Bank', active: true, starting_balance: 0, starting_date: '2026-10-06' };
const data = {
  sales: [
    { account_id: 1, entry_date: '2026-10-06', amount: 500 },
    { account_id: 1, entry_date: '2026-10-07', amount: 300 },
    { account_id: 1, entry_date: '2026-10-01', amount: 999 }, // before the account existed: ignored
  ],
  transfers: [
    { from_account_id: 1, to_account_id: null, transfer_date: '2026-10-07', amount: 600, charge: 10 }, // bKash -> cash
    { from_account_id: 1, to_account_id: 2, transfer_date: '2026-10-08', amount: 400, charge: 4 },     // bKash -> bank
  ],
  adjustments: [{ account_id: 1, adj_date: '2026-10-08', amount: -5 }],
};

test('the feature starts on Oct 6', () => {
  assert.equal(ACCOUNTS_START_DATE, '2026-10-06');
  assert.equal(accountsEnabledFor('2026-10-05'), false);
  assert.equal(accountsEnabledFor('2026-10-06'), true);
  assert.equal(accountsEnabledFor('2026-11-01'), true);
});

test('a transfer sends the full amount and the destination gets amount − charge', () => {
  assert.deepEqual(transferEffect({ amount: 10000, charge: 100 }), { out: 10000, charge: 100, in: 9900 });
  assert.deepEqual(transferEffect({ amount: 500 }), { out: 500, charge: 0, in: 500 });
});

test('balance = starting + sales + transfers in − transfers out ± adjustments, from the starting date only', () => {
  assert.equal(computeAccountBalance(bkash, data, '2026-10-06'), 1500);            // 1000 + 500
  assert.equal(computeAccountBalance(bkash, data, '2026-10-07'), 1200);            // +300 sales −600 out
  assert.equal(computeAccountBalance(bkash, data, '2026-10-08'), 795);             // −400 out −5 adj
  assert.equal(computeAccountBalance(bank, data, '2026-10-08'), 396);              // received 400 − 4 charge
  assert.equal(computeAccountBalance(bank, data, '2026-10-07'), 0);
});

test('summarizeAccount splits a day into opening, additions and closing', () => {
  const d7 = summarizeAccount(bkash, data, '2026-10-07');
  assert.deepEqual(d7, { opening: 1500, closing: 1200, sales: 300, transfersNet: -600, adjustments: 0 });
  const d6 = summarizeAccount(bkash, data, '2026-10-06');
  assert.equal(d6.opening, 1000); // starting day: the starting balance is the opening
  assert.equal(d6.closing, 1500);
});

test('validateTransfer catches the mistakes that would corrupt balances', () => {
  const base = { fromId: 1, toId: null, amount: 100, charge: 0, date: '2026-10-07', accounts: [bkash, bank] };
  assert.equal(validateTransfer(base), null);
  assert.match(validateTransfer({ ...base, amount: 0 }), /more than 0/);
  assert.match(validateTransfer({ ...base, charge: 200 }), /charge cannot be more/);
  assert.match(validateTransfer({ ...base, toId: 1 }), /two different/);
  assert.match(validateTransfer({ ...base, fromId: null, toId: null }), /two different/);
  assert.match(validateTransfer({ ...base, fromId: 9 }), /not found/);
  assert.match(validateTransfer({ ...base, accounts: [{ ...bkash, active: false }, bank] }), /deactivated/);
  assert.match(validateTransfer({ ...base, date: '2026-10-05' }), /starts on/);
});

// ── relay payments (bKash notifications) ──
// data.relay = [{ date, amount }] — payments received, by Dhaka date. They only count once an account has relay_from;
// from that date the relay replaces the sales typed in the daily entry for that account.
const relayData = {
  sales: [
    { account_id: 1, entry_date: '2026-10-06', amount: 500 },
    { account_id: 1, entry_date: '2026-10-09', amount: 700 }, // typed on/after relay_from: replaced by the relay
  ],
  transfers: [],
  adjustments: [],
  relay: [
    { date: '2026-10-08', amount: 40 },  // before relay_from: recorded but not counted
    { date: '2026-10-09', amount: 600 },
    { date: '2026-10-10', amount: 250 },
  ],
};

test('relay payments are not counted while the account has no relay_from', () => {
  assert.equal(computeAccountBalance(bkash, relayData, '2026-10-10'), 1000 + 500 + 700);
});

test('with relay_from: earlier typed sales count, later typed sales are replaced by relay payments', () => {
  const acc = { ...bkash, relay_from: '2026-10-09' };
  assert.equal(computeAccountBalance(acc, relayData, '2026-10-08'), 1000 + 500);
  assert.equal(computeAccountBalance(acc, relayData, '2026-10-09'), 1000 + 500 + 600);
  assert.equal(computeAccountBalance(acc, relayData, '2026-10-10'), 1000 + 500 + 600 + 250);
});

test('summarizeAccount reports the relay total as the day’s sales once relay is on', () => {
  const acc = { ...bkash, relay_from: '2026-10-09' };
  assert.equal(summarizeAccount(acc, relayData, '2026-10-09').sales, 600);
  assert.equal(summarizeAccount(acc, relayData, '2026-10-06').sales, 500);
  assert.equal(summarizeAccount(bkash, relayData, '2026-10-09').sales, 700);
});

// ── activity: a day's typed lump vs the detailed relay/history rows ──
test('activityFlags: detail rows replace a typed lump when they add up to it', () => {
  const f = activityFlags({ salesByDate: { '2026-10-07': 330 }, relayByDate: { '2026-10-07': 330 }, relayFrom: null });
  assert.deepEqual(f['2026-10-07'], { hideSale: true, relayState: 'in-entry' });
});

test('activityFlags: a lump that does not match its details stays visible; details are shown as not counted', () => {
  const f = activityFlags({ salesByDate: { '2026-10-07': 330 }, relayByDate: { '2026-10-07': 250 }, relayFrom: null });
  assert.deepEqual(f['2026-10-07'], { hideSale: false, relayState: 'not-counted' });
});

test('activityFlags: from relay_from on, typed lumps are hidden (they no longer count) and relay rows are counted', () => {
  const f = activityFlags({ salesByDate: { '2026-10-09': 700 }, relayByDate: { '2026-10-09': 600 }, relayFrom: '2026-10-09' });
  assert.deepEqual(f['2026-10-09'], { hideSale: true, relayState: 'counted' });
});

test('activityFlags: days with only one side are covered too', () => {
  const f = activityFlags({ salesByDate: { '2026-10-06': 180 }, relayByDate: { '2026-10-08': 2 }, relayFrom: null });
  assert.deepEqual(f['2026-10-06'], { hideSale: false, relayState: 'not-counted' });
  assert.deepEqual(f['2026-10-08'], { hideSale: false, relayState: 'not-counted' });
});
