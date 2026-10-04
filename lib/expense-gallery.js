// Model for one day's card in the Expense Gallery. Pure — see app/expenses/ExpenseGallery.js.
import { GROUP_ORDER, groupFor } from './expense-groups.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// daily: [{ date, bazarActualCost, totalSales, isOffDay }]   lines: [{ date, name, unit, quantity, lineTotal, expenseType, category }]
export function buildDayCard(date, daily, lines) {
  const meta = daily.find((d) => d.date === date) || null;
  const dayLines = lines.filter((l) => l.date === date).sort((a, b) => b.lineTotal - a.lineTotal);
  const itemized = round2(dayLines.reduce((s, l) => s + l.lineTotal, 0));
  const recorded = meta ? round2(meta.bazarActualCost) : itemized;
  const gap = round2(recorded - itemized); // expense saved as a single total, with no item list behind it

  const byGroup = Object.fromEntries(GROUP_ORDER.map((g) => [g, []]));
  for (const l of dayLines) byGroup[groupFor(l)].push(l);
  if (Math.abs(gap) > 0.5) {
    byGroup.Other.push({ name: null, unitemized: true, unit: null, quantity: null, lineTotal: gap, category: null });
  }

  const groups = GROUP_ORDER
    .map((group) => {
      const items = byGroup[group];
      const total = round2(items.reduce((s, l) => s + l.lineTotal, 0));
      return { group, total, share: recorded > 0 ? total / recorded : 0, items };
    })
    .filter((g) => g.items.length > 0);

  const sales = meta ? Number(meta.totalSales) : null;
  return {
    date,
    hasData: !!meta || dayLines.length > 0,
    isOffDay: !!meta?.isOffDay,
    recorded,
    itemized,
    gap,
    sales,
    expensePct: sales && sales > 0 ? recorded / sales : null,
    lineCount: dayLines.length,
    groups,
  };
}

// Newest recorded date on or before `today` (what the gallery opens on), else today.
export function latestRecordedDate(daily, today) {
  const dates = daily.map((d) => d.date).filter((d) => d <= today).sort();
  return dates.length ? dates[dates.length - 1] : today;
}
