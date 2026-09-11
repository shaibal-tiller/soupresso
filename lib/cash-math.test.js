import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCashSummary, denominationTotal } from './cash-math.js';

test('computeCashSummary: zero variance', () => {
  const s = computeCashSummary({
    totalCounted: 5000, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 1000,
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(s.bazarVariance, 0);
  assert.equal(s.takenFromBox, 0);
  assert.equal(s.toReimburse, 0);
  assert.equal(s.totalSales, 4500);      // 5000 - 500 + 0
  assert.equal(s.cashTakenHome, 3500);   // 5000 - 0 - 1000 - 500
});

test('computeCashSummary: shortfall fronted by chef, reimbursed from box (default, bazarTakenFromBox=0) -- matches the app\'s original behavior', () => {
  const s = computeCashSummary({
    totalCounted: 5000, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 1200,
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(s.bazarVariance, 200);
  assert.equal(s.takenFromBox, 0);
  assert.equal(s.toReimburse, 200);
  assert.equal(s.totalSales, 4500);      // 5000 - 500 + 0 -- box was untouched by the purchase, no sales adjustment
  assert.equal(s.cashTakenHome, 3300);   // 5000 - 200 - 1000 - 500 -- reimbursement paid from the just-counted box
});

test('computeCashSummary: shortfall taken directly from the box (bazarTakenFromBox = full variance)', () => {
  const s = computeCashSummary({
    totalCounted: 4800, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 1200,
    bazarTakenFromBox: 200,
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(s.bazarVariance, 200);
  assert.equal(s.takenFromBox, 200);
  assert.equal(s.toReimburse, 0);
  assert.equal(s.totalSales, 4500);      // 4800 - 500 + 200 -- add back what already left the box
  assert.equal(s.cashTakenHome, 3300);   // 4800 - 0 - 1000 - 500 -- already settled, nothing more to pay
});

test('computeCashSummary: shortfall split between taken-from-box and chef-fronted', () => {
  const s = computeCashSummary({
    totalCounted: 4900, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 1200,
    bazarTakenFromBox: 100,
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(s.bazarVariance, 200);
  assert.equal(s.takenFromBox, 100);
  assert.equal(s.toReimburse, 100);
  assert.equal(s.totalSales, 4500);      // 4900 - 500 + 100
  assert.equal(s.cashTakenHome, 3300);   // 4900 - 100 - 1000 - 500
});

test('computeCashSummary: bazarTakenFromBox is clamped to [0, variance] and ignored when variance <= 0', () => {
  const over = computeCashSummary({
    totalCounted: 4800, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 1200,
    bazarTakenFromBox: 9999,
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(over.takenFromBox, 200); // clamped to the variance
  assert.equal(over.toReimburse, 0);

  const negativeVariance = computeCashSummary({
    totalCounted: 5100, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 800,
    bazarTakenFromBox: 500, // irrelevant -- chef returned money, didn't take any
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(negativeVariance.takenFromBox, 0);
  assert.equal(negativeVariance.toReimburse, 0);
});

test('computeCashSummary: chef returned money (negative variance) is subtracted from sales', () => {
  const s = computeCashSummary({
    totalCounted: 5100, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 800,
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(s.bazarVariance, -200);
  assert.equal(s.totalSales, 4400);      // 5100 - 500 - 200
  assert.equal(s.cashTakenHome, 3600);   // 5100 - 0 - 1000 - 500
});

test('computeCashSummary: isShort boundary', () => {
  assert.equal(computeCashSummary({ totalCounted: 100, nextBazarAdvance: 50, nextBhangti: 51 }).isShort, true);
  assert.equal(computeCashSummary({ totalCounted: 100, nextBazarAdvance: 50, nextBhangti: 50 }).isShort, false);
});

test('computeCashSummary: no args defaults to all zero', () => {
  const s = computeCashSummary();
  assert.equal(s.totalSales, 0);
  assert.equal(s.cashTakenHome, 0);
  assert.equal(s.isShort, false);
});

test('denominationTotal: sums note*qty', () => {
  assert.equal(denominationTotal({ 1000: 2, 500: 1, 50: 3 }), 2650);
});

test('denominationTotal: empty/partial/null-safe', () => {
  assert.equal(denominationTotal({}), 0);
  assert.equal(denominationTotal(null), 0);
  assert.equal(denominationTotal({ 100: 0, 50: 2 }), 100);
});
