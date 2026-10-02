// One-off (2026-10-02): link the freehand ("Other") bazar lines to real catalog items,
// creating the few items that don't exist yet. Money is never touched: each line's
// line_total stays as is and every date's sum of 'actual' totals is asserted identical.
//   node scripts/2026-10-02-link-unlinked-items.js           # dry run
//   node scripts/2026-10-02-link-unlinked-items.js --apply   # one transaction
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: env.match(/^DATABASE_URL="?([^"\n]+)"?/m)[1], ssl: { rejectUnauthorized: false } });
const APPLY = process.argv.includes('--apply');
const r6 = (n) => Math.round((Number(n) + Number.EPSILON) * 1e6) / 1e6;

const NEW_ITEMS = [ // [key, name, category, unit, unit_options, unit_based, icon]
  ['water', 'Water', 'Cooking Essentials', 'pc', ['pc'], true, '💧'],
  ['bun', 'Burger Bun', 'Cooking Essentials', 'pc', ['pc'], true, '🍔'],
  ['mustard', 'Mustard Oil', 'Cooking Essentials', 'pack', ['pack'], true, '🛢️'],
  ['chmasala', 'Chicken Masala', 'Raw Spices', 'pack', ['pack', '100g'], true, '🌶️'],
  ['saucepoly', 'Sauce Poly', 'Serving, Seating & Packaging', 'kg', ['kg', '500g', '250g'], true, '📦'],
  ['misc', 'Miscellaneous', 'Shop', 'job', null, false, null],
];
// [line id, target (existing id or new key), name on the line, unit, quantity]
const LINKS = [
  [740, 'water', 'Water', 'pc', 48],                          // ledger: Water 48 pc
  [741, 143, 'Mixing Bati', 'pc', 1],                         // steel bati = mixing bowl
  [743, 131, 'Naga Achar', 'kg', 1],                          // Nicobina = naga achar
  [841, 131, 'Naga Achar', 'kg', 1],                          // Achar = same
  [744, 153, 'Paper Pack / Thonga - Large', 'pc', 400],       // Parcel Paper Box (Large 400pc)
  [745, 152, 'Paper Pack / Thonga - Small', 'pc', 300],       // Parcel Paper Box (M 300pc)
  [746, 39, 'Soup Parcel Bowl', 'pc', 500],                   // Parcel Plastic Box 500pc
  [747, 'saucepoly', 'Sauce Poly', 'kg', 0.25],               // ledger: 250gm
  [750, 156, 'Poly Bag - Large (Carry)', 'kg', 1.5],          // Hand Poly for Parcel 1.5kg
  [751, 42, 'Foil Paper', 'roll', 1],
  [839, 'mustard', 'Mustard Oil', 'pack', 1],                 // Shorisha
  [843, 'misc', 'Miscellaneous', null, 1],
  [845, 190, 'Sharpener Stone', 'pc', 1],                     // tool, keeps its own name
  [847, 'bun', 'Burger Bun', 'pc', 5],
  [882, 'chmasala', 'Chicken Masala', 'pack', 1],             // Murgi masala (actual)
  [844, 'chmasala', 'Chicken Masala', 'pack', 1],             // Murgi masala (planned)
  [976, 189, 'glass stand rack', null, 1],                    // maintenance, original names kept
  [978, 189, 'electric connection for momo', null, 1],
  [980, 189, 'shop ACDC light', null, 1],
];
(async () => {
  const q = async (s, a) => (await pool.query(s, a)).rows;
  const lines = await q(`SELECT id, for_date::text d, kind, item_id, name, unit, quantity::float q, line_total::float t FROM bazar_plan_items ORDER BY id`);
  const byId = new Map(lines.map((l) => [l.id, l]));
  const before = {}; for (const l of lines) if (l.kind === 'actual') before[l.d] = (before[l.d] || 0) + l.t;
  const plan = [];
  for (const [id, tgt, name, unit, qty] of LINKS) {
    const l = byId.get(id); if (!l) throw new Error('line ' + id + ' not found');
    if (l.item_id) throw new Error('line ' + id + ' is already linked');
    plan.push({ id, date: l.d, kind: l.kind, was: `${l.name} ×${l.q} ৳${l.t}`, tgt, set: { name, unit, quantity: qty, unit_price: r6(l.t / qty) } });
  }
  const thonga = lines.find((l) => l.item_id === 152 && l.d === '2026-08-20');
  const thongaOp = thonga && thonga.unit !== 'pc' ? { id: thonga.id, set: { unit: 'pc', unit_price: r6(thonga.t / thonga.q) } } : null;
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${NEW_ITEMS.length} new catalog items, ${plan.length} lines linked${thongaOp ? ', 1 thonga unit fix (kg -> pc)' : ''}, thonga items -> unit pc`);
  NEW_ITEMS.forEach((n) => console.log('  NEW', n[1], '|', n[2], '|', n[3]));
  plan.forEach((p) => console.log(' ', p.date, p.kind[0], '#' + p.id, p.was, '->', typeof p.tgt === 'number' ? 'item ' + p.tgt : 'NEW ' + p.tgt, JSON.stringify(p.set)));
  if (!APPLY) { await pool.end(); return; }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ids = {};
    let { rows: [{ m }] } = await client.query('SELECT COALESCE(MAX(sort_order),0) m FROM bazar_items'); m = Number(m);
    for (const [key, name, category, unit, opts, based, icon] of NEW_ITEMS) {
      const { rows } = await client.query(`INSERT INTO bazar_items (name, category, unit, unit_options, unit_based, icon, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [name, category, unit, opts ? JSON.stringify(opts) : null, based, icon, ++m + 10]);
      ids[key] = rows[0].id;
    }
    for (const p of plan) {
      const itemId = typeof p.tgt === 'number' ? p.tgt : ids[p.tgt];
      await client.query(`UPDATE bazar_plan_items SET item_id=$1, name=$2, unit=$3, quantity=$4, unit_price=$5 WHERE id=$6`, [itemId, p.set.name, p.set.unit, p.set.quantity, p.set.unit_price, p.id]);
    }
    await client.query(`UPDATE bazar_items SET unit='pc', unit_options=$1 WHERE id IN (152,153)`, [JSON.stringify(['pc', 'kg'])]);
    if (thongaOp) await client.query(`UPDATE bazar_plan_items SET unit='pc', unit_price=$1 WHERE id=$2`, [thongaOp.set.unit_price, thongaOp.id]);
    const after = await client.query(`SELECT for_date::text d, sum(line_total)::float s FROM bazar_plan_items WHERE kind='actual' GROUP BY 1`);
    const drift = after.rows.filter((x) => Math.abs(x.s - before[x.d]) > 0.001);
    if (drift.length) throw new Error('total drift ' + JSON.stringify(drift));
    await client.query('COMMIT');
    console.log('COMMITTED. New item ids:', JSON.stringify(ids), '| all day totals identical');
  } catch (e) { await client.query('ROLLBACK'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; }
  finally { client.release(); await pool.end(); }
})().catch((e) => { console.error(e.message); process.exit(1); });
