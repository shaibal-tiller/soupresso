-- Soupresso Cash Register — database schema
-- Run once against your Postgres database (Vercel Postgres, Neon, Supabase, etc.)

CREATE TABLE IF NOT EXISTS daily_entries (
  entry_date        DATE PRIMARY KEY,

  -- Step 1: count of the box at close (denomination breakdown, optional detail)
  denominations      JSONB,            -- e.g. {"1000":2,"500":10,"100":15,...} or null if total was entered directly
  total_counted      NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Step 2: today's sale, see lib/cash-math.js for the exact formula
  opening_bhangti     NUMERIC(12,2) NOT NULL DEFAULT 0,   -- float carried from yesterday's next_bhangti

  -- Step 3: settle yesterday's bazar advance against today's actual cost
  bazar_advance_received NUMERIC(12,2) NOT NULL DEFAULT 0, -- = yesterday's next_bazar_advance
  bazar_actual_cost   NUMERIC(12,2) NOT NULL DEFAULT 0,
  bazar_taken_from_box NUMERIC(12,2) NOT NULL DEFAULT 0, -- of a shortfall (actual > advance), how much the chef took directly from the box himself, vs. fronted from his own pocket and reimbursed from the box now

  -- Step 4: set aside for tomorrow
  next_bazar_advance  NUMERIC(12,2) NOT NULL DEFAULT 0,   -- given to chef today, for tomorrow's shopping
  next_bhangti        NUMERIC(12,2) NOT NULL DEFAULT 0,   -- kept in the box for tomorrow
  next_bhangti_denominations JSONB,  -- e.g. {"500":{"marked":true,"qty":3},...} or null if entered as a plain total

  -- derived, stored for fast reporting (also recomputable from the above via lib/cash-math.js)
  total_sales         NUMERIC(12,2) NOT NULL DEFAULT 0,   -- total_counted - opening_bhangti + salesAdjustment
  bazar_variance       NUMERIC(12,2) NOT NULL DEFAULT 0,   -- bazar_actual_cost - bazar_advance_received
  cash_taken_home      NUMERIC(12,2) NOT NULL DEFAULT 0,   -- total_counted - toReimburse - next_bazar_advance - next_bhangti

  is_off_day          BOOLEAN NOT NULL DEFAULT false,
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

-- Audit log: captures the previous state of an entry before it's edited.
-- Only logs when an EXISTING entry is updated (not the first save).
CREATE TABLE IF NOT EXISTS entry_edit_log (
  id             SERIAL PRIMARY KEY,
  entry_date     DATE NOT NULL,
  edited_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  previous_data  JSONB NOT NULL,       -- full snapshot of the row before the edit
  notes          TEXT                   -- optional reason for the edit
);

CREATE INDEX IF NOT EXISTS idx_edit_log_date ON entry_edit_log (entry_date, edited_at DESC);

-- If your database already has daily_entries without is_off_day, run this:
ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS is_off_day BOOLEAN NOT NULL DEFAULT false;

-- If your database already has daily_entries without closed_by, run this:
ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS closed_by TEXT[] NOT NULL DEFAULT '{}';

-- If your database already has daily_entries without bazar_taken_from_box, run this:
ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS bazar_taken_from_box NUMERIC(12,2) NOT NULL DEFAULT 0;

-- If your database already has daily_entries without next_bhangti_denominations, run this:
ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS next_bhangti_denominations JSONB;

-- Startup capital / investment expenses (deliverable 5 — data entry only, no
-- return/ROI analysis yet). category is free text, not an enum; the
-- Investments page derives its filter options from whatever is actually in
-- the table rather than a hardcoded list.
CREATE TABLE IF NOT EXISTS investments (
  id           SERIAL PRIMARY KEY,
  spent_on     DATE NOT NULL,
  category     TEXT NOT NULL,
  description  TEXT NOT NULL,
  amount       NUMERIC(12,2) NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investments_date ON investments (spent_on DESC);

-- Bazar item catalog — a tappable card list (photo/emoji, category, unit) so
-- planning tomorrow's shopping or correcting today's actual doesn't mean
-- retyping item names every time. Purely a picker convenience; the resulting
-- bazar_plan_items rows snapshot their own name/unit so editing or removing
-- a catalog item never corrupts a day's already-saved list.
CREATE TABLE IF NOT EXISTS bazar_items (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  name_bn      TEXT,
  category     TEXT NOT NULL,
  unit         TEXT NOT NULL,        -- default/only unit unless unit_options says otherwise
  unit_options JSONB,                -- e.g. ["dozen","pc","case30"]; null/empty = just `unit`, no dropdown
  unit_based   BOOLEAN NOT NULL DEFAULT true, -- false = pure lump-sum item (salary, rent, utility...): no unit, no quantity, one amount field
  icon         TEXT,
  active       BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If your database already has bazar_items without name_bn, run this:
ALTER TABLE bazar_items ADD COLUMN IF NOT EXISTS name_bn TEXT;

-- If your database already has bazar_items without unit_options/unit_based, run this:
ALTER TABLE bazar_items ADD COLUMN IF NOT EXISTS unit_options JSONB;
ALTER TABLE bazar_items ADD COLUMN IF NOT EXISTS unit_based BOOLEAN NOT NULL DEFAULT true;

-- One row per item per day's bazar list. `for_date` is the day the shopping
-- is FOR (not necessarily the day the row was created — a 'planned' list for
-- tomorrow is entered today). `kind='planned'` is the advance-shopping plan;
-- `kind='actual'` is the corrected, actually-bought list entered the next
-- day, which sums to that day's bazar_actual_cost. Not FK'd to daily_entries
-- (a 'planned' row for tomorrow is created before tomorrow's daily_entries
-- row exists). A day's list is replaced wholesale on save, not diffed.
CREATE TABLE IF NOT EXISTS bazar_plan_items (
  id           SERIAL PRIMARY KEY,
  for_date     DATE NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('planned', 'actual')),
  item_id      INTEGER REFERENCES bazar_items(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  unit         TEXT,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 0,
  unit_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
  line_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bazar_plan_items_date_kind ON bazar_plan_items (for_date, kind);

-- Seed the bazar item catalog (safe to re-run — only inserts when empty).
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM bazar_items) = 0 THEN
    INSERT INTO bazar_items (name, name_bn, category, unit, icon, sort_order) VALUES
      ('Chicken', 'মুরগি', 'Meat & Egg', 'kg', '🍗', 1),
      ('Egg', 'ডিম', 'Meat & Egg', 'dozen', '🥚', 2),
      ('Mushroom', 'মাশরুম', 'Meat & Egg', 'kg', '🍄', 3),
      ('Onion', 'পেঁয়াজ', 'Vegetables', 'kg', '🧅', 10),
      ('Potato', 'আলু', 'Vegetables', 'kg', '🥔', 11),
      ('Ginger', 'আদা', 'Vegetables', 'kg', '🫚', 12),
      ('Garlic', 'রসুন', 'Vegetables', 'kg', '🧄', 13),
      ('Green Chili', 'কাঁচা মরিচ', 'Vegetables', '250g', '🌶️', 14),
      ('Carrot', 'গাজর', 'Vegetables', 'kg', '🥕', 15),
      ('Cabbage', 'বাঁধাকপি', 'Vegetables', 'pc', '🥬', 16),
      ('Tomato', 'টমেটো', 'Vegetables', 'kg', '🍅', 17),
      ('Cucumber', 'শসা', 'Vegetables', 'kg', '🥒', 18),
      ('Eggplant', 'বেগুন', 'Vegetables', 'kg', '🍆', 19),
      ('Lemon', 'লেবু', 'Vegetables', 'hali', '🍋', 20),
      ('Spring Onion', 'পেঁয়াজ পাতা', 'Vegetables', 'kg', '🌱', 21),
      ('Capsicum', 'ক্যাপসিকাম', 'Vegetables', 'kg', '🫑', 22),
      ('Coriander Leaves', 'ধনে পাতা', 'Vegetables', '250g', '🌿', 23),
      ('Thai Leaves', 'থাই পাতা', 'Vegetables', '250g', '🌿', 24),
      ('Dried Chili', 'শুকনা মরিচ', 'Raw Spices', 'gm', '🌶️', 30),
      ('Turmeric', 'হলুদ', 'Raw Spices', 'gm', '🟡', 31),
      ('Cumin', 'জিরা', 'Raw Spices', 'gm', '⚫', 32),
      ('Coriander Seed', 'ধনে', 'Raw Spices', 'gm', '🌿', 33),
      ('Bay Leaf', 'তেজপাতা', 'Raw Spices', 'pack', '🍃', 34),
      ('Cardamom', 'এলাচ', 'Raw Spices', 'gm', '⚪', 35),
      ('Cinnamon', 'দারুচিনি', 'Raw Spices', 'gm', '🟤', 36),
      ('Chili Powder', 'মরিচের গুঁড়া', 'Raw Spices', 'gm', '🌶️', 37),
      ('Garam Masala', 'গরম মসলা', 'Raw Spices', 'gm', '🧂', 38),
      ('Curry Powder', 'কারি পাউডার', 'Raw Spices', 'gm', '🧂', 39),
      ('Ginger-Garlic Paste', 'আদা-রসুন পেস্ট', 'Processed Spices & Sauces', 'kg', '🥣', 40),
      ('Soy Sauce', 'সয়া সস', 'Processed Spices & Sauces', 'litre', '🍶', 41),
      ('Chili Sauce', 'চিলি সস', 'Processed Spices & Sauces', 'litre', '🌶️', 42),
      ('Vinegar', 'ভিনেগার', 'Processed Spices & Sauces', 'litre', '🍶', 43),
      ('Cooking Oil', 'রান্নার তেল', 'Cooking Essentials', 'litre', '🛢️', 50),
      ('Salt', 'লবণ', 'Cooking Essentials', 'kg', '🧂', 51),
      ('Sugar', 'চিনি', 'Cooking Essentials', 'kg', '🍚', 52),
      ('Milk', 'দুধ', 'Cooking Essentials', 'litre', '🥛', 53),
      ('Butter', 'মাখন', 'Cooking Essentials', 'kg', '🧈', 54),
      ('Rice', 'চাল', 'Cooking Essentials', 'kg', '🍚', 55),
      ('AP Flour (Moyda)', 'ময়দা', 'Cooking Essentials', 'kg', '🌾', 56),
      ('Cheese', 'পনির', 'Cooking Essentials', 'kg', '🧀', 57),
      ('Corn Flour', 'ভুট্টার আটা', 'Cooking Essentials', 'kg', '🌽', 58),
      ('Soup Bowl', 'স্যুপ বাটি', 'Packaging', 'pc', '🥣', 60),
      ('Parcel Box', 'পার্সেল বক্স', 'Packaging', 'pc', '📦', 61),
      ('Poly Bag', 'পলি ব্যাগ', 'Packaging', 'pack', '🛍️', 62),
      ('Foil Paper', 'ফয়েল পেপার', 'Packaging', 'roll', '📜', 63),
      ('Napkin / Tissue', 'ন্যাপকিন/টিস্যু', 'Packaging', 'pack', '🧻', 64),
      ('Plate & Spoon', 'প্লেট ও চামচ', 'Packaging', 'pack', '🍽️', 65),
      ('Gloves', 'গ্লাভস', 'Packaging', 'pack', '🧤', 66),
      ('Mask', 'মাস্ক', 'Packaging', 'pack', '😷', 67),
      ('Hair Net', 'হেয়ার নেট', 'Packaging', 'pack', '🧢', 68),
      ('Tissue Box', 'টিস্যু বক্স', 'Packaging', 'pc', '🧻', 69),
      ('Auto Fare', 'অটো ভাড়া', 'Other', 'trip', '🛺', 70),
      ('Cold Drink', 'কোল্ড ড্রিংক', 'Other', 'pc', '🥤', 72),
      ('Chef Breakfast', 'বাবুর্চির নাস্তা', 'Staff & Home', 'day', '🍳', 80),
      ('Salary', 'বেতন', 'Staff & Home', 'person', '💰', 81),
      ('Home Utility', 'বাসার ইউটিলিটি বিল', 'Staff & Home', 'month', '💡', 82),
      ('Home Essentials', 'বাসার প্রয়োজনীয় জিনিস', 'Staff & Home', 'trip', '🏠', 83),
      ('Nasta (Snack)', 'নাস্তা', 'Staff & Home', 'day', '🍪', 84),
      ('Lunch', 'দুপুরের খাবার', 'Staff & Home', 'day', '🍛', 85),
      ('Dinner', 'রাতের খাবার', 'Staff & Home', 'day', '🍽️', 86)
    ON CONFLICT (name) DO NOTHING;
  END IF;
END $$;

-- Usability round (2026-09-12, round 4): unit/category fixes and new
-- catalog items for a catalog that was already seeded before this list
-- existed. Safe to always re-run — every statement below sets the same
-- deterministic target value, and the INSERTs are ON CONFLICT DO NOTHING.
INSERT INTO bazar_items (name, name_bn, category, unit, icon, sort_order) VALUES
  ('Coriander Leaves', 'ধনে পাতা', 'Vegetables', '250g', '🌿', 23),
  ('Thai Leaves', 'থাই পাতা', 'Vegetables', '250g', '🌿', 24),
  ('Corn Flour', 'ভুট্টার আটা', 'Cooking Essentials', 'kg', '🌽', 58),
  ('Gloves', 'গ্লাভস', 'Packaging', 'pack', '🧤', 66),
  ('Mask', 'মাস্ক', 'Packaging', 'pack', '😷', 67),
  ('Hair Net', 'হেয়ার নেট', 'Packaging', 'pack', '🧢', 68),
  ('Tissue Box', 'টিস্যু বক্স', 'Packaging', 'pc', '🧻', 69),
  ('Salary', 'বেতন', 'Staff & Home', 'person', '💰', 81),
  ('Home Utility', 'বাসার ইউটিলিটি বিল', 'Staff & Home', 'month', '💡', 82),
  ('Home Essentials', 'বাসার প্রয়োজনীয় জিনিস', 'Staff & Home', 'trip', '🏠', 83),
  ('Nasta (Snack)', 'নাস্তা', 'Staff & Home', 'day', '🍪', 84),
  ('Lunch', 'দুপুরের খাবার', 'Staff & Home', 'day', '🍛', 85),
  ('Dinner', 'রাতের খাবার', 'Staff & Home', 'day', '🍽️', 86)
ON CONFLICT (name) DO NOTHING;

UPDATE bazar_items SET name = 'AP Flour (Moyda)' WHERE name = 'Flour';
UPDATE bazar_items SET category = 'Staff & Home', sort_order = 80 WHERE name = 'Chef Breakfast';
UPDATE bazar_items SET unit = 'dozen' WHERE name = 'Egg';
UPDATE bazar_items SET unit = 'hali' WHERE name = 'Lemon';
UPDATE bazar_items SET unit = '250g' WHERE name = 'Green Chili';
UPDATE bazar_items SET unit = 'gm' WHERE category = 'Raw Spices' AND name != 'Bay Leaf';

-- Backfill name_bn on a catalog seeded before it existed (safe to re-run —
-- only fills rows that don't already have one).
UPDATE bazar_items AS bi SET name_bn = v.name_bn
FROM (VALUES
  ('Chicken', 'মুরগি'), ('Egg', 'ডিম'), ('Mushroom', 'মাশরুম'),
  ('Onion', 'পেঁয়াজ'), ('Potato', 'আলু'), ('Ginger', 'আদা'), ('Garlic', 'রসুন'),
  ('Green Chili', 'কাঁচা মরিচ'), ('Carrot', 'গাজর'), ('Cabbage', 'বাঁধাকপি'),
  ('Tomato', 'টমেটো'), ('Cucumber', 'শসা'), ('Eggplant', 'বেগুন'), ('Lemon', 'লেবু'),
  ('Spring Onion', 'পেঁয়াজ পাতা'), ('Capsicum', 'ক্যাপসিকাম'),
  ('Dried Chili', 'শুকনা মরিচ'), ('Turmeric', 'হলুদ'), ('Cumin', 'জিরা'),
  ('Coriander Seed', 'ধনে'), ('Bay Leaf', 'তেজপাতা'), ('Cardamom', 'এলাচ'),
  ('Cinnamon', 'দারুচিনি'), ('Chili Powder', 'মরিচের গুঁড়া'), ('Garam Masala', 'গরম মসলা'),
  ('Curry Powder', 'কারি পাউডার'), ('Ginger-Garlic Paste', 'আদা-রসুন পেস্ট'),
  ('Soy Sauce', 'সয়া সস'), ('Chili Sauce', 'চিলি সস'), ('Vinegar', 'ভিনেগার'),
  ('Cooking Oil', 'রান্নার তেল'), ('Salt', 'লবণ'), ('Sugar', 'চিনি'), ('Milk', 'দুধ'),
  ('Butter', 'মাখন'), ('Rice', 'চাল'), ('Flour', 'ময়দা'), ('Cheese', 'পনির'),
  ('Soup Bowl', 'স্যুপ বাটি'), ('Parcel Box', 'পার্সেল বক্স'), ('Poly Bag', 'পলি ব্যাগ'),
  ('Foil Paper', 'ফয়েল পেপার'), ('Napkin / Tissue', 'ন্যাপকিন/টিস্যু'),
  ('Plate & Spoon', 'প্লেট ও চামচ'), ('Auto Fare', 'অটো ভাড়া'),
  ('Chef Breakfast', 'বাবুর্চির নাস্তা'), ('Cold Drink', 'কোল্ড ড্রিংক')
) AS v(name, name_bn)
WHERE bi.name = v.name AND bi.name_bn IS NULL;

-- Usability round 5 (2026-09-15): selectable units + total-price entry
-- instead of unit-price entry, new masala/financial items, and recurring
-- bazar-item defaults. Safe to always re-run.

-- New catalog items: two weight-based masalas, and five lump-sum financial
-- items that have no natural "unit" at all.
INSERT INTO bazar_items (name, name_bn, category, unit, icon, sort_order) VALUES
  ('Kabab Masala', 'কাবাব মসলা', 'Raw Spices', '100g', '🧂', 45),
  ('Chaat Masala', 'চাট মসলা', 'Raw Spices', '100g', '🧂', 46),
  ('Salary Advance', 'বেতন অগ্রিম', 'Staff & Home', 'person', '💵', 87),
  ('Loan', 'ঋণ', 'Staff & Home', 'person', '🏦', 88),
  ('Shop Rent', 'দোকান ভাড়া', 'Staff & Home', 'month', '🏬', 89),
  ('Chef House Rent', 'বাবুর্চির বাসা ভাড়া', 'Staff & Home', 'month', '🏠', 90),
  ('Shop Utility', 'দোকানের ইউটিলিটি বিল', 'Staff & Home', 'month', '💡', 91)
ON CONFLICT (name) DO NOTHING;

-- Items that can be bought in more than one unit — the basket shows a
-- dropdown beside the name for these; everything else keeps its single
-- `unit` as fixed text. Oil is deliberately narrowed to litre-only (it
-- previously had 1L/2L/5L "pack" sub-units, which is more precision than
-- wanted).
UPDATE bazar_items SET unit_options = '["dozen","pc","case30"]'::jsonb WHERE name = 'Egg';
UPDATE bazar_items SET unit_options = '["kg","gm"]'::jsonb WHERE name = 'Mushroom';
UPDATE bazar_items SET unit = 'litre', unit_options = '["litre"]'::jsonb WHERE name = 'Cooking Oil';
UPDATE bazar_items SET unit_options = '["hali","pc"]'::jsonb WHERE name = 'Lemon';
UPDATE bazar_items SET unit = '100g', unit_options = '["100g","250g","kg"]'::jsonb
  WHERE category = 'Raw Spices' AND name != 'Bay Leaf';
UPDATE bazar_items SET unit = '250g', unit_options = '["100g","250g","500g"]'::jsonb
  WHERE name IN ('Coriander Leaves', 'Thai Leaves');

-- Pure lump-sum items: no unit, no quantity, just one amount.
UPDATE bazar_items SET unit_based = false, unit_options = NULL
  WHERE name IN ('Salary', 'Salary Advance', 'Loan', 'Shop Rent', 'Chef House Rent', 'Home Utility', 'Shop Utility');

-- Recurring bazar items — preload defaults for "Tomorrow's bazar advance"
-- when no plan has been saved yet for that date (see bazar_recurring_items
-- below). Freely edited/removed per day; this only supplies the starting
-- basket.
CREATE TABLE IF NOT EXISTS bazar_recurring_items (
  id           SERIAL PRIMARY KEY,
  item_id      INTEGER NOT NULL REFERENCES bazar_items(id) ON DELETE CASCADE,
  quantity     NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit         TEXT,
  total_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO bazar_recurring_items (item_id, quantity, unit, total_price, sort_order)
SELECT bi.id, v.quantity, v.unit, v.total_price, v.sort_order
FROM bazar_items bi
JOIN (VALUES
  ('Auto Fare', 1::numeric, 'trip', 50::numeric, 1),
  ('Nasta (Snack)', 1, 'day', 50, 2),
  ('Coriander Leaves', 1, '100g', 50, 3),
  ('Green Chili', 1, '250g', 30, 4),
  ('Egg', 1, 'dozen', 150, 5),
  ('Potato', 2, 'kg', 50, 6)
) AS v(name, quantity, unit, total_price, sort_order) ON v.name = bi.name
WHERE NOT EXISTS (SELECT 1 FROM bazar_recurring_items r WHERE r.item_id = bi.id);
