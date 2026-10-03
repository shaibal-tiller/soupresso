// Shared period filter logic (presets, week/month stepping, custom range) and
// roll-ups, so Cash in Hand, Sales Tally and Dashboard all filter the same way
// the Expenses page does. Pure functions only — see app/PeriodFilter.js for the UI.
import { shiftDateStr, startOfWeekStr, endOfWeekStr, startOfMonthStr, endOfMonthStr } from './dates.js';

export const DATA_START = '2026-08-01'; // earliest date the app has data for (matches the date pickers' minDate)

export const PRESETS = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '14d', label: '14 days', days: 14 },
  { key: '30d', label: '30 days', days: 30 },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' },
];

// state = { mode: 'preset' | 'week' | 'month' | 'custom', preset, anchor, from, to }
export function initialPeriod(today, mode = 'preset', preset = '30d') {
  return { mode, preset, anchor: today, from: shiftDateStr(today, -29), to: today };
}

export function resolvePeriod(state, today) {
  if (state.mode === 'week') return { from: startOfWeekStr(state.anchor), to: endOfWeekStr(state.anchor) };
  if (state.mode === 'month') return { from: startOfMonthStr(state.anchor), to: endOfMonthStr(state.anchor) };
  if (state.mode === 'custom') return { from: state.from, to: state.to < state.from ? state.from : state.to };
  const p = PRESETS.find((x) => x.key === state.preset) || PRESETS[2];
  if (p.key === 'all') return { from: DATA_START, to: today };
  if (p.key === 'month') return { from: startOfMonthStr(today), to: today };
  return { from: shiftDateStr(today, -(p.days - 1)), to: today };
}

// Move a week/month window back (-1) or forward (+1). Forward stops at the
// window that contains today. Other modes are returned unchanged.
export function stepPeriod(state, dir, today) {
  if (state.mode === 'week') {
    const next = shiftDateStr(state.anchor, 7 * dir);
    if (dir > 0 && startOfWeekStr(next) > startOfWeekStr(today)) return state;
    if (dir < 0 && endOfWeekStr(next) < DATA_START) return state; // that week is entirely before any data
    return { ...state, anchor: next };
  }
  if (state.mode === 'month') {
    const [y, m] = state.anchor.slice(0, 7).split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 15);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
    if (dir > 0 && next.slice(0, 7) > today.slice(0, 7)) return state;
    if (dir < 0 && next.slice(0, 7) < DATA_START.slice(0, 7)) return state; // before the first month with data
    return { ...state, anchor: next };
  }
  return state;
}

export function canStepForward(state, today) {
  return stepPeriod(state, 1, today) !== state;
}

export function canStepBack(state, today) {
  return stepPeriod(state, -1, today) !== state;
}

// Which bucket a date falls in when grouping: the Sunday-start week it belongs to, or its month.
export function bucketKey(dateStr, by) {
  const d = String(dateStr).slice(0, 10);
  if (by === 'week') return startOfWeekStr(d);
  if (by === 'month') return d.slice(0, 7);
  return d;
}

// Cash in Hand rows (ascending by date) -> one row per week or month.
// opening = first day's opening, closing = last day's closing, day/adjustment deltas summed.
export function rollupLedger(rows, by) {
  const sorted = [...rows].sort((a, b) => String(a.entry_date).localeCompare(String(b.entry_date)));
  const out = new Map();
  for (const r of sorted) {
    const key = bucketKey(r.entry_date, by);
    const date = String(r.entry_date).slice(0, 10);
    const g = out.get(key) || { key, from: date, to: date, days: 0, opening: Number(r.opening_balance), closing: 0, dayDelta: 0, adjustment: 0, pending: false };
    g.to = date;
    g.days += 1;
    g.closing = Number(r.closing_balance);
    g.dayDelta += Number(r.day_delta);
    g.adjustment += Number(r.adjustment_delta);
    if (r.status === 'pending') g.pending = true;
    out.set(key, g);
  }
  return Array.from(out.values()).map((g) => ({ ...g, dayDelta: Math.round(g.dayDelta * 100) / 100, adjustment: Math.round(g.adjustment * 100) / 100 }));
}
