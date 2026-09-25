// One-off cleanup: links historical free-text bazar_plan_items rows to the
// catalog item they actually match (normalizing the name too, where it was
// misspelled), per docs/superpowers/specs/2026-09-25-bazar-category-reorg-design.md.
// Only touches rows that are still item_id IS NULL and match one of the
// mapped names below — safe to re-run (a row already linked won't match).
//
// Run without args for a DRY RUN. Run with --apply to write, in one transaction.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

// freeTextNameLower -> canonical catalog item name to link + rename to
const MAPPING = {
  'barley': 'Barley',
  'cabbage': 'Cabbage',
  'cash box': 'Cash Box',
  'coriander powder': 'Coriander Powder',
  'kabab masala': 'Kabab Masala',
  'onthon sheet': 'Wonton Sheet',
  'wonton sheet': 'Wonton Sheet',
  'wheel powder': 'Wheel Powder',
  'wheel powder & majoni': 'Wheel Powder',
  'chilli powder': 'Chili Powder',
  'chef nasta': 'Nasta (Snack)',
  'chef auto bhara': 'Auto Fare',
  'burner fix': 'Repair & Maintenance Work',
  'light': 'Repair & Maintenance Work',
  'stove repair': 'Repair & Maintenance Work',
  'stapler': 'Hardware/Tools',
  'wooden platform': 'Hardware/Tools',
  'poly bag': 'Poly Bag - Small (Carry)',
  'wrapping poly': 'Poly Bag - Large (Carry)',
  'piller': 'Peeler',
  'chicken sausage': 'Chicken Sausage',
  'chef medicine': 'Chef Medicine',
  'white pepper': 'White Pepper',
};

async function main() {
  const apply = process.argv.includes('--apply');
  loadEnvLocal();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(apply ? '=== APPLYING ===' : '=== DRY RUN (pass --apply to write) ===');
    console.log();

    let totalRows = 0;
    for (const [freeName, catalogName] of Object.entries(MAPPING)) {
      const catRes = await client.query(`SELECT id, category FROM bazar_items WHERE name = $1`, [catalogName]);
      if (!catRes.rows.length) {
        console.log(`SKIP "${freeName}" -> "${catalogName}": catalog item not found`);
        continue;
      }
      const { id: itemId, category } = catRes.rows[0];
      const rowsRes = await client.query(
        `SELECT id, for_date, kind, line_total FROM bazar_plan_items WHERE item_id IS NULL AND lower(trim(name)) = $1`,
        [freeName]
      );
      if (!rowsRes.rows.length) continue;
      totalRows += rowsRes.rows.length;
      console.log(`"${freeName}" -> "${catalogName}" (id=${itemId}, category=${category}): ${rowsRes.rows.length} row(s)`);
      for (const r of rowsRes.rows) {
        console.log(`    ${r.for_date.toISOString().slice(0,10)} ${r.kind} ৳${r.line_total}`);
      }
      if (apply) {
        await client.query(
          `UPDATE bazar_plan_items SET item_id = $1, name = $2 WHERE item_id IS NULL AND lower(trim(name)) = $3`,
          [itemId, catalogName, freeName]
        );
      }
    }

    console.log();
    console.log(`Total rows ${apply ? 'updated' : 'matched'}: ${totalRows}`);

    if (apply) {
      await client.query('COMMIT');
      console.log('COMMITTED.');
    } else {
      await client.query('ROLLBACK');
      console.log('(dry run — rolled back, nothing written)');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('FAILED, rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
