import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeClosingBalance, isConfirmEligible, applyAdjustmentCascade } from './cash-in-hand.js';

test('computeClosingBalance: simple sum', () => {
  assert.equal(computeClosingBalance({ openingBalance: 1000, dayDelta: 500 }), 1500);
});

test('computeClosingBalance: negative day delta (expense exceeded sales)', () => {
  assert.equal(computeClosingBalance({ openingBalance: 1000, dayDelta: -300 }), 700);
});

test('computeClosingBalance: includes adjustment_delta', () => {
  assert.equal(computeClosingBalance({ openingBalance: 1000, dayDelta: 500, adjustmentDelta: -120 }), 1380);
});

test('isConfirmEligible: next day entry exists -> confirmed regardless of time', () => {
  assert.equal(isConfirmEligible({ pendingSince: new Date(), hasNextDayEntry: true }), true);
});

test('isConfirmEligible: less than 24h, no next day entry -> still pending', () => {
  const now = new Date('2026-09-25T12:00:00Z');
  const pendingSince = new Date('2026-09-25T00:00:00Z'); // 12h ago
  assert.equal(isConfirmEligible({ pendingSince, now, hasNextDayEntry: false }), false);
});

test('isConfirmEligible: exactly 24h passed -> confirmed', () => {
  const pendingSince = new Date('2026-09-24T12:00:00Z');
  const now = new Date('2026-09-25T12:00:00Z');
  assert.equal(isConfirmEligible({ pendingSince, now, hasNextDayEntry: false }), true);
});

test('applyAdjustmentCascade: adjustment on the last day only affects that day', () => {
  const rows = [
    { entry_date: '2026-09-01', opening_balance: 0, day_delta: 1000, adjustment_delta: 0, closing_balance: 1000 },
    { entry_date: '2026-09-02', opening_balance: 1000, day_delta: 500, adjustment_delta: 0, closing_balance: 1500 },
  ];
  const next = applyAdjustmentCascade(rows, 1, 200);
  assert.equal(next[0].closing_balance, 1000); // untouched
  assert.equal(next[1].adjustment_delta, 200);
  assert.equal(next[1].closing_balance, 1700);
});

test('applyAdjustmentCascade: adjustment on an earlier day cascades forward through later days', () => {
  const rows = [
    { entry_date: '2026-09-01', opening_balance: 0, day_delta: 1000, adjustment_delta: 0, closing_balance: 1000 },
    { entry_date: '2026-09-02', opening_balance: 1000, day_delta: 500, adjustment_delta: 0, closing_balance: 1500 },
    { entry_date: '2026-09-03', opening_balance: 1500, day_delta: -200, adjustment_delta: 0, closing_balance: 1300 },
  ];
  const next = applyAdjustmentCascade(rows, 0, -100); // correcting day 1 down by 100
  assert.equal(next[0].closing_balance, 900);
  assert.equal(next[1].opening_balance, 900);
  assert.equal(next[1].closing_balance, 1400);
  assert.equal(next[2].opening_balance, 1400);
  assert.equal(next[2].closing_balance, 1200);
});

test('applyAdjustmentCascade: does not mutate the input array', () => {
  const rows = [{ entry_date: '2026-09-01', opening_balance: 0, day_delta: 1000, adjustment_delta: 0, closing_balance: 1000 }];
  const frozen = JSON.parse(JSON.stringify(rows));
  applyAdjustmentCascade(rows, 0, 50);
  assert.deepEqual(rows, frozen);
});
