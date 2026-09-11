import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';

export const dynamic = 'force-dynamic';

// GET /api/bazar-plan?date=YYYY-MM-DD&kind=planned|actual
// -> the item list a day's bazar was (or is being) shopped from.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const kind = searchParams.get('kind');
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 });
  }
  if (kind !== 'planned' && kind !== 'actual') {
    return NextResponse.json({ error: "kind must be 'planned' or 'actual'" }, { status: 400 });
  }

  const pool = getPool();
  try {
    const { rows } = await pool.query(
      `SELECT * FROM bazar_plan_items WHERE for_date = $1 AND kind = $2 ORDER BY id ASC`,
      [date, kind]
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/bazar-plan  { date, kind, items: [{ itemId, name, unit, quantity, unitPrice }] }
// Replaces the whole list for that date+kind (a day's bazar list is edited as
// a set, not diffed item by item).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { date, kind, items } = body || {};

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date (YYYY-MM-DD) is required' }, { status: 400 });
  }
  if (kind !== 'planned' && kind !== 'actual') {
    return NextResponse.json({ error: "kind must be 'planned' or 'actual'" }, { status: 400 });
  }
  if (!Array.isArray(items)) {
    return NextResponse.json({ error: 'items[] is required' }, { status: 400 });
  }

  const clean = [];
  for (const it of items) {
    const quantity = coerceLocaleNumber(it?.quantity) ?? 0;
    const unitPrice = coerceLocaleNumber(it?.unitPrice) ?? 0;
    const name = typeof it?.name === 'string' ? it.name.trim() : '';
    if (!name || quantity <= 0) continue; // drop empty/zero-qty rows silently
    clean.push({
      itemId: Number.isInteger(it?.itemId) ? it.itemId : null,
      name,
      unit: typeof it?.unit === 'string' ? it.unit : null,
      quantity,
      unitPrice,
      lineTotal: Math.round(quantity * unitPrice * 100) / 100,
    });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM bazar_plan_items WHERE for_date = $1 AND kind = $2`, [date, kind]);
    for (const it of clean) {
      await client.query(
        `INSERT INTO bazar_plan_items (for_date, kind, item_id, name, unit, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [date, kind, it.itemId, it.name, it.unit, it.quantity, it.unitPrice, it.lineTotal]
      );
    }
    await client.query('COMMIT');
    const total = clean.reduce((sum, it) => sum + it.lineTotal, 0);
    return NextResponse.json({ ok: true, count: clean.length, total: Math.round(total * 100) / 100 });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
