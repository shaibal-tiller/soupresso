import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';
import { shiftDateStr } from '@/lib/dates';

export const dynamic = 'force-dynamic';

// POST /api/sales-tally/leftover  { date, itemId, leftoverQty, carriedForward }
// Upserts the closing leftover count for a 'production'-mode item. If
// carriedForward is true, mirrors leftoverQty into tomorrow's
// production_entries (tagged carried_over/carried_from) so it counts as
// available stock without being re-entered as a fresh batch; if false (or
// the leftover is later reduced/un-checked), removes that mirrored row.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { date, itemId, leftoverQty, carriedForward } = body || {};
  if (!date || !itemId) {
    return NextResponse.json({ error: 'date and itemId are required' }, { status: 400 });
  }
  const leftover = Math.max(0, Math.round(coerceLocaleNumber(leftoverQty) ?? 0));
  const carried = !!carriedForward;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const { rows: itemRows } = await client.query(`SELECT tracking_mode FROM menu_items WHERE id = $1`, [itemId]);
    if (!itemRows.length) return NextResponse.json({ error: 'item not found' }, { status: 404 });
    if (itemRows[0].tracking_mode !== 'production') {
      return NextResponse.json({ error: 'this item is not tracked by production batches' }, { status: 400 });
    }

    const { rows: madeRows } = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) AS made FROM production_entries WHERE item_id = $1 AND entry_date = $2`,
      [itemId, date]
    );
    const made = Number(madeRows[0].made);
    if (leftover > made) {
      return NextResponse.json(
        { error: `leftover (${leftover}) can't exceed what was made today (${made})` },
        { status: 400 }
      );
    }

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO production_leftovers (entry_date, item_id, leftover_qty, carried_forward)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (entry_date, item_id) DO UPDATE SET leftover_qty = EXCLUDED.leftover_qty, carried_forward = EXCLUDED.carried_forward
       RETURNING entry_date, item_id, leftover_qty, carried_forward`,
      [date, itemId, leftover, carried]
    );

    // Always clear any previously-mirrored row for this leftover first —
    // covers both "un-checked carry-forward" and "leftover qty corrected".
    await client.query(`DELETE FROM production_entries WHERE item_id = $1 AND carried_from = $2`, [itemId, date]);

    if (carried && leftover > 0) {
      const nextDate = shiftDateStr(date, 1);
      await client.query(
        `INSERT INTO production_entries (entry_date, item_id, quantity, carried_over, carried_from)
         VALUES ($1, $2, $3, true, $4)`,
        [nextDate, itemId, leftover, date]
      );
    }

    await client.query('COMMIT');
    return NextResponse.json({ leftover: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
