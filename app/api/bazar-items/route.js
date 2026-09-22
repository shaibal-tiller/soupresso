import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/bazar-items -> the tappable item catalog for the bazar planner,
// active items only, each with:
//   - `recent_price` — the unit price it was actually bought at most
//     recently, within the last 10 days (null if none). Matched on the
//     item's current default unit too, so a suggestion never mixes e.g. a
//     per-dozen price into a per-piece default.
//   - `recent_unit` — whatever unit it was actually bought in most recently
//     (any lookback, no unit match required), so the picker can default to
//     "what we actually buy" (e.g. Coriander in 250g) instead of a static
//     catalog default that may be stale (e.g. catalog says 100g).
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT bi.*,
              (SELECT bpi.unit_price
                 FROM bazar_plan_items bpi
                WHERE bpi.item_id = bi.id
                  AND bpi.kind = 'actual'
                  AND bpi.unit = bi.unit
                  AND bpi.for_date >= CURRENT_DATE - INTERVAL '10 days'
                ORDER BY bpi.for_date DESC, bpi.id DESC
                LIMIT 1) AS recent_price,
              (SELECT bpi.unit
                 FROM bazar_plan_items bpi
                WHERE bpi.item_id = bi.id
                  AND bpi.kind = 'actual'
                  AND bpi.unit IS NOT NULL AND bpi.unit != ''
                ORDER BY bpi.for_date DESC, bpi.id DESC
                LIMIT 1) AS recent_unit
         FROM bazar_items bi
        WHERE bi.active = true
        ORDER BY bi.sort_order ASC, bi.name ASC`
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/bazar-items { id, isFrequent } -> mark/unmark an item on the
// "frequent" quick-pick shortlist. Nothing else about an item is editable
// from this route.
export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
    const { rows } = await query(
      `UPDATE bazar_items SET is_frequent = $1 WHERE id = $2 RETURNING id, is_frequent`,
      [!!body.isFrequent, id]
    );
    if (!rows.length) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
