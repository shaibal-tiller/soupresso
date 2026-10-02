// One-off (2026-10-02): the three "Bazar (lump sum from old record)" lines (Aug 11-13, ৳1,500 each)
// are removed (the daily entries record ৳0 bazar for those days), and "Sujit due" goes under Miscellaneous.
const fs = require('fs'); const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: env.match(/^DATABASE_URL="?([^"\n]+)"?/m)[1], ssl: { rejectUnauthorized: false } });
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const del = await c.query(`DELETE FROM bazar_plan_items WHERE kind='actual' AND item_id IS NULL AND name='Bazar (lump sum from old record)' AND for_date BETWEEN '2026-08-11' AND '2026-08-13' RETURNING id`);
    const misc = await c.query(`SELECT id FROM bazar_items WHERE name='Miscellaneous'`);
    const upd = await c.query(`UPDATE bazar_plan_items SET item_id=$1 WHERE kind='actual' AND item_id IS NULL AND name='Sujit due' RETURNING id`, [misc.rows[0].id]);
    const chk = await c.query(`SELECT e.entry_date::text d, e.bazar_actual_cost::float a, COALESCE(s.t,0)::float b FROM daily_entries e LEFT JOIN (SELECT for_date, sum(line_total) t FROM bazar_plan_items WHERE kind='actual' GROUP BY 1) s ON s.for_date=e.entry_date WHERE abs(e.bazar_actual_cost - COALESCE(s.t,0)) > 0.5`);
    if (del.rowCount !== 3 || upd.rowCount !== 1 || chk.rows.length) throw new Error(`unexpected: deleted ${del.rowCount}, linked ${upd.rowCount}, mismatches ${JSON.stringify(chk.rows)}`);
    await c.query('COMMIT'); console.log('COMMITTED: deleted 3 lump lines, linked Sujit due to Miscellaneous; every day now matches its entry total');
  } catch (e) { await c.query('ROLLBACK'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; } finally { c.release(); await pool.end(); }
})();
