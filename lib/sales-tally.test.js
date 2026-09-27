import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOD_THRESHOLD, WARNING_THRESHOLD,
  quantitySoldForItem, varianceStatus, computeReconciliation,
} from './sales-tally.js';

test('quantitySoldForItem: production mode sums all batch entries', () => {
  const item = { trackingMode: 'production', entries: [{ quantity: 20 }, { quantity: 10 }, { quantity: 5 }] };
  assert.equal(quantitySoldForItem(item), 35);
});

test('quantitySoldForItem: production mode with no entries is 0', () => {
  assert.equal(quantitySoldForItem({ trackingMode: 'production', entries: [] }), 0);
  assert.equal(quantitySoldForItem({ trackingMode: 'production' }), 0);
});

test('quantitySoldForItem: bowl_single mode is just singleCount, doubleCount ignored', () => {
  const item = { trackingMode: 'bowl_single', singleCount: 12, doubleCount: 99 };
  assert.equal(quantitySoldForItem(item), 12);
});

test('quantitySoldForItem: bowl_double mode is single + 2*double', () => {
  const item = { trackingMode: 'bowl_double', singleCount: 4, doubleCount: 3 };
  assert.equal(quantitySoldForItem(item), 10); // 4 + 2*3
});

test('quantitySoldForItem: bowl modes default missing counts to 0', () => {
  assert.equal(quantitySoldForItem({ trackingMode: 'bowl_single' }), 0);
  assert.equal(quantitySoldForItem({ trackingMode: 'bowl_double', singleCount: 2 }), 2);
});

test('varianceStatus: boundaries are inclusive', () => {
  assert.equal(varianceStatus(50), 'good');
  assert.equal(varianceStatus(-50), 'good');
  assert.equal(varianceStatus(50.01), 'warning');
  assert.equal(varianceStatus(100), 'warning');
  assert.equal(varianceStatus(-100), 'warning');
  assert.equal(varianceStatus(100.01), 'danger');
  assert.equal(varianceStatus(-500), 'danger');
  assert.equal(varianceStatus(0), 'good');
});

test('GOOD_THRESHOLD and WARNING_THRESHOLD are 50 and 100', () => {
  assert.equal(GOOD_THRESHOLD, 50);
  assert.equal(WARNING_THRESHOLD, 100);
});

test('computeReconciliation: sums quantitySold*price across mixed tracking modes', () => {
  const items = [
    { trackingMode: 'production', price: 15, entries: [{ quantity: 20 }, { quantity: 10 }] }, // 30*15=450
    { trackingMode: 'bowl_single', price: 60, singleCount: 12 },                              // 12*60=720
    { trackingMode: 'bowl_double', price: 70, singleCount: 4, doubleCount: 3 },                // 10*70=700
  ];
  const result = computeReconciliation(items, 1900);
  assert.equal(result.computedTotal, 1870); // 450+720+700
  assert.equal(result.actualSales, 1900);
  assert.equal(result.variance, -30); // 1870-1900
  assert.equal(result.status, 'good');
});

test('computeReconciliation: no cash entry yet -> actualSales/variance/status are null', () => {
  const items = [{ trackingMode: 'bowl_single', price: 60, singleCount: 12 }];
  const result = computeReconciliation(items, null);
  assert.equal(result.computedTotal, 720);
  assert.equal(result.actualSales, null);
  assert.equal(result.variance, null);
  assert.equal(result.status, null);
});

test('computeReconciliation: empty items list computes to 0, still compares against actualSales', () => {
  const result = computeReconciliation([], 200);
  assert.equal(result.computedTotal, 0);
  assert.equal(result.variance, -200);
  assert.equal(result.status, 'danger');
});
