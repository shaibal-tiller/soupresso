import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { confirmEligibleDays } from '@/lib/cash-in-hand-ledger';

export const dynamic = 'force-dynamic';

// GET /api/cash-in-hand?from=&to= -> ledger rows (optionally range-filtered)
// plus the current settings. Runs the lazy 24h confirm sweep first.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const pool = getPool();
  const client = await pool.connect();
  try {
    await confirmEligibleDays(client);

    const clauses = [];
    const params = [];
    if (from) { params.push(from); clauses.push(`entry_date >= $${params.length}`); }
    if (to) { params.push(to); clauses.push(`entry_date <= $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const { rows } = await client.query(`SELECT * FROM cash_in_hand_ledger ${where} ORDER BY entry_date ASC`, params);
    const settingsRes = await client.query(`SELECT * FROM cash_in_hand_settings WHERE id = 1`);
    // Baki (credit sales) counted in sales but not yet received as cash: the gap
    // between "total sales − total expense" and the cash that actually exists.
    // As of `to` when given (so the entry page can ask "as of yesterday").
    const bakiRes = await client.query(
      `SELECT COALESCE(SUM(baki_given - baki_received), 0)::float AS outstanding FROM daily_entries ${to ? 'WHERE entry_date <= $1' : ''}`,
      to ? [to] : []
    );
    return NextResponse.json({ ledger: rows, settings: settingsRes.rows[0], bakiOutstanding: bakiRes.rows[0].outstanding });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
