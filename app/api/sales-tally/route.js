import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { quantitySoldForItem, computeReconciliation } from '@/lib/sales-tally';

export const dynamic = 'force-dynamic'; // always hits the live database, never statically cached

// GET /api/sales-tally?date=YYYY-MM-DD
// Every active menu item, plus any item with logged activity on that date
// even if it's since been deactivated (so past days stay accurate), joined
// with that item's production batches or closing bowl count for the date.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 });

  try {
    const { rows } = await query(
      `SELECT
         m.id, m.name, m.price, m.tracking_mode,
         COALESCE(bc.single_count, 0) AS single_count,
         COALESCE(bc.double_count, 0) AS double_count,
         COALESCE(pl.leftover_qty, 0) AS leftover_qty,
         COALESCE(pl.carried_forward, false) AS carried_forward,
         COALESCE(
           (SELECT json_agg(json_build_object('id', pe.id, 'quantity', pe.quantity, 'createdAt', pe.created_at, 'carriedOver', pe.carried_over) ORDER BY pe.created_at)
            FROM production_entries pe WHERE pe.item_id = m.id AND pe.entry_date = $1),
           '[]'
         ) AS entries
       FROM menu_items m
       LEFT JOIN bowl_counts bc ON bc.item_id = m.id AND bc.entry_date = $1
       LEFT JOIN production_leftovers pl ON pl.item_id = m.id AND pl.entry_date = $1
       WHERE m.active = true
          OR EXISTS (SELECT 1 FROM production_entries pe2 WHERE pe2.item_id = m.id AND pe2.entry_date = $1)
          OR EXISTS (SELECT 1 FROM bowl_counts bc2 WHERE bc2.item_id = m.id AND bc2.entry_date = $1)
          OR EXISTS (SELECT 1 FROM production_leftovers pl2 WHERE pl2.item_id = m.id AND pl2.entry_date = $1)
       ORDER BY m.sort_order ASC, m.name ASC`,
      [date]
    );

    const items = rows.map((r) => {
      const item = {
        id: r.id,
        name: r.name,
        price: Number(r.price),
        trackingMode: r.tracking_mode,
        singleCount: Number(r.single_count),
        doubleCount: Number(r.double_count),
        leftoverQty: Number(r.leftover_qty),
        carriedForward: r.carried_forward,
        entries: r.entries || [],
      };
      const quantitySold = quantitySoldForItem(item);
      return { ...item, quantitySold, value: quantitySold * item.price };
    });

    const { rows: entryRows } = await query(
      `SELECT total_sales FROM daily_entries WHERE entry_date = $1`,
      [date]
    );
    const hasCashEntry = entryRows.length > 0;
    const actualSales = hasCashEntry ? Number(entryRows[0].total_sales) : null;

    const { computedTotal, variance, status } = computeReconciliation(items, actualSales);

    return NextResponse.json({ date, items, computedTotal, hasCashEntry, actualSales, variance, status });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
