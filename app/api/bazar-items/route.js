import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/bazar-items -> the tappable item catalog for the bazar planner,
// active items only, each with `recent_price` — the unit price it was
// actually bought at most recently, within the last 10 days (null if none),
// so the picker can suggest a starting price instead of a blank field.
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT bi.*,
              (SELECT bpi.unit_price
                 FROM bazar_plan_items bpi
                WHERE bpi.item_id = bi.id
                  AND bpi.kind = 'actual'
                  AND bpi.for_date >= CURRENT_DATE - INTERVAL '10 days'
                ORDER BY bpi.for_date DESC, bpi.id DESC
                LIMIT 1) AS recent_price
         FROM bazar_items bi
        WHERE bi.active = true
        ORDER BY bi.sort_order ASC, bi.name ASC`
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
