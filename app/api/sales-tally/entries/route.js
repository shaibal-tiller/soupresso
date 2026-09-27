import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';

export const dynamic = 'force-dynamic';

// POST /api/sales-tally/entries  { date, itemId, quantity }
// Logs one production batch for a 'production'-mode item.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { date, itemId, quantity } = body || {};
  const qty = coerceLocaleNumber(quantity);
  if (!date || !itemId || qty == null || qty <= 0) {
    return NextResponse.json({ error: 'date, itemId, and a positive quantity are required' }, { status: 400 });
  }

  try {
    const { rows: itemRows } = await query(`SELECT tracking_mode FROM menu_items WHERE id = $1`, [itemId]);
    if (!itemRows.length) return NextResponse.json({ error: 'item not found' }, { status: 404 });
    if (itemRows[0].tracking_mode !== 'production') {
      return NextResponse.json({ error: 'this item is not tracked by production batches' }, { status: 400 });
    }
    const { rows } = await query(
      `INSERT INTO production_entries (entry_date, item_id, quantity)
       VALUES ($1, $2, $3) RETURNING id, quantity, created_at AS "createdAt"`,
      [date, itemId, Math.round(qty)]
    );
    return NextResponse.json({ entry: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/sales-tally/entries?id=N -> remove one mis-logged batch.
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    await query(`DELETE FROM production_entries WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
