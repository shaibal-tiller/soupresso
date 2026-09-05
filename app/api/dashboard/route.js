import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic'; // always hits the live database, never statically cached

export async function GET() {
  try {
    const mostRecent = await query(
      `SELECT * FROM daily_entries ORDER BY entry_date DESC LIMIT 1`
    );

    const monthRows = await query(
      `SELECT entry_date, total_sales, cash_taken_home, bazar_variance
       FROM daily_entries
       WHERE date_trunc('month', entry_date) = date_trunc('month', CURRENT_DATE)
       ORDER BY entry_date ASC`
    );

    const last14 = await query(
      `SELECT entry_date, total_sales
       FROM daily_entries
       WHERE entry_date >= CURRENT_DATE - INTERVAL '13 days'
       ORDER BY entry_date ASC`
    );

    const monthTotalSales = monthRows.rows.reduce((s, r) => s + Number(r.total_sales), 0);
    const monthTotalTakeHome = monthRows.rows.reduce((s, r) => s + Number(r.cash_taken_home), 0);
    const daysRecorded = monthRows.rows.length;
    const avgDailySales = daysRecorded ? monthTotalSales / daysRecorded : 0;

    return NextResponse.json({
      mostRecent: mostRecent.rows[0] || null,
      month: {
        totalSales: monthTotalSales,
        totalTakeHome: monthTotalTakeHome,
        daysRecorded,
        avgDailySales,
      },
      last14: last14.rows,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
