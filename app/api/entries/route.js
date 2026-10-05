import { NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import { computeCashSummary } from '@/lib/cash-math';
import { coerceLocaleNumber } from '@/lib/numerals';
import { todayStrTZ, isEntryEditable, ENTRY_EDIT_WINDOW_DAYS } from '@/lib/dates';
import { upsertLedgerForEntry } from '@/lib/cash-in-hand-ledger';
import { accountsEnabledFor } from '@/lib/accounts';

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
        // How much of this day's sales went into payment accounts (bKash, bank…); empty before those exist.
        let accountSales = [];
        try {
          const a = await query(`SELECT account_id, amount::float AS amount FROM account_sales WHERE entry_date = $1`, [date]);
          accountSales = a.rows.map((r) => ({ accountId: r.account_id, amount: r.amount }));
        } catch (e) { if (e.code !== '42P01') throw e; }
        return NextResponse.json({ entry: rows[0], carryForward: null, accountSales });
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
    bazarTakenFromBox,
    nextBazarAdvance,
    nextBhangti,
    nextBhangtiDenominations,
    notes,
    isOffDay,
    closedBy,
    accountSales,
  } = body || {};

  if (!entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return NextResponse.json({ error: 'entryDate (YYYY-MM-DD) is required' }, { status: 400 });
  }

  if (!isEntryEditable(entryDate, todayStrTZ())) {
    return NextResponse.json(
      { error: `Entries older than ${ENTRY_EDIT_WINDOW_DAYS} days are locked. Older corrections are made directly in the database.` },
      { status: 403 }
    );
  }

  const closedByArr = Array.isArray(closedBy) ? closedBy.filter((n) => typeof n === 'string') : [];

  const nums = { totalCounted, openingBhangti, bazarAdvanceReceived, bazarActualCost, bazarTakenFromBox, nextBazarAdvance, nextBhangti };
  for (const [key, val] of Object.entries(nums)) {
    if (coerceLocaleNumber(val) == null && val !== '' && val != null) {
      return NextResponse.json({ error: `${key} must be a number` }, { status: 400 });
    }
  }

  // Sales that went into payment accounts instead of the cash box (from 2026-10-06). They count as sales
  // but never touch the box, so cash taken home is unaffected.
  const merged = new Map();
  if (!isOffDay && Array.isArray(accountSales)) {
    for (const r of accountSales) {
      const accountId = Number(r?.accountId);
      const amt = coerceLocaleNumber(r?.amount) ?? 0;
      if (!accountId) continue;
      if (!Number.isFinite(amt) || amt < 0) return NextResponse.json({ error: 'account sales must be zero or more' }, { status: 400 });
      if (amt === 0) continue;
      merged.set(accountId, Math.round(((merged.get(accountId) || 0) + amt) * 100) / 100);
    }
  }
  const digitalRows = [...merged].map(([accountId, amount]) => ({ accountId, amount }));
  if (digitalRows.length && !accountsEnabledFor(entryDate)) {
    return NextResponse.json({ error: 'Sales into accounts can only be entered from 2026-10-06 on.' }, { status: 400 });
  }
  const digitalTotal = Math.round(digitalRows.reduce((n, r) => n + r.amount, 0) * 100) / 100;

  const summary = computeCashSummary({
    totalCounted: coerceLocaleNumber(totalCounted) ?? 0,
    openingBhangti: coerceLocaleNumber(openingBhangti) ?? 0,
    bazarAdvanceReceived: coerceLocaleNumber(bazarAdvanceReceived) ?? 0,
    bazarActualCost: coerceLocaleNumber(bazarActualCost) ?? 0,
    bazarTakenFromBox: coerceLocaleNumber(bazarTakenFromBox) ?? 0,
    nextBazarAdvance: coerceLocaleNumber(nextBazarAdvance) ?? 0,
    nextBhangti: coerceLocaleNumber(nextBhangti) ?? 0,
  });

  try {
    if (digitalRows.length) {
      const ids = digitalRows.map((r) => r.accountId);
      const { rows: accs } = await query(`SELECT id, name, active, to_char(starting_date, 'YYYY-MM-DD') AS starting_date FROM payment_accounts WHERE id = ANY($1)`, [ids]);
      const { rows: had } = await query(`SELECT account_id FROM account_sales WHERE entry_date = $1`, [entryDate]);
      const hadSet = new Set(had.map((r) => r.account_id));
      for (const r of digitalRows) {
        const a = accs.find((x) => x.id === r.accountId);
        if (!a) return NextResponse.json({ error: 'Unknown account' }, { status: 400 });
        if (!a.active && !hadSet.has(a.id)) return NextResponse.json({ error: `${a.name} is deactivated` }, { status: 400 });
        if (entryDate < a.starting_date) return NextResponse.json({ error: `${a.name} starts on ${a.starting_date}` }, { status: 400 });
      }
    }

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

    // The entry and its account sales are saved together or not at all.
    const dbClient = await getPool().connect();
    let rows;
    try {
      await dbClient.query('BEGIN');
      const saved = await dbClient.query(
      `INSERT INTO daily_entries (
         entry_date, denominations, total_counted, opening_bhangti,
         bazar_advance_received, bazar_actual_cost, bazar_taken_from_box, next_bazar_advance, next_bhangti,
         next_bhangti_denominations, digital_sales,
         total_sales, bazar_variance, cash_taken_home, is_off_day, notes, closed_by, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17, now())
       ON CONFLICT (entry_date) DO UPDATE SET
         denominations = EXCLUDED.denominations,
         total_counted = EXCLUDED.total_counted,
         opening_bhangti = EXCLUDED.opening_bhangti,
         bazar_advance_received = EXCLUDED.bazar_advance_received,
         bazar_actual_cost = EXCLUDED.bazar_actual_cost,
         bazar_taken_from_box = EXCLUDED.bazar_taken_from_box,
         next_bazar_advance = EXCLUDED.next_bazar_advance,
         next_bhangti = EXCLUDED.next_bhangti,
         next_bhangti_denominations = EXCLUDED.next_bhangti_denominations,
         baki_given = 0,      -- credit-sale tracking was removed 2026-10-04; a re-saved day no longer carries it
         baki_received = 0,
         digital_sales = EXCLUDED.digital_sales,
         total_sales = EXCLUDED.total_sales,
         bazar_variance = EXCLUDED.bazar_variance,
         cash_taken_home = EXCLUDED.cash_taken_home,
         is_off_day = EXCLUDED.is_off_day,
         notes = EXCLUDED.notes,
         closed_by = EXCLUDED.closed_by,
         updated_at = now()
       RETURNING *`,
      [
        entryDate,
        denominations ? JSON.stringify(denominations) : null,
        coerceLocaleNumber(totalCounted) ?? 0,
        coerceLocaleNumber(openingBhangti) ?? 0,
        coerceLocaleNumber(bazarAdvanceReceived) ?? 0,
        coerceLocaleNumber(bazarActualCost) ?? 0,
        coerceLocaleNumber(bazarTakenFromBox) ?? 0,
        coerceLocaleNumber(nextBazarAdvance) ?? 0,
        coerceLocaleNumber(nextBhangti) ?? 0,
        nextBhangtiDenominations ? JSON.stringify(nextBhangtiDenominations) : null,
        digitalTotal,
        Math.round((summary.totalSales + digitalTotal) * 100) / 100,
        summary.bazarVariance,
        summary.cashTakenHome,
        !!isOffDay,
        notes || null,
        closedByArr,
      ]
      );
      rows = saved.rows;
      await dbClient.query(`DELETE FROM account_sales WHERE entry_date = $1`, [entryDate]);
      for (const r of digitalRows) {
        await dbClient.query(`INSERT INTO account_sales (entry_date, account_id, amount) VALUES ($1, $2, $3)`, [entryDate, r.accountId, r.amount]);
      }
      await dbClient.query('COMMIT');
    } catch (saveErr) {
      await dbClient.query('ROLLBACK').catch(() => {});
      throw saveErr;
    } finally {
      dbClient.release();
    }

    // Best-effort: advance the cash-in-hand ledger for this day (no-op if
    // tracking isn't active yet, or this day is already confirmed/frozen).
    // Never blocks the entry save itself on a ledger hiccup.
    try {
      await upsertLedgerForEntry({ query }, entryDate, summary.cashTakenHome);
    } catch (ledgerErr) {
      console.error('cash-in-hand ledger update failed:', ledgerErr.message);
    }

    return NextResponse.json({ entry: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
