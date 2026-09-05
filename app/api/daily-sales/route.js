import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';

export const dynamic = 'force-dynamic'; // always hits the live database, never statically cached

// GET /api/daily-sales?date=YYYY-MM-DD
// Returns every active menu item with that day's recorded quantity (0 if none yet).
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 });

  try {
    const { rows } = await query(
      `SELECT m.id, m.name, m.price, COALESCE(d.quantity, 0) AS quantity
       FROM menu_items m
       LEFT JOIN daily_product_sales d ON d.item_id = m.id AND d.entry_date = $1
       WHERE m.active = true
       ORDER BY m.sort_order ASC, m.name ASC`,
      [date]
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/daily-sales  { date, quantities: [{itemId, quantity}, ...] }
// Requires a daily_entries row for `date` to already exist (foreign key),
// so save the cash entry for the day first.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { date, quantities } = body || {};
  if (!date || !Array.isArray(quantities)) {
    return NextResponse.json({ error: 'date and quantities[] are required' }, { status: 400 });
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Make sure a daily_entries row exists for this date so the foreign key succeeds.
    const existing = await client.query('SELECT 1 FROM daily_entries WHERE entry_date = $1', [date]);
    if (!existing.rows.length) {
      await client.query(
        `INSERT INTO daily_entries (entry_date) VALUES ($1) ON CONFLICT (entry_date) DO NOTHING`,
        [date]
      );
    }
    for (const { itemId, quantity } of quantities) {
      await client.query(
        `INSERT INTO daily_product_sales (entry_date, item_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (entry_date, item_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [date, itemId, Math.max(0, Number(quantity) || 0)]
      );
    }
    await client.query('COMMIT');
    return NextResponse.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
