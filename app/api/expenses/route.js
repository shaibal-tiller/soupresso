import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/expenses?range=7d|14d|30d|month|all
//   or ?from=YYYY-MM-DD&to=YYYY-MM-DD for a custom range (takes priority)
//
// Returns line-level bazar_plan_items data (kind='actual') plus each day's
// recorded bazar_actual_cost for the same range. The by-category/by-item/
// by-day/by-group aggregation and all interaction (sorting, filtering,
// drill-down) happens client-side in app/expenses/page.js — the row count
// here is small enough (a few hundred lines) that shipping the raw lines
// once and letting the UI slice them every which way beats a new round trip
// per view.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || '30d';
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  try {
    let dateFilter, itemDateFilter, label, params = [];

    if (from && to && DATE_RE.test(from) && DATE_RE.test(to)) {
      dateFilter = `entry_date BETWEEN $1 AND $2`;
      itemDateFilter = `for_date BETWEEN $1 AND $2`;
      params = [from, to];
      label = `${from} to ${to}`;
    } else {
      switch (range) {
        case '7d':
          dateFilter = `entry_date >= CURRENT_DATE - INTERVAL '6 days'`;
          label = 'Last 7 days';
          break;
        case '14d':
          dateFilter = `entry_date >= CURRENT_DATE - INTERVAL '13 days'`;
          label = 'Last 14 days';
          break;
        case 'month':
          dateFilter = `date_trunc('month', entry_date) = date_trunc('month', CURRENT_DATE)`;
          label = 'This month';
          break;
        case 'all':
          dateFilter = `TRUE`;
          label = 'All time';
          break;
        default: // 30d
          dateFilter = `entry_date >= CURRENT_DATE - INTERVAL '29 days'`;
          label = 'Last 30 days';
      }
      itemDateFilter = dateFilter.replaceAll('entry_date', 'for_date');
    }

    const [dailyRes, lineRes] = await Promise.all([
      query(
        `SELECT entry_date::text AS date, bazar_actual_cost, total_sales, is_off_day
         FROM daily_entries WHERE ${dateFilter} ORDER BY entry_date ASC`,
        params
      ),
      query(
        `SELECT bpi.for_date::text AS date, bpi.name, bpi.unit, bpi.quantity, bpi.unit_price, bpi.line_total,
                COALESCE(bi.category, 'Other') AS category
         FROM bazar_plan_items bpi
         LEFT JOIN bazar_items bi ON bi.id = bpi.item_id
         WHERE bpi.kind = 'actual' AND ${itemDateFilter}
         ORDER BY bpi.for_date ASC, bpi.id ASC`,
        params
      ),
    ]);

    return NextResponse.json({
      range: label,
      daily: dailyRes.rows.map((r) => ({
        date: r.date,
        bazarActualCost: Number(r.bazar_actual_cost),
        totalSales: Number(r.total_sales),
        isOffDay: r.is_off_day,
      })),
      lines: lineRes.rows.map((r) => ({
        date: r.date,
        category: r.category,
        name: r.name,
        unit: r.unit,
        quantity: r.quantity === null ? null : Number(r.quantity),
        unitPrice: Number(r.unit_price),
        lineTotal: Number(r.line_total),
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
