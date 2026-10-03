import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { quantitySoldForItem, varianceStatus } from '@/lib/sales-tally';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/sales-tally/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
// Roll-up of the Sales Tally over a date range (a week, a month, anything):
//   items: units sold + value per menu item across the range
//   days:  per-day computed total (quantity x price) vs the day's actual cash sales
//   totals: the same across the days that have BOTH tally data and a cash entry,
//           so days nobody has tallied yet don't read as a huge shortfall.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!DATE_RE.test(from || '') || !DATE_RE.test(to || '')) {
    return NextResponse.json({ error: 'from and to (YYYY-MM-DD) are required' }, { status: 400 });
  }

  try {
    const [menu, prod, left, bowls, sales] = await Promise.all([
      query(`SELECT id, name, price, tracking_mode, active, sort_order FROM menu_items ORDER BY sort_order ASC, name ASC`),
      query(`SELECT item_id, entry_date::text AS d, SUM(quantity)::int AS made FROM production_entries WHERE entry_date BETWEEN $1 AND $2 GROUP BY 1, 2`, [from, to]),
      query(`SELECT item_id, entry_date::text AS d, SUM(leftover_qty)::int AS lo FROM production_leftovers WHERE entry_date BETWEEN $1 AND $2 GROUP BY 1, 2`, [from, to]),
      query(`SELECT item_id, entry_date::text AS d, single_count, double_count FROM bowl_counts WHERE entry_date BETWEEN $1 AND $2`, [from, to]),
      query(`SELECT entry_date::text AS d, total_sales FROM daily_entries WHERE entry_date BETWEEN $1 AND $2`, [from, to]),
    ]);

    const made = new Map(prod.rows.map((r) => [`${r.item_id}|${r.d}`, r.made]));
    const leftover = new Map(left.rows.map((r) => [`${r.item_id}|${r.d}`, r.lo]));
    const bowl = new Map(bowls.rows.map((r) => [`${r.item_id}|${r.d}`, r]));
    const actualByDay = new Map(sales.rows.map((r) => [r.d, Number(r.total_sales)]));

    const dates = new Set([...prod.rows, ...left.rows, ...bowls.rows, ...sales.rows].map((r) => r.d));
    const itemAgg = new Map(menu.rows.map((m) => [m.id, { id: m.id, name: m.name, price: Number(m.price), trackingMode: m.tracking_mode, active: m.active, quantity: 0, value: 0 }]));

    const days = Array.from(dates).sort().map((d) => {
      let computed = 0; let hasTally = false;
      for (const m of menu.rows) {
        const key = `${m.id}|${d}`;
        const b = bowl.get(key);
        const item = {
          trackingMode: m.tracking_mode,
          entries: made.has(key) ? [{ quantity: made.get(key) }] : [],
          leftoverQty: leftover.get(key) || 0,
          singleCount: b ? b.single_count : 0,
          doubleCount: b ? b.double_count : 0,
        };
        const sold = quantitySoldForItem(item);
        if (made.has(key) || b || leftover.has(key)) hasTally = true;
        const agg = itemAgg.get(m.id);
        agg.quantity += sold;
        agg.value += sold * Number(m.price);
        computed += sold * Number(m.price);
      }
      const actual = actualByDay.has(d) ? actualByDay.get(d) : null;
      const variance = hasTally && actual != null ? computed - actual : null;
      return { date: d, computed, actual, hasTally, variance, status: variance == null ? null : varianceStatus(variance) };
    });

    const comparable = days.filter((d) => d.variance != null);
    const totals = {
      computed: days.reduce((s, d) => s + d.computed, 0),
      comparedComputed: comparable.reduce((s, d) => s + d.computed, 0),
      comparedActual: comparable.reduce((s, d) => s + d.actual, 0),
      daysWithTally: days.filter((d) => d.hasTally).length,
      daysCompared: comparable.length,
    };
    totals.variance = totals.comparedComputed - totals.comparedActual;

    const items = Array.from(itemAgg.values()).filter((i) => i.quantity > 0 || i.active);
    return NextResponse.json({ from, to, items, days, totals });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
