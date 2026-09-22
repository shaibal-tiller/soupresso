import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/bazar-categories -> curated category list, each with how many
// bazar_items currently reference it (used to gate deletion).
export async function GET() {
  try {
    const { rows } = await query(
      `SELECT bc.*, COUNT(bi.id)::int AS item_count
         FROM bazar_categories bc
         LEFT JOIN bazar_items bi ON bi.category = bc.name
        GROUP BY bc.id
        ORDER BY bc.sort_order ASC, bc.name ASC`
    );
    return NextResponse.json({ categories: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/bazar-categories { name, icon? } -> create a new category.
export async function POST(request) {
  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const { rows } = await query(
      `INSERT INTO bazar_categories (name, icon) VALUES ($1, $2) RETURNING *, 0 AS item_count`,
      [name, body.icon || null]
    );
    return NextResponse.json({ category: rows[0] });
  } catch (err) {
    if (err.code === '23505') return NextResponse.json({ error: 'A category with that name already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/bazar-categories { id, name?, icon? } -> rename/re-icon a
// category. Renaming cascades to every bazar_items row using the old name.
export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const existingRes = await query(`SELECT * FROM bazar_categories WHERE id = $1`, [id]);
    if (!existingRes.rows.length) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    const existing = existingRes.rows[0];

    const nextName = body.name !== undefined ? String(body.name).trim() : existing.name;
    if (!nextName) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    const nextIcon = body.icon !== undefined ? (String(body.icon).trim() || null) : existing.icon;

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `UPDATE bazar_categories SET name = $1, icon = $2 WHERE id = $3 RETURNING *`,
        [nextName, nextIcon, id]
      );
      if (nextName !== existing.name) {
        await client.query(`UPDATE bazar_items SET category = $1 WHERE category = $2`, [nextName, existing.name]);
      }
      await client.query('COMMIT');
      return NextResponse.json({ category: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.code === '23505') return NextResponse.json({ error: 'A category with that name already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/bazar-categories?id=N -> remove a category, only if empty
// (no bazar_items reference it) — older items are never silently orphaned.
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    const catRes = await query(`SELECT name FROM bazar_categories WHERE id = $1`, [id]);
    if (!catRes.rows.length) return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    const countRes = await query(`SELECT COUNT(*)::int AS n FROM bazar_items WHERE category = $1`, [catRes.rows[0].name]);
    if (countRes.rows[0].n > 0) {
      return NextResponse.json({ error: 'Category still has items — move or remove them first' }, { status: 409 });
    }
    await query(`DELETE FROM bazar_categories WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
