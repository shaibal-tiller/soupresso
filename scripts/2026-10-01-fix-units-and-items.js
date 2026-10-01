// One-off data cleanup (2026-10-01): normalise Egg/Lemon/Mushroom units, merge
// Chef Breakfast -> Nasta Bill, Lunch/Dinner -> Food Bill, Breast -> Boneless,
// and split the old "Chicken - Whole/Mixed" lines on Sep 1/4/10/13/17.
//
//   node scripts/2026-10-01-fix-units-and-items.js            # DRY RUN: prints the plan, writes plan.json only
//   node scripts/2026-10-01-fix-units-and-items.js --apply    # backs up, then applies in ONE transaction
//
// Money never changes: every date's sum of 'actual' line totals is asserted
// identical before/after, and daily_entries is never touched.
const fs = require('fs');
const path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const url = env.match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];
const { Pool } = require('pg');
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const APPLY = process.argv.includes('--apply');
const OUT = process.env.OUT_DIR || __dirname;
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const r6 = (n) => Math.round((Number(n) + Number.EPSILON) * 1e6) / 1e6;

// ---- judgement calls (all listed to the user for confirmation) ----
const EGG_OVERRIDE = { '2026-09-12': 12, '2026-09-13': 12, '2026-09-14': 16, '2026-09-18': 12, '2026-09-26': 16 };
const LEMON_OVERRIDE = { '2026-09-12': 8, '2026-09-13': 4, '2026-09-18': 12, '2026-09-20': 12, '2026-09-27': 32, '2026-09-29': 12 };
const MUSHROOM_OVERRIDE = { '2026-09-13': 2.84 }; // kg (ledger: 2.84 kg)
// date -> list of [item_id, name, qty, price-or-null(remainder)]; first row reuses the original line.
const BONELESS_PRICE = 380; // boneless Rs/kg (Sep 17, 23, 27); drumstick/wings get the remainder so the total never changes
const CHICKEN_SPLIT = {
  '2026-09-01': { total: 2350, parts: [[82, 'Chicken - Boneless', 5, BONELESS_PRICE], [84, 'Chicken - Wings', 1, null]] },
  '2026-09-04': { total: 1570, parts: [[82, 'Chicken - Boneless', 2, BONELESS_PRICE], [83, 'Chicken - Drumstick', 3, null]] },
  '2026-09-10': { total: 2160, parts: [[82, 'Chicken - Boneless', 3, BONELESS_PRICE], [83, 'Chicken - Drumstick', 5, null]] },
  '2026-09-13': { total: 2590, parts: [[82, 'Chicken - Boneless', 3, BONELESS_PRICE], [83, 'Chicken - Drumstick', 5, null]] },
  '2026-09-17': { total: 2740, parts: [[82, 'Chicken - Boneless', 5, BONELESS_PRICE], [83, 'Chicken - Drumstick', 3, null]] },
};
const HERBS = new Set([8, 48, 49, 104, 106]); // Green Chili, Coriander Leaves, Thai Leaves, Mint Leaf, Thai Ginger — bought per 250g / 500g
const HERB_NAME = { 8: 'Green Chili', 48: 'Parsley', 49: 'Thai Leaves', 104: 'Mint Leaf', 106: 'Thai Ginger' };
const HERB_QTY_OVERRIDE = { '2026-09-18:49': 1 };       // "250" typed as quantity of 250g
const HERB_KG_IS_250G = new Set(['2026-09-12:8', '2026-09-13:8']); // ledger: Green Chili 250gm
const FOOD_DAYS_FIX = { '2026-09-13': 7, '2026-09-19': 7 }; // Lunch lines that were "1 day = 1050" but are 7 days x 150

(async () => {
  const q = async (s, a) => (await pool.query(s, a)).rows;
  const lines = await q(`SELECT id, for_date::text d, item_id, name, unit, quantity::float q, unit_price::float up, line_total::float t
                         FROM bazar_plan_items WHERE kind='actual' ORDER BY for_date, id`);
  const before = {}; for (const l of lines) before[l.d] = r2((before[l.d] || 0) + l.t);
  const ops = []; const notes = []; const touched = new Map();
  const lineUpd = (l, set, why, check) => { ops.push({ check: !!check || /split old|override\)|Auto Fare 70|Nasta 120/.test(why), type: 'line', id: l.id, date: l.d, was: { item_id: l.item_id, name: l.name, unit: l.unit, q: l.q, up: l.up, t: l.t }, set, why }); };
  const lineIns = (date, row, why) => ops.push({ check: /split of old|Auto Fare 70/.test(why), type: 'insert', date, row, why });
  const after = JSON.parse(JSON.stringify(before)); // recomputed below from ops

  for (const l of lines) {
    const chk = CHICKEN_SPLIT[l.d];
    if (chk && (l.item_id === 1)) {
      const rows = []; let used = 0;
      chk.parts.forEach(([iid, nm, qty, pr], i) => {
        const isLast = i === chk.parts.length - 1;
        const total = (pr == null || isLast) && pr == null ? r2(chk.total - used) : r2(qty * pr);
        used = r2(used + total); rows.push({ item_id: iid, name: nm, unit: 'kg', quantity: qty, unit_price: r6(total / qty), line_total: total });
      });
      if (r2(used) !== r2(chk.total)) throw new Error('chicken split mismatch ' + l.d);
      lineUpd(l, rows[0], `split old "${l.name}" ${l.q}kg ৳${l.t}`);
      rows.slice(1).forEach((rw) => lineIns(l.d, rw, `split of old "${l.name}" line`));
      continue;
    }
    if (l.item_id === 81) { lineUpd(l, { item_id: 82, name: 'Chicken - Boneless' }, 'Breast = Boneless'); continue; }
    if (l.item_id === 2 || l.item_id === 14) {
      const eggs = l.item_id === 2; const ov = (eggs ? EGG_OVERRIDE : LEMON_OVERRIDE)[l.d];
      const f = { dozen: 12, hali: 4, pc: 1 }[l.unit];
      if (f == null && ov == null) { notes.push(`UNHANDLED unit ${l.unit} item ${l.item_id} ${l.d}`); continue; }
      const nq = ov != null ? ov : l.q * f;
      if (l.unit !== 'pc' || nq !== l.q) lineUpd(l, { unit: 'pc', quantity: nq, unit_price: r6(l.t / nq) }, `${l.q} ${l.unit}${ov != null ? ' (override)' : ''} -> ${nq} pc`);
      continue;
    }
    if (l.item_id === 3) {
      const ov = MUSHROOM_OVERRIDE[l.d]; const nq = ov != null ? ov : (l.unit === 'gm' ? l.q / 1000 : l.q);
      if (l.unit !== 'kg' || nq !== l.q || l.name !== 'Mushroom') lineUpd(l, { name: 'Mushroom', unit: 'kg', quantity: nq, unit_price: r6(l.t / nq) }, `${l.q} ${l.unit}${ov != null ? ' (ledger)' : ''} -> ${nq} kg`);
      continue;
    }
    if (HERBS.has(l.item_id)) {
      const set = { unit: '250g' }; let qty = l.q; let why = null;
      if (HERB_QTY_OVERRIDE[l.d + ':' + l.item_id] != null) { qty = HERB_QTY_OVERRIDE[l.d + ':' + l.item_id]; why = `${l.q} ${l.unit || '(blank)'} -> ${qty} x 250g (typed grams / wrong unit)`; }
      else if (l.unit === '100g') why = '100g is a wrong label for this item; counted as 250g';
      else if (l.unit === '500g') { qty = l.q * 2; why = `${l.q} x 500g -> ${qty} x 250g`; }
      else if (l.unit === 'kg' && HERB_KG_IS_250G.has(l.d + ':' + l.item_id)) why = 'kg typed but ledger says 250gm; counted as 250g';
      else if (l.unit === 'kg') { qty = l.q * 4; why = `${l.q} kg -> ${qty} x 250g`; }
      else if (!l.unit) why = 'blank unit -> 250g';
      const nm = HERB_NAME[l.item_id];
      if (qty !== l.q) set.quantity = qty;
      if (l.unit !== '250g' || qty !== l.q || l.name !== nm) { set.name = nm; set.unit_price = r6(l.t / qty); lineUpd(l, set, why || 'rename snapshot'); }
      continue;
    }
    if (l.item_id === 783) { lineUpd(l, { item_id: 87, name: 'Sausage', unit: 'packet' }, 'Chicken Sausage = Sausage (8 packets per ledger)'); continue; }
    if (l.item_id === 43) {
      const q2 = l.d === '2026-09-02' ? 2 : l.q;
      lineUpd(l, { item_id: 54, name: 'Tissue Box', unit: 'pc', quantity: q2, unit_price: r6(l.t / q2) }, l.d === '2026-09-02' ? 'Napkin/Tissue -> Tissue Box, 2 boxes (ledger)' : 'Napkin/Tissue -> Tissue Box'); continue;
    }
    if (l.item_id === 54) { const q2 = l.d === '2026-09-13' ? 12 : l.q; lineUpd(l, { name: 'Tissue Box', unit: 'pc', quantity: q2, unit_price: r6(l.t / q2) }, l.d === '2026-09-13' ? 'Tissue 12 boxes (ledger)' : 'rename snapshot'); continue; }
    if (l.item_id === 126 && !l.unit) { lineUpd(l, { unit: 'kg' }, 'Barley blank unit -> kg (ledger: 1kg)'); continue; }
    if (l.item_id === 50 && l.d === '2026-09-13') { lineUpd(l, { quantity: 0.9, unit_price: r6(l.t / 0.9) }, 'Corn Flour 900 gm (ledger) = 0.9 kg'); continue; }
    if (l.item_id === 46) { lineUpd(l, { item_id: 58, name: 'Nasta Bill' }, 'Chef Breakfast -> Nasta'); continue; }
    if (l.item_id === 60) { lineUpd(l, { item_id: 59, name: 'Food Bill' }, 'Dinner -> Food Bill'); continue; }
    if (l.item_id === 59) {
      const set = { name: 'Food Bill' };
      if (FOOD_DAYS_FIX[l.d]) Object.assign(set, { unit: 'day', quantity: FOOD_DAYS_FIX[l.d], unit_price: r6(l.t / FOOD_DAYS_FIX[l.d]) });
      lineUpd(l, set, FOOD_DAYS_FIX[l.d] ? `Lunch -> Food Bill, ${FOOD_DAYS_FIX[l.d]} days` : 'Lunch -> Food Bill'); continue;
    }
    if (l.item_id === 58) {
      if (l.d === '2026-09-17' && l.t === 120) {
        lineUpd(l, { name: 'Nasta Bill', quantity: 1, unit_price: 50, line_total: 50 }, 'Nasta 120 = Nasta 50 + Auto Fare 70 (ledger)');
        lineIns(l.d, { item_id: 45, name: 'Auto Fare', unit: 'trip', quantity: 1, unit_price: 70, line_total: 70 }, 'Auto Fare 70 that was typed into the Nasta line');
      } else if (l.name !== 'Nasta Bill') lineUpd(l, { name: 'Nasta Bill' }, 'rename snapshot');
    }
  }
  // heal pass: any remaining line whose qty x unit_price (2dp) no longer reproduces its total would
  // silently change money the next time its day is re-saved (the API recomputes total = qty x price).
  const pendingUp = new Map(ops.filter((o) => o.type === 'line').map((o) => [o.id, o.set]));
  for (const l of lines) {
    const st = pendingUp.get(l.id) || {};
    const qty = st.quantity ?? l.q; const up = st.unit_price ?? l.up; const tot = st.line_total ?? l.t;
    if (qty > 0 && r2(qty * up) !== r2(tot)) {
      if (pendingUp.has(l.id)) pendingUp.get(l.id).unit_price = r6(tot / qty);
      else lineUpd(l, { unit_price: r6(tot / qty) }, `heal: ${qty} x ${up} = ${r2(qty * up)} but total is ${tot}`);
    }
  }
  // recompute per-date sums and assert money unchanged
  const byId = new Map(lines.map((l) => [l.id, l]));
  const sums = {}; const add = (d, v) => { sums[d] = r2((sums[d] || 0) + v); };
  const upd = new Map(ops.filter((o) => o.type === 'line').map((o) => [o.id, o.set]));
  for (const l of lines) add(l.d, upd.get(l.id)?.line_total ?? l.t);
  for (const o of ops) if (o.type === 'insert') add(o.date, o.row.line_total);
  const bad = Object.keys(before).filter((d) => r2(before[d]) !== r2(sums[d]));
  if (bad.length) throw new Error('DAY TOTAL CHANGED on ' + bad.join(','));
  const catOps = [
    { id: 2, set: { unit: 'pc', unit_options: ['pc', 'hali', 'dozen', 'case30'] } },
    { id: 14, set: { unit: 'pc', unit_options: ['pc', 'hali', 'dozen'] } },
    { id: 3, set: { unit: 'kg', unit_options: ['kg', 'gm'] } },
    { id: 8, set: { unit: '250g', unit_options: ['250g', '500g', 'kg'] } },
    { id: 48, set: { name: 'Parsley', unit: '250g', unit_options: ['250g', '500g'] } },
    { id: 49, set: { unit: '250g', unit_options: ['250g', '500g'] } },
    { id: 104, set: { unit: '250g', unit_options: ['250g', '500g'] } },
    { id: 106, set: { unit: '250g', unit_options: ['250g', '500g'] } },
    { id: 126, set: { unit: 'kg', unit_options: ['kg', '500g', '250g', '100g'] } },
    { id: 58, set: { name: 'Nasta Bill' } }, { id: 59, set: { name: 'Food Bill' } },
    { id: 46, set: { active: false } }, { id: 60, set: { active: false } }, { id: 81, set: { active: false } },
    { id: 783, set: { active: false } }, { id: 43, set: { active: false } },
  ];
  const recOps = [{ id: 1, set: { unit: 'pc', quantity: 12, total_price: 150 } }];
  fs.writeFileSync(path.join(OUT, 'plan.json'), JSON.stringify({ ops, catOps, recOps, notes, daysChecked: Object.keys(before).length }, null, 2));
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${ops.filter((o) => o.type === 'line').length} line updates, ${ops.filter((o) => o.type === 'insert').length} inserts, ${catOps.length} catalog edits, ${recOps.length} recurring edit. Per-day totals unchanged on all ${Object.keys(before).length} days.`);
  for (const o of ops) console.log(' ', o.date, o.type === 'insert' ? 'INSERT' : '#' + o.id, o.why, o.type === 'insert' ? JSON.stringify(o.row) : JSON.stringify(o.set));
  notes.forEach((n) => console.log(' NOTE', n));
  if (!APPLY) { await pool.end(); return; }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE bazar_plan_items ALTER COLUMN unit_price TYPE NUMERIC(14,6)');
    await client.query('ALTER TABLE bazar_plan_items ALTER COLUMN quantity TYPE NUMERIC(12,4)');
    for (const o of ops) {
      if (o.type === 'line') {
        const cols = Object.keys(o.set); const vals = Object.values(o.set);
        await client.query(`UPDATE bazar_plan_items SET ${cols.map((c, i) => `${c === 'q' ? 'quantity' : c}=$${i + 1}`).join(',')} WHERE id=$${cols.length + 1}`, [...vals, o.id]);
      } else {
        const r = o.row;
        await client.query(`INSERT INTO bazar_plan_items (for_date, kind, item_id, name, unit, quantity, unit_price, line_total) VALUES ($1,'actual',$2,$3,$4,$5,$6,$7)`,
          [o.date, r.item_id, r.name, r.unit, r.quantity, r.unit_price, r.line_total]);
      }
    }
    for (const c of catOps) {
      const cols = Object.keys(c.set);
      await client.query(`UPDATE bazar_items SET ${cols.map((k, i) => `${k}=$${i + 1}`).join(',')} WHERE id=$${cols.length + 1}`, [...cols.map((k) => (k === 'unit_options' ? JSON.stringify(c.set[k]) : c.set[k])), c.id]);
    }
    for (const c of recOps) {
      const cols = Object.keys(c.set);
      await client.query(`UPDATE bazar_recurring_items SET ${cols.map((k, i) => `${k}=$${i + 1}`).join(',')} WHERE id=$${cols.length + 1}`, [...cols.map((k) => c.set[k]), c.id]);
    }
    const chk = await client.query(`SELECT for_date::text d, sum(line_total)::float s FROM bazar_plan_items WHERE kind='actual' GROUP BY 1`);
    const drift = chk.rows.filter((x) => r2(x.s) !== r2(before[x.d]));
    if (drift.length) throw new Error('post-check drift ' + JSON.stringify(drift));
    await client.query('COMMIT');
    console.log('COMMITTED. Post-check: all day totals identical.');
  } catch (e) { await client.query('ROLLBACK'); console.error('ROLLED BACK:', e.message); process.exitCode = 1; }
  finally { client.release(); await pool.end(); }
})().catch((e) => { console.error(e.message); process.exit(1); });
