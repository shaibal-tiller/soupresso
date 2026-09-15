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
