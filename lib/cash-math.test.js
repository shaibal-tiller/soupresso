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
  assert.equal(s.totalSales, 4500);      // 5000 - 500 + 0
  assert.equal(s.cashTakenHome, 3500);   // 5000 - 1000 - 500
});

test('computeCashSummary: chef needed extra (positive variance) is added back into sales, not double-subtracted from cash taken home', () => {
  const s = computeCashSummary({
    totalCounted: 4800, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 1200,
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(s.bazarVariance, 200);
  assert.equal(s.totalSales, 4500);      // 4800 - 500 + 200 -- same true sales as the zero-variance case
  assert.equal(s.cashTakenHome, 3300);   // 4800 - 1000 - 500 (NOT 4800 - 200 - 1000 - 500 = 3100)
});

test('computeCashSummary: chef returned money (negative variance) is subtracted from sales', () => {
  const s = computeCashSummary({
    totalCounted: 5100, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 800,
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(s.bazarVariance, -200);
  assert.equal(s.totalSales, 4400);      // 5100 - 500 - 200
  assert.equal(s.cashTakenHome, 3600);   // 5100 - 1000 - 500
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

test('computeCashSummary: no longer returns bazarVarianceLabel', () => {
  const s = computeCashSummary({ totalCounted: 100 });
  assert.equal('bazarVarianceLabel' in s, false);
});

test('denominationTotal: sums note*qty', () => {
  assert.equal(denominationTotal({ 1000: 2, 500: 1, 50: 3 }), 2650);
});

test('denominationTotal: empty/partial/null-safe', () => {
  assert.equal(denominationTotal({}), 0);
  assert.equal(denominationTotal(null), 0);
  assert.equal(denominationTotal({ 100: 0, 50: 2 }), 100);
});
