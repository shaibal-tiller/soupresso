import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expenseTypeFor, EXPENSE_TYPES } from './expense-types.js';

test('category defaults', () => {
  assert.deepEqual(expenseTypeFor('Meat & Egg', 'Egg'), ['cost_of_goods', 'Ingredients – Meat & Egg']);
  assert.equal(expenseTypeFor('Staff & Home', 'Food Bill')[0], 'overhead');
  assert.equal(expenseTypeFor('Staff & Home', 'Nasta Bill')[0], 'overhead');
  assert.equal(expenseTypeFor('Cleaning Supplies', 'Wheel Powder')[0], 'operational');
});

test('item overrides beat the category default', () => {
  assert.equal(expenseTypeFor('Staff & Home', 'Auto Fare')[0], 'operational'); // travel is operational
  assert.equal(expenseTypeFor('Shop', 'Shop Rent')[0], 'overhead');
  assert.equal(expenseTypeFor('Shop', 'Repair & Maintenance Work')[0], 'operational');
  assert.equal(expenseTypeFor('Cooking Essentials', 'Gas Cylinder Refill - Shop/Cart')[0], 'cost_of_goods');
  assert.equal(expenseTypeFor('Serving, Seating & Packaging', 'Soup Parcel Bowl')[0], 'cost_of_goods');
  assert.equal(expenseTypeFor('Serving, Seating & Packaging', 'Foil Paper')[0], 'operational');
});

test('unknown category and item gives null; types are the three', () => {
  assert.equal(expenseTypeFor('Nope', 'Nothing'), null);
  assert.deepEqual(EXPENSE_TYPES, ['cost_of_goods', 'operational', 'overhead']);
});
