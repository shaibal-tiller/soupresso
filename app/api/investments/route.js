import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';

export const dynamic = 'force-dynamic'; // always hits the live database, never statically cached

// GET /api/investments                -> every entry, newest first
// GET /api/investments?category=X     -> entries in one category, newest first
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');

  try {
    const { rows } = category
      ? await query(
          `SELECT * FROM investments WHERE category = $1 ORDER BY spent_on DESC, id DESC`,
          [category]
        )
      : await query(`SELECT * FROM investments ORDER BY spent_on DESC, id DESC`);
    return NextResponse.json({ items: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Create a new entry, or update an existing one if `id` is provided.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { id, spentOn, category, description, amount, notes } = body || {};

  if (!spentOn || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) {
    return NextResponse.json({ error: 'spentOn (YYYY-MM-DD) is required' }, { status: 400 });
  }
  if (!category || !category.trim()) {
    return NextResponse.json({ error: 'category is required' }, { status: 400 });
  }
  if (!description || !description.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }
  const amt = coerceLocaleNumber(amount);
  if (amt == null) {
    return NextResponse.json({ error: 'amount must be a number' }, { status: 400 });
  }

  try {
    if (id) {
      const { rows } = await query(
        `UPDATE investments SET spent_on=$1, category=$2, description=$3, amount=$4, notes=$5, updated_at=now()
         WHERE id=$6 RETURNING *`,
        [spentOn, category.trim(), description.trim(), amt, notes || null, id]
      );
      if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ item: rows[0] });
    } else {
      const { rows } = await query(
        `INSERT INTO investments (spent_on, category, description, amount, notes)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [spentOn, category.trim(), description.trim(), amt, notes || null]
      );
      return NextResponse.json({ item: rows[0] });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
