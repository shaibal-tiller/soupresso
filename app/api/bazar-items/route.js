import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/bazar-items -> the tappable item catalog for the bazar planner,
// active items only, each with:
//   - `recent_price` — the unit price it was actually bought at most
//     recently, within the last 10 days (null if none). Matched on the
//     item's current default unit too, so a suggestion never mixes e.g. a
//     per-dozen price into a per-piece default.
//   - `recent_unit` — whatever unit it was actually bought in most recently
//     (any lookback, no unit match required), so the picker can default to
//     "what we actually buy" (e.g. Coriander in 250g) instead of a static
//     catalog default that may be stale (e.g. catalog says 100g).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get('all') === '1';
  try {
    const { rows } = await query(
      `SELECT bi.*,
              (SELECT bpi.unit_price
                 FROM bazar_plan_items bpi
                WHERE bpi.item_id = bi.id
                  AND bpi.kind = 'actual'
                  AND bpi.unit = bi.unit
                  AND bpi.for_date >= CURRENT_DATE - INTERVAL '10 days'
                ORDER BY bpi.for_date DESC, bpi.id DESC
                LIMIT 1) AS recent_price,
              (SELECT bpi.unit
                 FROM bazar_plan_items bpi
                WHERE bpi.item_id = bi.id
                  AND bpi.kind = 'actual'
                  AND bpi.unit IS NOT NULL AND bpi.unit != ''
                ORDER BY bpi.for_date DESC, bpi.id DESC
                LIMIT 1) AS recent_unit
         FROM bazar_items bi
        ${includeInactive ? '' : 'WHERE bi.active = true'}
        ORDER BY bi.category ASC, bi.sort_order ASC, bi.name ASC`
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/bazar-items { category, name, nameBn?, unit, icon?, isFrequent? }
// Creates a new catalog item, sorted to the end of its category.
export async function POST(request) {
  try {
    const body = await request.json();
    const category = (body.category || '').trim();
    const name = (body.name || '').trim();
    const unit = (body.unit || '').trim();
    if (!category) return NextResponse.json({ error: 'category is required' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    if (!unit) return NextResponse.json({ error: 'unit is required' }, { status: 400 });

    const sortRes = await query(
      `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM bazar_items WHERE category = $1`,
      [category]
    );
    const { rows } = await query(
      `INSERT INTO bazar_items (name, name_bn, category, unit, icon, is_frequent, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *, NULL::numeric AS recent_price, NULL AS recent_unit`,
      [name, body.nameBn ? String(body.nameBn).trim() : null, category, unit, body.icon || null, !!body.isFrequent, sortRes.rows[0].next]
    );
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    if (err.code === '23505') return NextResponse.json({ error: 'An item with that name already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/bazar-items { id, isFrequent?, name?, nameBn?, unit?, icon?, category?, active? }
// Any provided field is updated; omitted fields are left as-is.
export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const sets = [];
    const params = [];
    function set(col, val) { params.push(val); sets.push(`${col} = $${params.length}`); }

    if (body.isFrequent !== undefined) set('is_frequent', !!body.isFrequent);
    if (body.active !== undefined) set('active', !!body.active);
    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
      set('name', name);
    }
    if (body.nameBn !== undefined) set('name_bn', String(body.nameBn).trim() || null);
    if (body.unit !== undefined) {
      const unit = String(body.unit).trim();
      if (!unit) return NextResponse.json({ error: 'unit cannot be empty' }, { status: 400 });
      set('unit', unit);
    }
    if (body.category !== undefined) {
      const category = String(body.category).trim();
      if (!category) return NextResponse.json({ error: 'category cannot be empty' }, { status: 400 });
      set('category', category);
    }
    if (body.icon !== undefined) set('icon', String(body.icon).trim() || null);

    if (!sets.length) return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
    params.push(id);
    const { rows } = await query(
      `UPDATE bazar_items SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    return NextResponse.json({ item: rows[0] });
  } catch (err) {
    if (err.code === '23505') return NextResponse.json({ error: 'An item with that name already exists' }, { status: 409 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
