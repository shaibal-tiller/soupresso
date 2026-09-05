-- Soupresso Cash Register — database schema
-- Run once against your Postgres database (Vercel Postgres, Neon, Supabase, etc.)

CREATE TABLE IF NOT EXISTS daily_entries (
  entry_date        DATE PRIMARY KEY,

  -- Step 1: count of the box at close (denomination breakdown, optional detail)
  denominations      JSONB,            -- e.g. {"1000":2,"500":10,"100":15,...} or null if total was entered directly
  total_counted      NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Step 2: today's sale = total_counted - opening_bhangti
  opening_bhangti     NUMERIC(12,2) NOT NULL DEFAULT 0,   -- float carried from yesterday's next_bhangti

  -- Step 3: settle yesterday's bazar advance against today's actual cost
  bazar_advance_received NUMERIC(12,2) NOT NULL DEFAULT 0, -- = yesterday's next_bazar_advance
  bazar_actual_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Step 4: set aside for tomorrow
  next_bazar_advance  NUMERIC(12,2) NOT NULL DEFAULT 0,   -- given to chef today, for tomorrow's shopping
  next_bhangti        NUMERIC(12,2) NOT NULL DEFAULT 0,   -- kept in the box for tomorrow

  -- derived, stored for fast reporting (also recomputable from the above)
  total_sales         NUMERIC(12,2) NOT NULL DEFAULT 0,   -- total_counted - opening_bhangti
  bazar_variance       NUMERIC(12,2) NOT NULL DEFAULT 0,   -- bazar_actual_cost - bazar_advance_received
  cash_taken_home      NUMERIC(12,2) NOT NULL DEFAULT 0,   -- total_counted - bazar_variance - next_bazar_advance - next_bhangti

  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional: menu items, for the products/production tracking tab
CREATE TABLE IF NOT EXISTS menu_items (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  price        NUMERIC(10,2) NOT NULL,
  active       BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Optional: how many of each item were sold on a given day
CREATE TABLE IF NOT EXISTS daily_product_sales (
  entry_date   DATE NOT NULL REFERENCES daily_entries(entry_date) ON DELETE CASCADE,
  item_id      INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (entry_date, item_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_entries_date ON daily_entries (entry_date DESC);

-- Seed menu items (from Soupresso's current menu — edit anytime from the Products tab)
INSERT INTO menu_items (name, price, sort_order) VALUES
  ('Thai Soup (Chicken & Mushroom)', 60, 1),
  ('Momo (per pc)', 15, 2),
  ('Chicken Onthon (per pc)', 10, 3),
  ('Taquitos (per pc)', 15, 4),
  ('Chicken Meat Box', 80, 5),
  ('Nachos', 100, 6)
ON CONFLICT (name) DO NOTHING;
