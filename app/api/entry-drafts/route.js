import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import {
  DRAFT_RETENTION_HOURS,
  DRAFT_WINDOW_DAYS,
  isDraftDateAvailable,
  shiftDateStr,
  todayStrTZ,
} from '@/lib/dates';

export const dynamic = 'force-dynamic';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function draftWindow() {
  const today = todayStrTZ();
  return { today, cutoff: shiftDateStr(today, -DRAFT_WINDOW_DAYS) };
}

async function cleanupExpired(today, cutoff) {
  await query(
    `DELETE FROM entry_drafts
      WHERE updated_at < now() - ($1::int * interval '1 hour')
         OR entry_date < $2
         OR entry_date > $3`,
    [DRAFT_RETENTION_HOURS, cutoff, today]
  );
}

// GET /api/entry-drafts?date=YYYY-MM-DD -> the latest draft for that date, if any
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 });
  }

  const { today, cutoff } = draftWindow();

  try {
    await cleanupExpired(today, cutoff);

    if (!isDraftDateAvailable(date, today)) {
      await query(`DELETE FROM entry_drafts WHERE entry_date = $1`, [date]);
      return NextResponse.json({ draft: null });
    }

    const { rows } = await query(
      `SELECT to_char(entry_date, 'YYYY-MM-DD') AS entry_date, payload, updated_at
         FROM entry_drafts
        WHERE entry_date = $1`,
      [date]
    );

    return NextResponse.json({ draft: rows[0] || null });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/entry-drafts -> create or replace the one draft for an entry date
export async function PUT(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const entryDate = body?.entryDate;
  const payload = body?.payload;
  const deviceId = typeof body?.deviceId === 'string' ? body.deviceId.slice(0, 120) : null;

  if (!entryDate || !DATE_RE.test(entryDate)) {
    return NextResponse.json({ error: 'entryDate (YYYY-MM-DD) is required' }, { status: 400 });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'payload must be an object' }, { status: 400 });
  }

  const serialized = JSON.stringify(payload);
  if (serialized.length > 500_000) {
    return NextResponse.json({ error: 'Draft is too large' }, { status: 413 });
  }

  const { today, cutoff } = draftWindow();
  if (!isDraftDateAvailable(entryDate, today)) {
    return NextResponse.json(
      { error: `Drafts are only kept for today and the previous ${DRAFT_WINDOW_DAYS} days.` },
      { status: 403 }
    );
  }

  try {
    await cleanupExpired(today, cutoff);

    const { rows } = await query(
      `INSERT INTO entry_drafts (entry_date, payload, device_id, updated_at)
       VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (entry_date) DO UPDATE SET
         payload = EXCLUDED.payload,
         device_id = EXCLUDED.device_id,
         updated_at = now()
       RETURNING to_char(entry_date, 'YYYY-MM-DD') AS entry_date, payload, updated_at`,
      [entryDate, serialized, deviceId]
    );

    return NextResponse.json({ draft: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/entry-drafts?date=YYYY-MM-DD -> drop that date's draft
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  if (!date || !DATE_RE.test(date)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 });
  }

  try {
    await query(`DELETE FROM entry_drafts WHERE entry_date = $1`, [date]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
