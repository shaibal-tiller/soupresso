import { test } from 'node:test';
import assert from 'node:assert/strict';
import { windowStart, cumulativeSeries, cumulativeBreakdown, firstRecordedDate } from './expense-cumulative.js';

const daily = [
  { date: '2026-09-29', bazarActualCost: 700, totalSales: 3000, isOffDay: false },
  { date: '2026-09-30', bazarActualCost: 300, totalSales: 2000, isOffDay: false },
  { date: '2026-10-01', bazarActualCost: 1000, totalSales: 4000, isOffDay: false },
  { date: '2026-10-03', bazarActualCost: 500, totalSales: 2500, isOffDay: false }, // Oct 2 has no entry
];
const L = (date, name, lineTotal, expenseType, unit = 'kg', quantity = 1) => ({ date, name, unit, quantity, lineTotal, expenseType });
const lines = [
  L('2026-09-29', 'Chicken', 600, 'cost_of_goods', 'kg', 2),
  L('2026-09-30', 'Chicken', 300, 'cost_of_goods', 'kg', 1),
  L('2026-10-01', 'Chicken', 400, 'cost_of_goods', 'kg', 1),
  L('2026-10-01', 'Salary', 500, 'overhead', null, null),
  L('2026-10-03', 'Auto Fare', 50, 'operational', 'trip', 1),
];

test('window start: start of the month, but never before the first recorded day; all-time = first day', () => {
  assert.equal(windowStart('month', '2026-10-03', '2026-08-11'), '2026-10-01');
  assert.equal(windowStart('month', '2026-08-20', '2026-08-11'), '2026-08-11');
  assert.equal(windowStart('all', '2026-10-03', '2026-08-11'), '2026-08-11');
  assert.equal(firstRecordedDate(daily, lines), '2026-09-29');
});

test('monthly series restarts on the 1st; all-time keeps adding; days with no entry stay flat', () => {
  const m = cumulativeSeries(daily, 'month', '2026-10-03', '2026-09-29');
  assert.equal(m.from, '2026-10-01');
  assert.deepEqual(m.days.map((d) => d.date), ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.deepEqual(m.totals, { sales: 6500, expense: 1500, net: 5000, expensePct: 1500 / 6500 });
  assert.equal(m.days[1].cumSales, 4000); // Oct 2: nothing new
  const a = cumulativeSeries(daily, 'all', '2026-10-03', '2026-09-29');
  assert.equal(a.days.length, 5);
  assert.equal(a.totals.sales, 11500);
  assert.equal(a.totals.expense, 2500);
});

test('series up to an earlier day ignores later days', () => {
  const s = cumulativeSeries(daily, 'all', '2026-09-30', '2026-09-29');
  assert.equal(s.totals.sales, 5000);
  assert.equal(s.totals.expense, 1000);
});

test('breakdown sums per item, biggest first, with quantity only for a single unit', () => {
  const b = cumulativeBreakdown(daily, lines, 'all', '2026-10-03', '2026-09-29');
  assert.equal(b.total, 2500);
  assert.deepEqual(b.items.map((i) => [i.name, i.total]), [['Chicken', 1300], ['Salary', 500], [null, 650], ['Auto Fare', 50]].sort((a, c) => c[1] - a[1]));
  const chicken = b.items.find((i) => i.name === 'Chicken');
  assert.equal(chicken.qty, 4);
  assert.equal(chicken.unit, 'kg');
  assert.equal(b.items.find((i) => i.name === 'Salary').unit, null);
  assert.equal(b.items.find((i) => i.unitemized).total, 650); // 2500 recorded - 1850 itemized
});

test('monthly breakdown only counts the month and groups add up', () => {
  const b = cumulativeBreakdown(daily, lines, 'month', '2026-10-03', '2026-09-29');
  assert.equal(b.from, '2026-10-01');
  assert.equal(b.total, 1500);
  // Oct 1-3: 1500 recorded, 950 itemized -> 550 unitemized is the biggest row, then Salary 500, Chicken 400, Auto Fare 50
  assert.deepEqual(b.items.map((i) => i.total), [550, 500, 400, 50]);
  assert.equal(b.items[0].unitemized, true);
  const sum = b.groups.reduce((n, g) => n + g.total, 0);
  assert.equal(Math.round(sum), 1500);
  assert.ok(Math.abs(b.items.reduce((n, i) => n + i.share, 0) - 1) < 1e-9);
});
