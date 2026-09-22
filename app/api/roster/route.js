import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/roster -> all 7 weekday rows (0=Sunday..6=Saturday), each with
// the default team for that weekday. Always 7 rows (seeded by schema.sql).
export async function GET() {
  try {
    const { rows } = await query(`SELECT day_of_week, people FROM roster ORDER BY day_of_week`);
    return NextResponse.json({ roster: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/roster { dayOfWeek, people } -> replace one weekday's default team.
export async function PUT(request) {
  try {
    const body = await request.json();
    const dayOfWeek = Number(body.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ error: 'dayOfWeek must be 0-6' }, { status: 400 });
    }
    const people = Array.isArray(body.people) ? body.people.filter((n) => typeof n === 'string') : [];
    const { rows } = await query(
      `UPDATE roster SET people = $1 WHERE day_of_week = $2 RETURNING day_of_week, people`,
      [people, dayOfWeek]
    );
    return NextResponse.json({ roster: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
