// Run once to create tables (and seed the starter menu) in your database:
//   node scripts/init-db.js
// Requires DATABASE_URL to be set (loads .env.local automatically).
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Minimal .env.local loader so this works without extra dependencies.
function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function main() {
  loadEnvLocal();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set. Add it to .env.local first.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
  });

  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  console.log('Running schema.sql against the database...');
  await pool.query(schema);
  console.log('Done. Tables created (or already existed) and starter menu seeded.');
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to initialize database:', err.message);
  process.exit(1);
});
