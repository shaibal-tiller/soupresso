// One-off (2026-10-02): backfill Sales Tally for Sep 17-28 from the chef's paper notes (dictated by the user).
// Mirrors what the app's routes do (batches -> bowl counts -> leftovers with carry-forward mirroring).
//   node scripts/2026-10-02-backfill-sales-tally.js           # full run inside a transaction, then ROLLBACK (preview)
//   node scripts/2026-10-02-backfill-sales-tally.js --apply   # same, but COMMIT
// Carry rule (user, 2026-10-02): "taken home" < 3 pieces is not brought back, otherwise it is; fried chicken is always brought back.
const fs = require('fs'); const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: env.match(/^DATABASE_URL="?([^"\n]+)"?/m)[1], ssl: { rejectUnauthorized: false } });
const APPLY = process.argv.includes('--apply');
const ID = { won: 3, roll: 75, taq: 4, fry: 74, nacho: 6, meat: 5, soup: 1, parcel: 73 };
const PRICE = { won: 10, roll: 10, taq: 15, fry: 70, nacho: 100, meat: 80, soup: 60, parcel: 70 };
const alwaysCarry = new Set(['fry']);
const DAYS = {
  '2026-09-17': { b: { won: [55], taq: [25], fry: [10] }, lo: {}, bowl: { meat: 8, soup: 7, parcel: 21 } },
  '2026-09-20': { b: { won: [67], roll: [25], taq: [25], fry: [5] }, lo: {}, bowl: { meat: 12, soup: 15, parcel: 14 } },
  '2026-09-21': { b: { won: [55], roll: [57], taq: [30], fry: [9] }, lo: { won: 8, roll: 12, taq: 1, fry: 3 }, bowl: { nacho: 2, meat: 8, soup: 18, parcel: 5 } },
  '2026-09-23': { b: { won: [35, 25, 10, 7], roll: [40], taq: [28], fry: [8] }, lo: { fry: 2 }, bowl: { meat: 12, soup: 12, parcel: 15 } },
  '2026-09-24': { b: { won: [65], roll: [35], taq: [25], fry: [10] }, lo: { won: 1, taq: 10 }, bowl: { nacho: 2, meat: 6, soup: 21, parcel: 17 } },
  '2026-09-25': { b: { won: [40, 25, 25, 10], roll: [45], taq: [30], fry: [12] }, lo: { roll: 16, taq: 13, fry: 3 }, bowl: { meat: 11, soup: 11, parcel: 22 } },
  '2026-09-26': { b: { won: [64], roll: [24, 24, 10], taq: [11], fry: [10] }, lo: {}, bowl: { meat: 6, soup: 9, parcel: 7 } },
  '2026-09-27': { b: { won: [40, 15, 15], roll: [25], taq: [24], fry: [9] }, lo: { won: 5, roll: 2, taq: 7 }, bowl: { meat: 14, soup: 10, parcel: 15 } },
  '2026-09-28': { b: { won: [50], roll: [25], taq: [25], fry: [9] }, lo: { roll: 4, taq: 5, fry: 3 }, bowl: { meat: 10, soup: 18, parcel: 15 } },
};
const shift = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
(async () => {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const dates = Object.keys(DAYS).sort();
    for (const d of dates) {
      const x = DAYS[d];
      await c.query(`DELETE FROM production_entries WHERE entry_date=$1 AND carried_over=false`, [d]);
      await c.query(`DELETE FROM production_entries WHERE carried_from=$1`, [d]);
      await c.query(`DELETE FROM production_leftovers WHERE entry_date=$1`, [d]);
      await c.query(`DELETE FROM bowl_counts WHERE entry_date=$1`, [d]);
      for (const [it, list] of Object.entries(x.b)) for (const q of list)
        await c.query(`INSERT INTO production_entries (entry_date, item_id, quantity) VALUES ($1,$2,$3)`, [d, ID[it], q]);
      for (const [it, q] of Object.entries(x.bowl))
        await c.query(`INSERT INTO bowl_counts (entry_date, item_id, single_count, double_count) VALUES ($1,$2,$3,0)`, [d, ID[it], q]);
      for (const [it, q] of Object.entries(x.lo)) {
        const made = Number((await c.query(`SELECT COALESCE(SUM(quantity),0) m FROM production_entries WHERE item_id=$1 AND entry_date=$2`, [ID[it], d])).rows[0].m);
        if (q > made) throw new Error(`${d} ${it}: leftover ${q} exceeds available ${made}`);
        const carried = alwaysCarry.has(it) || q >= 3;
        await c.query(`INSERT INTO production_leftovers (entry_date, item_id, leftover_qty, carried_forward) VALUES ($1,$2,$3,$4)`, [d, ID[it], q, carried]);
        if (carried) await c.query(`INSERT INTO production_entries (entry_date, item_id, quantity, carried_over, carried_from) VALUES ($1,$2,$3,true,$4)`, [shift(d, 1), ID[it], q, d]);
      }
    }
    // Sep 22 (not re-entered): its Meat Box / Nachos "batches" are orphans (bowl items); convert to bowl counts.
    const orph = await c.query(`SELECT entry_date::text d, item_id, SUM(quantity)::int q FROM production_entries WHERE item_id IN (5,6) AND entry_date::text <> ALL($1) GROUP BY 1,2`, [dates]);
    for (const o of orph.rows) {
      await c.query(`INSERT INTO bowl_counts (entry_date, item_id, single_count, double_count) VALUES ($1,$2,$3,0) ON CONFLICT (entry_date,item_id) DO NOTHING`, [o.d, o.item_id, o.q]);
      await c.query(`DELETE FROM production_entries WHERE item_id=$1 AND entry_date=$2`, [o.item_id, o.d]);
      console.log(`  converted orphan batch -> bowl count: ${o.d} item ${o.item_id} x${o.q}`);
    }
    // Report: computed vs actual for every day Sep 17-30
    const menu = (await c.query(`SELECT id, price::float p, tracking_mode m FROM menu_items`)).rows;
    console.log('date        computed   actual   variance');
    for (let i = 17; i <= 30; i++) {
      const d = `2026-09-${i}`; let total = 0;
      for (const m of menu) {
        let sold = 0;
        if (m.m === 'production') {
          const made = Number((await c.query(`SELECT COALESCE(SUM(quantity),0) s FROM production_entries WHERE item_id=$1 AND entry_date=$2`, [m.id, d])).rows[0].s);
          const lo = Number((await c.query(`SELECT COALESCE(SUM(leftover_qty),0) s FROM production_leftovers WHERE item_id=$1 AND entry_date=$2`, [m.id, d])).rows[0].s);
          sold = Math.max(0, made - lo);
        } else {
          const r = (await c.query(`SELECT single_count s, double_count dd FROM bowl_counts WHERE item_id=$1 AND entry_date=$2`, [m.id, d])).rows[0];
          sold = r ? r.s + (m.m === 'bowl_double' ? 2 * r.dd : 0) : 0;
        }
        total += sold * m.p;
      }
      const act = (await c.query(`SELECT total_sales::float s FROM daily_entries WHERE entry_date=$1`, [d])).rows[0]?.s;
      console.log(`${d}  ${String(total).padStart(7)}  ${String(act ?? '-').padStart(7)}  ${act == null ? '' : (total - act > 0 ? '+' : '') + (total - act)}${DAYS[d] ? '' : '   (not provided / untouched)'}`);
    }
    if (APPLY) { await c.query('COMMIT'); console.log('COMMITTED'); } else { await c.query('ROLLBACK'); console.log('DRY RUN complete — rolled back, nothing saved'); }
  } catch (e) { await c.query('ROLLBACK'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; } finally { c.release(); await pool.end(); }
})();
