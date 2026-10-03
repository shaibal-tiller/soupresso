import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePeriod, stepPeriod, canStepForward, canStepBack, bucketKey, rollupLedger, initialPeriod } from './periods.js';

const TODAY = '2026-10-03'; // a Saturday

test('presets resolve against today', () => {
  assert.deepEqual(resolvePeriod({ mode: 'preset', preset: '7d' }, TODAY), { from: '2026-09-27', to: TODAY });
  assert.deepEqual(resolvePeriod({ mode: 'preset', preset: 'month' }, TODAY), { from: '2026-10-01', to: TODAY });
  assert.deepEqual(resolvePeriod({ mode: 'preset', preset: 'all' }, TODAY), { from: '2026-08-01', to: TODAY });
});

test('week and month modes resolve around the anchor', () => {
  const w = resolvePeriod({ mode: 'week', anchor: '2026-09-23' }, TODAY); // Wed -> Sun..Sat
  assert.deepEqual(w, { from: '2026-09-20', to: '2026-09-26' });
  assert.deepEqual(resolvePeriod({ mode: 'month', anchor: '2026-09-15' }, TODAY), { from: '2026-09-01', to: '2026-09-30' });
});

test('custom range never ends before it starts', () => {
  assert.deepEqual(resolvePeriod({ mode: 'custom', from: '2026-09-10', to: '2026-09-01' }, TODAY), { from: '2026-09-10', to: '2026-09-10' });
});

test('stepping moves by a week / month and stops at the current one', () => {
  let s = { mode: 'week', anchor: TODAY };
  s = stepPeriod(s, -1, TODAY);
  assert.equal(s.anchor, '2026-09-26');
  assert.equal(canStepForward(s, TODAY), true);
  assert.equal(stepPeriod({ mode: 'week', anchor: TODAY }, 1, TODAY).anchor, TODAY); // can't go past this week
  const m = stepPeriod({ mode: 'month', anchor: '2026-10-15' }, -1, TODAY);
  assert.equal(m.anchor, '2026-09-15');
  assert.equal(stepPeriod({ mode: 'month', anchor: '2026-10-15' }, 1, TODAY).anchor, '2026-10-15');
  assert.equal(stepPeriod({ mode: 'month', anchor: '2027-01-15' }, -1, '2027-02-10').anchor, '2026-12-15'); // year rollover
});

test('bucketKey groups by Sunday-start week and by month', () => {
  assert.equal(bucketKey('2026-09-23T00:00:00.000Z', 'week'), '2026-09-20');
  assert.equal(bucketKey('2026-09-30', 'month'), '2026-09');
  assert.equal(bucketKey('2026-09-30', 'day'), '2026-09-30');
});

test('rollupLedger takes first opening, last closing, and sums the deltas', () => {
  const rows = [
    { entry_date: '2026-09-28', opening_balance: 100, day_delta: 50, adjustment_delta: 0, closing_balance: 150, status: 'confirmed' },
    { entry_date: '2026-09-29', opening_balance: 150, day_delta: 30, adjustment_delta: -10, closing_balance: 170, status: 'confirmed' },
    { entry_date: '2026-10-01', opening_balance: 170, day_delta: 20, adjustment_delta: 0, closing_balance: 190, status: 'pending' },
  ];
  const weeks = rollupLedger(rows, 'week');
  assert.equal(weeks.length, 1); // all three days fall in the Sun Sep 27 - Sat Oct 3 week
  assert.equal(weeks[0].opening, 100);
  assert.equal(weeks[0].closing, 190);
  assert.equal(weeks[0].dayDelta, 100);
  const months = rollupLedger(rows, 'month');
  assert.equal(months.length, 2);
  assert.deepEqual(months[0], { key: '2026-09', from: '2026-09-28', to: '2026-09-29', days: 2, opening: 100, closing: 170, dayDelta: 80, adjustment: -10, pending: false });
  assert.equal(months[1].pending, true);
});

test('initialPeriod defaults to the 30 day preset', () => {
  assert.equal(initialPeriod(TODAY).preset, '30d');
});

test('stepping back stops at the first month / week with data (Aug 2026)', () => {
  assert.equal(canStepBack({ mode: 'month', anchor: '2026-09-15' }, TODAY), true);
  assert.equal(canStepBack({ mode: 'month', anchor: '2026-08-15' }, TODAY), false);
  assert.equal(stepPeriod({ mode: 'month', anchor: '2026-08-15' }, -1, TODAY).anchor, '2026-08-15');
  // Sun Jul 26 - Sat Aug 1 still touches August; the week before it does not
  assert.equal(canStepBack({ mode: 'week', anchor: '2026-08-05' }, TODAY), true);
  assert.equal(canStepBack({ mode: 'week', anchor: '2026-07-29' }, TODAY), false);
});
