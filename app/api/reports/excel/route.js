import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MONEY_FMT = '#,##0.00';

function monthKey(entryDate) {
  return String(entryDate).slice(0, 7); // YYYY-MM
}

function monthSheetName(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function weekdayName(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

const COLUMNS = [
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Day', key: 'day', width: 8 },
  { header: 'Sales', key: 'sales', width: 12, money: true },
  { header: 'Expense (Bazar)', key: 'expense', width: 15, money: true },
  { header: 'Cash Taken Home', key: 'cashHome', width: 16, money: true },
  { header: "Next Day's Bazar Advance", key: 'nextAdvance', width: 18, money: true },
  { header: 'Bhangti Kept', key: 'bhangti', width: 13, money: true },
  { header: 'Off Day', key: 'offDay', width: 9 },
  { header: 'Notes', key: 'notes', width: 30 },
];

// GET /api/reports/excel?from=YYYY-MM-DD&to=YYYY-MM-DD
// Builds a workbook with one sheet per calendar month covered by the range,
// each a list of daily_entries rows plus a bold totals row. Downloaded
// directly by the browser — no state kept server-side beyond the query.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !to || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: 'from and to (YYYY-MM-DD) are required' }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: '"from" must not be after "to"' }, { status: 400 });
  }

  try {
    // to_char formats entry_date as a plain calendar-date string directly in
    // Postgres — pg would otherwise hand back a JS Date object, which is
    // timezone-sensitive to format correctly on this end (see lib/dates.js).
    const { rows } = await query(
      `SELECT to_char(entry_date, 'YYYY-MM-DD') AS entry_date,
              total_sales, bazar_actual_cost, cash_taken_home,
              next_bazar_advance, next_bhangti, is_off_day, notes
         FROM daily_entries
        WHERE entry_date BETWEEN $1 AND $2
        ORDER BY entry_date ASC`,
      [from, to]
    );

    const byMonth = new Map();
    for (const r of rows) {
      const key = monthKey(r.entry_date);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(r);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Soupresso Cash Register';
    workbook.created = new Date();

    if (byMonth.size === 0) {
      workbook.addWorksheet('No data').addRow(['No entries in this date range.']);
    }

    for (const [key, monthRows] of byMonth) {
      const sheet = workbook.addWorksheet(monthSheetName(key));
      sheet.columns = COLUMNS;
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2E9D8' } };

      const totals = { sales: 0, expense: 0, cashHome: 0, nextAdvance: 0, bhangti: 0 };
      for (const r of monthRows) {
        const dateStr = String(r.entry_date).slice(0, 10);
        sheet.addRow({
          date: dateStr,
          day: weekdayName(dateStr),
          sales: Number(r.total_sales),
          expense: Number(r.bazar_actual_cost),
          cashHome: Number(r.cash_taken_home),
          nextAdvance: Number(r.next_bazar_advance),
          bhangti: Number(r.next_bhangti),
          offDay: r.is_off_day ? 'Yes' : '',
          notes: r.notes || '',
        });
        totals.sales += Number(r.total_sales);
        totals.expense += Number(r.bazar_actual_cost);
        totals.cashHome += Number(r.cash_taken_home);
        totals.nextAdvance += Number(r.next_bazar_advance);
        totals.bhangti += Number(r.next_bhangti);
      }

      const totalsRow = sheet.addRow({
        date: 'Total', sales: totals.sales, expense: totals.expense,
        cashHome: totals.cashHome, nextAdvance: totals.nextAdvance, bhangti: totals.bhangti,
      });
      totalsRow.font = { bold: true };
      totalsRow.border = { top: { style: 'thin' } };

      for (const col of COLUMNS) {
        if (col.money) sheet.getColumn(col.key).numFmt = MONEY_FMT;
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `Soupresso-Sales-Report_${from}_to_${to}.xlsx`;
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
