// Cumulative ("running total") view for the Expense Gallery: sales and expense up to a chosen day, and the
// expense broken down by item, either since the start of that day's month ('month') or since the first
// recorded day ('all'). Pure; fed from the same /api/expenses?range=all data the day cards use.
import { shiftDateStr } from './dates.js';
import { GROUP_ORDER, groupFor } from './expense-groups.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const CUMULATIVE_MODES = ['month', 'all'];

export function firstRecordedDate(daily, lines = []) {
  const dates = [...daily.map((d) => d.date), ...lines.map((l) => l.date)].sort();
  return dates.length ? dates[0] : null;
}

export function windowStart(mode, date, firstDate) {
  if (mode === 'month') {
    const monthStart = `${date.slice(0, 7)}-01`;
    return firstDate && firstDate > monthStart ? firstDate : monthStart; // the first month may start mid-month
  }
  return firstDate || date;
}

// One point per calendar day from the window start to `date` (days with no entry stay flat).
export function cumulativeSeries(daily, mode, date, firstDate) {
  const from = windowStart(mode, date, firstDate);
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const days = [];
  let cumSales = 0; let cumExpense = 0;
  for (let d = from; d <= date; d = shiftDateStr(d, 1)) {
    const meta = byDate.get(d);
    const sales = meta ? Number(meta.totalSales) || 0 : 0;
    const expense = meta ? Number(meta.bazarActualCost) || 0 : 0;
    cumSales = round2(cumSales + sales);
    cumExpense = round2(cumExpense + expense);
    days.push({ date: d, sales, expense, cumSales, cumExpense });
    if (days.length > 800) break; // safety net against a bad date
  }
  const net = round2(cumSales - cumExpense);
  return { from, days, totals: { sales: cumSales, expense: cumExpense, net, expensePct: cumSales > 0 ? cumExpense / cumSales : null } };
}

// Expense by item over the same window, biggest first. An item bought in several units sums its money
// (quantity only when every line used the same unit). Days saved as one lump total add an "unitemized" row.
export function cumulativeBreakdown(daily, lines, mode, date, firstDate) {
  const from = windowStart(mode, date, firstDate);
  const inWin = (d) => d >= from && d <= date;
  const items = new Map();
  let itemized = 0;
  for (const l of lines) {
    if (!inWin(l.date)) continue;
    const cur = items.get(l.name) || { key: l.name, name: l.name, total: 0, qty: 0, units: new Set(), qtyValid: true, group: groupFor(l), lines: 0 };
    cur.total = round2(cur.total + l.lineTotal);
    cur.lines += 1;
    if (l.unit) cur.units.add(l.unit); else cur.qtyValid = false;
    if (l.quantity != null) cur.qty += Number(l.quantity); else cur.qtyValid = false;
    items.set(l.name, cur);
    itemized = round2(itemized + l.lineTotal);
  }
  const recorded = round2(daily.filter((d) => inWin(d.date)).reduce((n, d) => n + (Number(d.bazarActualCost) || 0), 0));
  const unitemized = round2(recorded - itemized);
  const total = recorded > 0 ? recorded : itemized;

  const rows = [...items.values()].map((i) => ({
    key: i.key, name: i.name, total: i.total, group: i.group, lines: i.lines,
    unit: i.units.size === 1 && i.qtyValid ? [...i.units][0] : null,
    qty: i.units.size === 1 && i.qtyValid ? Math.round(i.qty * 1000) / 1000 : null,
  }));
  if (Math.abs(unitemized) > 0.5) rows.push({ key: '__unitemized', name: null, unitemized: true, total: unitemized, group: 'Other', lines: 0, unit: null, qty: null });
  rows.sort((a, b) => b.total - a.total);
  for (const r of rows) r.share = total > 0 ? r.total / total : 0;

  const groups = GROUP_ORDER
    .map((group) => {
      const t = round2(rows.filter((r) => r.group === group).reduce((n, r) => n + r.total, 0));
      return { group, total: t, share: total > 0 ? t / total : 0 };
    })
    .filter((g) => g.total !== 0);
  return { from, total, items: rows, groups };
}
