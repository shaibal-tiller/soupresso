import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

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

// Create a new item, or update an existing one if `id` is provided.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { id, name, price, active = true, sortOrder = 0 } = body || {};

  if (!name || price === undefined || isNaN(Number(price))) {
    return NextResponse.json({ error: 'name and a numeric price are required' }, { status: 400 });
  }

  try {
    if (id) {
      const { rows } = await query(
        `UPDATE menu_items SET name=$1, price=$2, active=$3, sort_order=$4 WHERE id=$5 RETURNING *`,
        [name, Number(price), !!active, Number(sortOrder), id]
      );
      return NextResponse.json({ item: rows[0] });
    } else {
      const { rows } = await query(
        `INSERT INTO menu_items (name, price, active, sort_order) VALUES ($1,$2,$3,$4) RETURNING *`,
        [name, Number(price), !!active, Number(sortOrder)]
      );
      return NextResponse.json({ item: rows[0] });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
