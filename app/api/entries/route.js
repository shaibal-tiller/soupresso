import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { computeCashSummary } from '@/lib/cash-math';

export const dynamic = 'force-dynamic'; // always hits the live database, never statically cached

// GET /api/entries?date=YYYY-MM-DD  -> single day (plus suggested carry-forward
//                                      defaults from the previous entry, if
//                                      today's entry doesn't exist yet)
// GET /api/entries?from=X&to=Y      -> list of entries in a date range
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  try {
    if (date) {
      const { rows } = await query(
        `SELECT * FROM daily_entries WHERE entry_date = $1`,
        [date]
      );

      if (rows.length) {
        return NextResponse.json({ entry: rows[0], carryForward: null });
      }

      // No entry for this date yet — look up the most recent entry before it
      // so the form can suggest yesterday's next_bhangti / next_bazar_advance
      // as today's opening values.
      const prev = await query(
        `SELECT next_bhangti, next_bazar_advance, entry_date
         FROM daily_entries WHERE entry_date < $1
         ORDER BY entry_date DESC LIMIT 1`,
        [date]
      );
      const carryForward = prev.rows[0]
        ? {
            openingBhangti: Number(prev.rows[0].next_bhangti),
            bazarAdvanceReceived: Number(prev.rows[0].next_bazar_advance),
            fromDate: prev.rows[0].entry_date,
          }
        : null;

      return NextResponse.json({ entry: null, carryForward });
    }

    if (from && to) {
      const { rows } = await query(
        `SELECT * FROM daily_entries WHERE entry_date BETWEEN $1 AND $2 ORDER BY entry_date ASC`,
        [from, to]
      );
      return NextResponse.json({ entries: rows });
    }

    const { rows } = await query(
      `SELECT * FROM daily_entries ORDER BY entry_date DESC LIMIT 60`
    );
    return NextResponse.json({ entries: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/entries  -> create or update (upsert) the entry for a given date
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    entryDate,
    denominations,
    totalCounted,
    openingBhangti,
    bazarAdvanceReceived,
    bazarActualCost,
    nextBazarAdvance,
    nextBhangti,
    notes,
    isOffDay,
  } = body || {};

  if (!entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return NextResponse.json({ error: 'entryDate (YYYY-MM-DD) is required' }, { status: 400 });
  }

  const nums = { totalCounted, openingBhangti, bazarAdvanceReceived, bazarActualCost, nextBazarAdvance, nextBhangti };
  for (const [key, val] of Object.entries(nums)) {
    if (val !== undefined && val !== null && isNaN(Number(val))) {
      return NextResponse.json({ error: `${key} must be a number` }, { status: 400 });
    }
  }

  const summary = computeCashSummary({
    totalCounted: Number(totalCounted) || 0,
    openingBhangti: Number(openingBhangti) || 0,
    bazarAdvanceReceived: Number(bazarAdvanceReceived) || 0,
    bazarActualCost: Number(bazarActualCost) || 0,
    nextBazarAdvance: Number(nextBazarAdvance) || 0,
    nextBhangti: Number(nextBhangti) || 0,
  });

  try {
    // If an entry for this date already exists, snapshot it into the audit log
    // before overwriting — so every edit to a past day is traceable.
    const existing = await query(
      `SELECT * FROM daily_entries WHERE entry_date = $1`, [entryDate]
    );
    if (existing.rows.length) {
      await query(
        `INSERT INTO entry_edit_log (entry_date, previous_data, notes)
         VALUES ($1, $2, $3)`,
        [entryDate, JSON.stringify(existing.rows[0]), `Edited — previous values saved`]
      );
    }

    const { rows } = await query(
      `INSERT INTO daily_entries (
         entry_date, denominations, total_counted, opening_bhangti,
         bazar_advance_received, bazar_actual_cost, next_bazar_advance, next_bhangti,
         total_sales, bazar_variance, cash_taken_home, is_off_day, notes, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, now())
       ON CONFLICT (entry_date) DO UPDATE SET
         denominations = EXCLUDED.denominations,
         total_counted = EXCLUDED.total_counted,
         opening_bhangti = EXCLUDED.opening_bhangti,
         bazar_advance_received = EXCLUDED.bazar_advance_received,
         bazar_actual_cost = EXCLUDED.bazar_actual_cost,
         next_bazar_advance = EXCLUDED.next_bazar_advance,
         next_bhangti = EXCLUDED.next_bhangti,
         total_sales = EXCLUDED.total_sales,
         bazar_variance = EXCLUDED.bazar_variance,
         cash_taken_home = EXCLUDED.cash_taken_home,
         is_off_day = EXCLUDED.is_off_day,
         notes = EXCLUDED.notes,
         updated_at = now()
       RETURNING *`,
      [
        entryDate,
        denominations ? JSON.stringify(denominations) : null,
        Number(totalCounted) || 0,
        Number(openingBhangti) || 0,
        Number(bazarAdvanceReceived) || 0,
        Number(bazarActualCost) || 0,
        Number(nextBazarAdvance) || 0,
        Number(nextBhangti) || 0,
        summary.totalSales,
        summary.bazarVariance,
        summary.cashTakenHome,
        !!isOffDay,
        notes || null,
      ]
    );
    return NextResponse.json({ entry: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
