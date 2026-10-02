// One-off (2026-10-03): line items with stray paise (e.g. ৳579.99, ৳215.04) are rounding leftovers from
// unit-price rounding. Round them to whole taka and re-derive unit_price; assert every day then equals its entry total.
const fs = require('fs'); const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: env.match(/^DATABASE_URL="?([^"\n]+)"?/m)[1], ssl: { rejectUnauthorized: false } });
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query(`UPDATE bazar_plan_items SET line_total = ROUND(line_total), unit_price = ROUND(line_total) / quantity WHERE line_total <> ROUND(line_total) AND quantity > 0 RETURNING id, for_date::text d, kind, name, line_total::float t`);
    r.rows.forEach((x) => console.log(' ', x.d, x.kind[0], x.name, '->', x.t));
    const bad = await c.query(`SELECT e.entry_date::text d, e.bazar_actual_cost::float a, s.t::float b FROM daily_entries e JOIN (SELECT for_date, sum(line_total) t FROM bazar_plan_items WHERE kind='actual' GROUP BY 1) s ON s.for_date = e.entry_date WHERE e.bazar_actual_cost <> s.t AND e.entry_date >= '2026-08-14'`);
    if (bad.rows.length) throw new Error('mismatch ' + JSON.stringify(bad.rows));
    await c.query('COMMIT'); console.log(`COMMITTED: ${r.rowCount} lines rounded; every day from Aug 14 equals its entry total`);
  } catch (e) { await c.query('ROLLBACK'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; } finally { c.release(); await pool.end(); }
})();
