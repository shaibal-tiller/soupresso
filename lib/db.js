// Single shared Postgres connection pool. Works with any standard Postgres
// connection string — Vercel Postgres, Neon, Supabase, or a local database —
// as long as DATABASE_URL is set. Using plain `pg` (rather than a
// Vercel-only client) keeps this portable if you ever move providers.
import { Pool } from 'pg';

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Add it to .env.local (development) or your Vercel project's Environment Variables (production)."
      );
    }
    pool = new Pool({
      connectionString,
      // Most hosted Postgres providers (Vercel Postgres, Neon, Supabase) require SSL.
      // Local development databases typically don't, so this is opt-out via env.
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

export async function query(text, params) {
  const client = getPool();
  return client.query(text, params);
}
