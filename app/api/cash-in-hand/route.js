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
    return NextResponse.json({ ledger: rows, settings: settingsRes.rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    client.release();
  }
}
