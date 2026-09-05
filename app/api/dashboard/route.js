import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/dashboard?range=7d|14d|30d|month|all
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '14d';

  try {
    const mostRecent = await query(
      `SELECT * FROM daily_entries ORDER BY entry_date DESC LIMIT 1`
    );

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

    const rangeRows = await query(
      `SELECT entry_date, total_sales, cash_taken_home, bazar_actual_cost, bazar_variance
       FROM daily_entries WHERE ${dateFilter} ORDER BY entry_date ASC`
    );

    // Weekly aggregates (Mon-Sun weeks)
    const weeklyRows = await query(
      `SELECT date_trunc('week', entry_date)::date AS week_start,
              SUM(total_sales) AS total_sales,
              SUM(cash_taken_home) AS total_take_home,
              SUM(bazar_actual_cost) AS total_expense,
              COUNT(*) AS days_count
       FROM daily_entries WHERE ${dateFilter}
       GROUP BY week_start ORDER BY week_start ASC`
    );

    // Monthly aggregates
    const monthlyRows = await query(
      `SELECT to_char(entry_date, 'YYYY-MM') AS month,
              SUM(total_sales) AS total_sales,
              SUM(cash_taken_home) AS total_take_home,
              SUM(bazar_actual_cost) AS total_expense,
              COUNT(*) AS days_count,
              ROUND(AVG(total_sales), 0) AS avg_daily_sales
       FROM daily_entries WHERE ${dateFilter}
       GROUP BY month ORDER BY month ASC`
    );

    const rows = rangeRows.rows;
    const totalSales = rows.reduce((s, r) => s + Number(r.total_sales), 0);
    const totalTakeHome = rows.reduce((s, r) => s + Number(r.cash_taken_home), 0);
    const totalExpense = rows.reduce((s, r) => s + Number(r.bazar_actual_cost), 0);
    const daysRecorded = rows.length;
    const avgDailySales = daysRecorded ? totalSales / daysRecorded : 0;
    const bestDay = rows.length ? rows.reduce((best, r) => Number(r.total_sales) > Number(best.total_sales) ? r : best) : null;
    const worstDay = rows.length ? rows.reduce((worst, r) => Number(r.total_sales) < Number(worst.total_sales) ? r : worst) : null;

    return NextResponse.json({
      mostRecent: mostRecent.rows[0] || null,
      range: label,
      summary: { totalSales, totalTakeHome, totalExpense, daysRecorded, avgDailySales, bestDay, worstDay },
      daily: rows,
      weekly: weeklyRows.rows,
      monthly: monthlyRows.rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
