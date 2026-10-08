import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 20000;

function tokenMatches(header) {
  const expected = process.env.BKASH_WEBHOOK_TOKEN;
  if (!expected || !header) return false;
  const given = header.replace(/^Bearer\s+/i, '').trim();
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Public to the session middleware (the phone has no cookie); guarded by BKASH_WEBHOOK_TOKEN instead.
// Capture only: stores the request exactly as received. Parsing comes once real samples exist.
export async function POST(request) {
  if (!tokenMatches(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const raw = (await request.text()).slice(0, MAX_BODY_BYTES);
  if (!raw.trim()) return NextResponse.json({ error: 'Empty body' }, { status: 400 });
  let payload = null;
  try { payload = JSON.parse(raw); } catch { /* not JSON — raw_body still keeps it */ }
  try {
    const { rows } = await getPool().query(
      `INSERT INTO bkash_notifications (content_type, raw_body, payload) VALUES ($1, $2, $3) RETURNING id`,
      [request.headers.get('content-type'), raw, payload === null ? null : JSON.stringify(payload)]
    );
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
