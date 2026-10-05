import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountsEnabledFor, transferEffect, validateTransfer, computeAccountBalance, summarizeAccount, ACCOUNTS_START_DATE } from './accounts.js';

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
