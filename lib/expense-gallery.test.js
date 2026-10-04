import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDayCard, latestRecordedDate } from './expense-gallery.js';

const daily = [
  { date: '2026-09-10', bazarActualCost: 1000, totalSales: 4000, isOffDay: false },
  { date: '2026-09-11', bazarActualCost: 0, totalSales: 0, isOffDay: true },
  { date: '2026-09-12', bazarActualCost: 500, totalSales: 2500, isOffDay: false },
];
const lines = [
  { date: '2026-09-10', name: 'Egg', unit: 'pc', quantity: 12, lineTotal: 150, expenseType: 'cost_of_goods', category: 'Meat & Egg' },
  { date: '2026-09-10', name: 'Salary', unit: null, quantity: 1, lineTotal: 600, expenseType: 'overhead', category: 'Staff & Home' },
  { date: '2026-09-10', name: 'Auto Fare', unit: 'trip', quantity: 1, lineTotal: 50, expenseType: 'operational', category: 'Staff & Home' },
  { date: '2026-09-12', name: 'Chicken', unit: 'kg', quantity: 1, lineTotal: 300, expenseType: 'cost_of_goods', category: 'Meat & Egg' },
];

test('groups a day by expense type, biggest line first, with totals and shares', () => {
  const c = buildDayCard('2026-09-10', daily, lines);
  assert.equal(c.recorded, 1000);
  assert.equal(c.sales, 4000);
  assert.equal(c.expensePct, 0.25);
  assert.deepEqual(c.groups.map((g) => g.group), ['Cost of Goods', 'Operational', 'Overhead', 'Other']);
  assert.equal(c.groups[2].total, 600);
  assert.equal(c.groups[2].share, 0.6);
  assert.equal(c.itemized, 800);
});

test('expense saved as one total (no item list) shows up as an unitemized row under Other', () => {
  const c = buildDayCard('2026-09-10', daily, lines);
  const other = c.groups.find((g) => g.group === 'Other');
  assert.equal(other.total, 200); // 1000 recorded - 800 itemized
  assert.equal(other.items[0].unitemized, true);
});

test('a day with a recorded total but only some lines gets the gap, a fully itemized day does not', () => {
  const c = buildDayCard('2026-09-12', daily, lines);
  assert.equal(c.gap, 200);
  const noGap = buildDayCard('2026-09-12', daily, [...lines, { date: '2026-09-12', name: 'Onion', unit: 'kg', quantity: 2, lineTotal: 200, expenseType: 'cost_of_goods', category: 'Vegetables' }]);
  assert.equal(noGap.gap, 0);
  assert.equal(noGap.groups.find((g) => g.group === 'Other'), undefined);
});

test('off day and empty day', () => {
  assert.equal(buildDayCard('2026-09-11', daily, lines).isOffDay, true);
  const empty = buildDayCard('2026-09-01', daily, lines);
  assert.equal(empty.hasData, false);
  assert.deepEqual(empty.groups, []);
});

test('latestRecordedDate ignores future dates and falls back to today', () => {
  assert.equal(latestRecordedDate(daily, '2026-10-05'), '2026-09-12');
  assert.equal(latestRecordedDate(daily, '2026-09-11'), '2026-09-11');
  assert.equal(latestRecordedDate([], '2026-10-05'), '2026-10-05');
});
