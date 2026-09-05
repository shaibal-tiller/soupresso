import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/audit-log?date=YYYY-MM-DD  -> edit history for one day
// GET /api/audit-log                  -> recent edits (last 50)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  try {
    if (date) {
      const { rows } = await query(
        `SELECT * FROM entry_edit_log WHERE entry_date = $1 ORDER BY edited_at DESC`,
        [date]
      );
      return NextResponse.json({ edits: rows });
    }
    const { rows } = await query(
      `SELECT * FROM entry_edit_log ORDER BY edited_at DESC LIMIT 50`
    );
    return NextResponse.json({ edits: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
