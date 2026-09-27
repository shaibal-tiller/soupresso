import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';

export const dynamic = 'force-dynamic';

// POST /api/sales-tally/bowl-count  { date, itemId, singleCount, doubleCount }
// Upserts the closing bowl count for a 'bowl_single'/'bowl_double'-mode item.
// doubleCount is forced to 0 for 'bowl_single' items regardless of what's sent.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { date, itemId, singleCount, doubleCount } = body || {};
  if (!date || !itemId) {
    return NextResponse.json({ error: 'date and itemId are required' }, { status: 400 });
  }
  const single = Math.max(0, Math.round(coerceLocaleNumber(singleCount) ?? 0));
  const double = Math.max(0, Math.round(coerceLocaleNumber(doubleCount) ?? 0));

  try {
    const { rows: itemRows } = await query(`SELECT tracking_mode FROM menu_items WHERE id = $1`, [itemId]);
    if (!itemRows.length) return NextResponse.json({ error: 'item not found' }, { status: 404 });
    const mode = itemRows[0].tracking_mode;
    if (mode !== 'bowl_single' && mode !== 'bowl_double') {
      return NextResponse.json({ error: 'this item is not tracked by bowl count' }, { status: 400 });
    }
    const effectiveDouble = mode === 'bowl_double' ? double : 0;

    const { rows } = await query(
      `INSERT INTO bowl_counts (entry_date, item_id, single_count, double_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (entry_date, item_id) DO UPDATE SET single_count = EXCLUDED.single_count, double_count = EXCLUDED.double_count
       RETURNING entry_date, item_id, single_count, double_count`,
      [date, itemId, single, effectiveDouble]
    );
    return NextResponse.json({ bowlCount: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
