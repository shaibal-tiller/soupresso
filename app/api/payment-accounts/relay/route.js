import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { todayStrTZ } from '@/lib/dates';

export const dynamic = 'force-dynamic';

// GET ?date=YYYY-MM-DD (default today, Dhaka) -> the bKash payments the relay received that day, for the daily entry.
export async function GET(request) {
  const date = new URL(request.url).searchParams.get('date');
  const day = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : todayStrTZ();
  try {
    const { rows } = await getPool().query(
      `SELECT id, CASE WHEN time_known THEN to_char(occurred_at AT TIME ZONE 'Asia/Dhaka', 'HH12:MI AM') END AS time,
              amount::float AS amount, sender, sender_operator AS operator, trx_id AS "trxId", source
         FROM bkash_transactions
        WHERE (occurred_at AT TIME ZONE 'Asia/Dhaka')::date = $1::date
        ORDER BY occurred_at`, [day]);
    const total = Math.round(rows.reduce((n, r) => n + r.amount, 0) * 100) / 100;
    return NextResponse.json({ date: day, payments: rows, total });
  } catch (err) {
    if (err.code === '42P01') return NextResponse.json({ date: day, payments: [], total: 0 });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
