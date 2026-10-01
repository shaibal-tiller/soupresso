import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertToStorageUnit, suspectedPieceCount } from './units.js';

test('dozen of eggs is stored as pieces, total unchanged', () => {
  const r = convertToStorageUnit({ unit: 'dozen', quantity: 1, total: 150 }, 'pc');
  assert.deepEqual(r, { unit: 'pc', quantity: 12, unitPrice: 12.5, converted: true });
});

test('hali (4 pc) converts: 3 hali lemons = 12 pc', () => {
  const r = convertToStorageUnit({ unit: 'hali', quantity: 3, total: 70 }, 'pc');
  assert.equal(r.quantity, 12);
  assert.equal(r.unit, 'pc');
});

test('grams of mushroom are stored as kg', () => {
  const r = convertToStorageUnit({ unit: 'gm', quantity: 425, total: 160 }, 'kg');
  assert.equal(r.quantity, 0.425);
  assert.equal(r.unit, 'kg');
  assert.ok(Math.abs(r.quantity * r.unitPrice - 160) < 0.01);
});

test('500g of green chili is stored as 2 x 250g', () => {
  const r = convertToStorageUnit({ unit: '500g', quantity: 1, total: 100 }, '250g');
  assert.deepEqual(r, { unit: '250g', quantity: 2, unitPrice: 50, converted: true });
});

test('same unit, other family, or non-storage catalog unit is left alone', () => {
  assert.equal(convertToStorageUnit({ unit: 'pc', quantity: 16, total: 215 }, 'pc').converted, false);
  assert.equal(convertToStorageUnit({ unit: 'kg', quantity: 1, total: 70 }, 'pc').converted, false);
  assert.equal(convertToStorageUnit({ unit: 'kg', quantity: 1, total: 140 }, '100g').converted, false); // spices keep their pack unit
  assert.equal(convertToStorageUnit({ unit: 'kg', quantity: 1, total: 70 }, '500g').converted, false);
  assert.equal(convertToStorageUnit({ unit: 'dozen', quantity: 1, total: 150 }, undefined).converted, false);
  assert.equal(convertToStorageUnit({ unit: 'dozen', quantity: 0, total: 0 }, 'pc').converted, false);
});

test('suspectedPieceCount flags 16 dozen / 12 hali but not 1 dozen / 3 hali', () => {
  assert.equal(suspectedPieceCount('dozen', 16), 16);
  assert.equal(suspectedPieceCount('hali', 12), 12);
  assert.equal(suspectedPieceCount('dozen', 1), null);
  assert.equal(suspectedPieceCount('hali', 3), null);
  assert.equal(suspectedPieceCount('pc', 16), null);
});
