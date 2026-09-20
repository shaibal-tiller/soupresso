import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Which bazar_items category rolls up into which top-level expense group.
// "Cost of products" is what goes into the food itself; "Overhead" is
// keeping the business running regardless of how much food is sold;
// everything else (packaging, serving equipment, uncategorized, and the
// unitemized gap) falls into "Other".
const COST_OF_PRODUCTS_CATEGORIES = new Set([
  'Meat & Egg', 'Vegetables', 'Herbs & Leaves', 'Raw Spices',
  'Processed Spices & Sauces', 'Cooking Essentials',
]);
const OVERHEAD_CATEGORIES = new Set(['Staff & Home', 'Shop Operations & Repairs']);

function expenseGroupFor(category) {
  if (COST_OF_PRODUCTS_CATEGORIES.has(category)) return 'Cost of products';
  if (OVERHEAD_CATEGORIES.has(category)) return 'Overhead';
  return 'Other';
}

// GET /api/dashboard?range=7d|14d|30d|month|all
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '14d';

  try {
    let dateFilter, label;
    switch (range) {
      case '7d':
        dateFilter = `entry_date >= CURRENT_DATE - INTERVAL '6 days'`;
        label = 'Last 7 days';
        break;
      case '30d':
        dateFilter = `entry_date >= CURRENT_DATE - INTERVAL '29 days'`;
        label = 'Last 30 days';
        break;
      case 'month':
        dateFilter = `date_trunc('month', entry_date) = date_trunc('month', CURRENT_DATE)`;
        label = 'This month';
        break;
      case 'all':
        dateFilter = `TRUE`;
        label = 'All time';
        break;
      default: // 14d
        dateFilter = `entry_date >= CURRENT_DATE - INTERVAL '13 days'`;
        label = 'Last 14 days';
    }

    // Same range boundary, expressed against bazar_plan_items.for_date instead
    // of daily_entries.entry_date, for the expense-by-category breakdown below.
    const itemDateFilter = dateFilter.replaceAll('entry_date', 'for_date');

    // These queries don't depend on each other's results, so run them
    // concurrently instead of paying for sequential round-trips to the
    // database — the slowest one, not the sum, becomes the wait time.
    const [mostRecent, rangeRows, weeklyRows, monthlyRows, categoryRows] = await Promise.all([
      query(`SELECT * FROM daily_entries ORDER BY entry_date DESC LIMIT 1`),
      query(
        `SELECT entry_date, total_sales, cash_taken_home, bazar_actual_cost, bazar_variance
         FROM daily_entries WHERE ${dateFilter} ORDER BY entry_date ASC`
      ),
      // Weekly aggregates (Mon-Sun weeks)
      query(
        `SELECT date_trunc('week', entry_date)::date AS week_start,
                SUM(total_sales) AS total_sales,
                SUM(cash_taken_home) AS total_take_home,
                SUM(bazar_actual_cost) AS total_expense,
                COUNT(*) AS days_count
         FROM daily_entries WHERE ${dateFilter}
         GROUP BY week_start ORDER BY week_start ASC`
      ),
      // Monthly aggregates
      query(
        `SELECT to_char(entry_date, 'YYYY-MM') AS month,
                SUM(total_sales) AS total_sales,
                SUM(cash_taken_home) AS total_take_home,
                SUM(bazar_actual_cost) AS total_expense,
                COUNT(*) AS days_count,
                ROUND(AVG(total_sales), 0) AS avg_daily_sales
         FROM daily_entries WHERE ${dateFilter}
         GROUP BY month ORDER BY month ASC`
      ),
      // Expense breakdown by bazar item category — only covers days that were
      // itemized (kind='actual' rows exist); the "Unitemized" gap for days
      // saved via the simple lump-total mode is reconciled below.
      query(
        `SELECT COALESCE(bi.category, 'Other') AS category,
                SUM(bpi.line_total) AS total,
                COUNT(*) AS line_count
         FROM bazar_plan_items bpi
         LEFT JOIN bazar_items bi ON bi.id = bpi.item_id
         WHERE bpi.kind = 'actual' AND ${itemDateFilter}
         GROUP BY category ORDER BY total DESC`
      ),
    ]);

    const rows = rangeRows.rows;
    const totalSales = rows.reduce((s, r) => s + Number(r.total_sales), 0);
    const totalTakeHome = rows.reduce((s, r) => s + Number(r.cash_taken_home), 0);
    const totalExpense = rows.reduce((s, r) => s + Number(r.bazar_actual_cost), 0);
    const daysRecorded = rows.length;
    const avgDailySales = daysRecorded ? totalSales / daysRecorded : 0;
    const bestDay = rows.length ? rows.reduce((best, r) => Number(r.total_sales) > Number(best.total_sales) ? r : best) : null;
    const worstDay = rows.length ? rows.reduce((worst, r) => Number(r.total_sales) < Number(worst.total_sales) ? r : worst) : null;

    // Days saved via the "simple" lump-total bazar entry (no itemized lines)
    // still count toward totalExpense but have nothing in bazar_plan_items —
    // fold the gap into an "Unitemized" bucket so the breakdown always adds
    // up to the same totalExpense shown in the KPIs above.
    const categoryBreakdown = categoryRows.rows.map((r) => ({
      category: r.category,
      total: Number(r.total),
      lineCount: Number(r.line_count),
    }));
    const itemizedTotal = categoryBreakdown.reduce((s, r) => s + r.total, 0);
    const unitemizedGap = Math.round((totalExpense - itemizedTotal) * 100) / 100;
    if (unitemizedGap > 0.5) {
      categoryBreakdown.push({ category: 'Unitemized', total: unitemizedGap, lineCount: null });
    }
    categoryBreakdown.sort((a, b) => b.total - a.total);

    // Top-level roll-up: cost of products vs. overhead vs. everything else.
    const groupTotals = { 'Cost of products': 0, Overhead: 0, Other: 0 };
    for (const r of categoryBreakdown) groupTotals[expenseGroupFor(r.category)] += r.total;
    const expenseByGroup = Object.entries(groupTotals)
      .map(([group, total]) => ({ group, total: Math.round(total * 100) / 100 }))
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      mostRecent: mostRecent.rows[0] || null,
      range: label,
      summary: { totalSales, totalTakeHome, totalExpense, daysRecorded, avgDailySales, bestDay, worstDay },
      expenseByGroup,
      expenseByCategory: categoryBreakdown,
      daily: rows,
      weekly: weeklyRows.rows,
      monthly: monthlyRows.rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
