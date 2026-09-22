import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/bazar-recurring-items -> the default items to preload into
// "Tomorrow's bazar advance" when no plan has been saved yet for that date.
// Callers enrich each row's name/icon/unit options from /api/bazar-items by
// item_id, same as a saved bazar_plan_items row.
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT * FROM bazar_recurring_items WHERE active = true ORDER BY sort_order ASC, id ASC`
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/bazar-recurring-items { itemId, active }
// Toggles a catalog item's membership in "tomorrow's default list" — an
// upsert since a never-recurring item has no row yet. Turning it off just
// deactivates the row (keeps its quantity/price for if it's turned back on)
// rather than deleting it.
export async function PATCH(request) {
  try {
    const body = await request.json();
    const itemId = Number(body.itemId);
    const active = !!body.active;
    if (!itemId) return NextResponse.json({ error: 'itemId is required' }, { status: 400 });

    const existing = await query(`SELECT * FROM bazar_recurring_items WHERE item_id = $1`, [itemId]);
    if (existing.rows.length) {
      const { rows } = await query(
        `UPDATE bazar_recurring_items SET active = $1 WHERE item_id = $2 RETURNING *`,
        [active, itemId]
      );
      return NextResponse.json({ item: rows[0] });
    }

    if (!active) return NextResponse.json({ item: null }); // nothing to deactivate

    const itemRes = await query(`SELECT unit, unit_based FROM bazar_items WHERE id = $1`, [itemId]);
    if (!itemRes.rows.length) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    const sortRes = await query(`SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM bazar_recurring_items`);
    const { rows } = await query(
      `INSERT INTO bazar_recurring_items (item_id, quantity, unit, total_price, sort_order, active)
       VALUES ($1, 1, $2, 0, $3, true) RETURNING *`,
      [itemId, itemRes.rows[0].unit_based === false ? null : itemRes.rows[0].unit, sortRes.rows[0].next]
    );
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
