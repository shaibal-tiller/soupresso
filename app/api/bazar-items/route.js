import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/bazar-items -> the tappable item catalog for the bazar planner, active items only
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT * FROM bazar_items WHERE active = true ORDER BY sort_order ASC, name ASC`
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
