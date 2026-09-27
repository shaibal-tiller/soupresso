import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';

export const dynamic = 'force-dynamic'; // always hits the live database, never statically cached

export async function GET() {
  try {
    const { rows } = await query(
      `SELECT * FROM menu_items ORDER BY sort_order ASC, name ASC`
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const TRACKING_MODES = ['production', 'bowl_single', 'bowl_double'];

// Create a new item, or update an existing one if `id` is provided.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { id, name, price, active = true, sortOrder = 0, trackingMode = 'production' } = body || {};

  const p = coerceLocaleNumber(price);
  if (!name || price === undefined || p == null) {
    return NextResponse.json({ error: 'name and a numeric price are required' }, { status: 400 });
  }
  const sort = coerceLocaleNumber(sortOrder) ?? 0;
  const mode = TRACKING_MODES.includes(trackingMode) ? trackingMode : 'production';

  try {
    if (id) {
      const { rows: currentRows } = await query(`SELECT tracking_mode FROM menu_items WHERE id = $1`, [id]);
      if (!currentRows.length) return NextResponse.json({ error: 'item not found' }, { status: 404 });
      if (currentRows[0].tracking_mode !== mode) {
        const { rows: activityRows } = await query(
          `SELECT
             EXISTS (SELECT 1 FROM production_entries WHERE item_id = $1) AS has_production,
             EXISTS (SELECT 1 FROM bowl_counts WHERE item_id = $1) AS has_bowl_counts`,
          [id]
        );
        if (activityRows[0].has_production || activityRows[0].has_bowl_counts) {
          return NextResponse.json(
            { error: 'This item already has recorded production/bowl-count data — its tracking mode cannot be changed, since switching it would silently drop those historical entries from the tally.' },
            { status: 409 }
          );
        }
      }
      const { rows } = await query(
        `UPDATE menu_items SET name=$1, price=$2, active=$3, sort_order=$4, tracking_mode=$5 WHERE id=$6 RETURNING *`,
        [name, p, !!active, sort, mode, id]
      );
      return NextResponse.json({ item: rows[0] });
    } else {
      const { rows } = await query(
        `INSERT INTO menu_items (name, price, active, sort_order, tracking_mode) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [name, p, !!active, sort, mode]
      );
      return NextResponse.json({ item: rows[0] });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
