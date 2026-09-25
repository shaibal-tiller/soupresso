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
-- Usability round 6 (2026-09-18): full catalog redesign from BAZAR_ITEM_CATALOG_PLAN.md.
-- Renames repurpose existing rows (safe: bazar_plan_items snapshots its own
-- name/unit at insert time, so historical rows are unaffected) before the
-- categorized insert below adds everything new. Safe to always re-run.
UPDATE bazar_items SET name = 'Chicken - Whole/Mixed' WHERE name = 'Chicken';
UPDATE bazar_items SET name = 'Soup Parcel Bowl' WHERE name = 'Soup Bowl';
UPDATE bazar_items SET name = 'Poly Bag - Small (Carry)' WHERE name = 'Poly Bag';

-- Category moves for items that already existed under the old grouping.
UPDATE bazar_items SET category = 'Herbs & Leaves' WHERE name IN ('Coriander Leaves', 'Thai Leaves');
UPDATE bazar_items SET category = 'Staff & Home' WHERE name IN ('Auto Fare', 'Cold Drink');
UPDATE bazar_items SET category = 'Serving & Seating' WHERE name = 'Plate & Spoon';

INSERT INTO bazar_items (name, category, unit, unit_options, unit_based, sort_order) VALUES
  ('Chicken - Breast', 'Meat & Egg', 'kg', NULL, true, 10),
  ('Chicken - Boneless', 'Meat & Egg', 'kg', NULL, true, 20),
  ('Chicken - Drumstick', 'Meat & Egg', 'kg', NULL, true, 30),
  ('Chicken - Wings', 'Meat & Egg', 'kg', NULL, true, 40),
  ('Chicken - Whole/Mixed', 'Meat & Egg', 'kg', NULL, true, 50),
  ('Egg', 'Meat & Egg', 'dozen', '["dozen", "pc", "case30"]'::jsonb, true, 60),
  ('Sausage', 'Meat & Egg', 'packet', '["packet", "pc"]'::jsonb, true, 70),
  ('Fish', 'Meat & Egg', 'kg', NULL, true, 80),
  ('Mushroom', 'Meat & Egg', 'kg', '["kg", "gm"]'::jsonb, true, 90),
  ('Onion', 'Vegetables', 'kg', NULL, true, 100),
  ('Potato', 'Vegetables', 'kg', NULL, true, 110),
  ('Ginger', 'Vegetables', 'kg', NULL, true, 120),
  ('Garlic', 'Vegetables', 'kg', NULL, true, 130),
  ('Green Chili', 'Vegetables', '250g', NULL, true, 140),
  ('Carrot', 'Vegetables', 'kg', NULL, true, 150),
  ('Cabbage', 'Vegetables', 'pc', NULL, true, 160),
  ('Tomato', 'Vegetables', 'kg', NULL, true, 170),
  ('Cucumber', 'Vegetables', 'kg', NULL, true, 180),
  ('Eggplant', 'Vegetables', 'kg', NULL, true, 190),
  ('Lemon', 'Vegetables', 'hali', '["hali", "pc"]'::jsonb, true, 200),
  ('Spring Onion', 'Vegetables', 'kg', NULL, true, 210),
  ('Capsicum', 'Vegetables', 'kg', NULL, true, 220),
  ('Coriander Leaves', 'Herbs & Leaves', '250g', '["100g", "250g", "500g"]'::jsonb, true, 230),
  ('Mint Leaf', 'Herbs & Leaves', '250g', '["100g", "250g", "500g"]'::jsonb, true, 240),
  ('Thai Leaves', 'Herbs & Leaves', '250g', '["100g", "250g", "500g"]'::jsonb, true, 250),
  ('Thai Ginger', 'Herbs & Leaves', '250g', '["100g", "250g"]'::jsonb, true, 260),
  ('Dried Chili', 'Raw Spices', '100g', '["100g", "250g", "kg"]'::jsonb, true, 270),
  ('Turmeric', 'Raw Spices', '100g', '["100g", "250g", "kg"]'::jsonb, true, 280),
  ('Cumin', 'Raw Spices', '100g', '["100g", "250g", "kg"]'::jsonb, true, 290),
  ('Coriander Seed', 'Raw Spices', '100g', '["100g", "250g", "kg"]'::jsonb, true, 300),
  ('Coriander Powder', 'Raw Spices', '100g', '["100g", "250g"]'::jsonb, true, 310),
  ('Bay Leaf', 'Raw Spices', 'pack', NULL, true, 320),
  ('Cardamom', 'Raw Spices', '100g', '["100g", "250g", "kg"]'::jsonb, true, 330),
  ('Cinnamon', 'Raw Spices', '100g', '["100g", "250g", "kg"]'::jsonb, true, 340),
  ('Chili Powder', 'Raw Spices', '100g', '["100g", "250g", "kg"]'::jsonb, true, 350),
  ('Garlic Powder', 'Raw Spices', '100g', '["100g", "250g"]'::jsonb, true, 360),
  ('Ginger Powder', 'Raw Spices', '100g', '["100g", "250g"]'::jsonb, true, 370),
  ('Garam Masala', 'Raw Spices', '100g', '["100g", "250g", "kg"]'::jsonb, true, 380),
  ('Curry Powder', 'Raw Spices', '100g', '["100g", "250g", "kg"]'::jsonb, true, 390),
  ('Kabab Masala', 'Raw Spices', '100g', '["100g", "250g", "kg"]'::jsonb, true, 400),
  ('Chaat Masala', 'Raw Spices', '100g', '["100g", "250g", "kg"]'::jsonb, true, 410),
  ('Black Pepper', 'Raw Spices', '100g', '["100g", "250g"]'::jsonb, true, 420),
  ('Black Pepper Powder', 'Raw Spices', '100g', '["100g", "250g"]'::jsonb, true, 430),
  ('Bit Lobon', 'Raw Spices', 'kg', NULL, true, 440),
  ('Yeast', 'Raw Spices', '100g', '["100g", "250g"]'::jsonb, true, 450),
  ('Barley', 'Raw Spices', 'kg', NULL, true, 460),
  ('Ginger-Garlic Paste', 'Processed Spices & Sauces', 'kg', NULL, true, 470),
  ('Soy Sauce', 'Processed Spices & Sauces', 'litre', NULL, true, 480),
  ('Chili Sauce', 'Processed Spices & Sauces', 'litre', NULL, true, 490),
  ('Vinegar', 'Processed Spices & Sauces', 'litre', NULL, true, 500),
  ('Naga Achar', 'Processed Spices & Sauces', 'kg', '["kg", "pc"]'::jsonb, true, 510),
  ('Cooking Oil', 'Cooking Essentials', 'litre', '["litre"]'::jsonb, true, 520),
  ('Salt', 'Cooking Essentials', 'kg', NULL, true, 530),
  ('Sugar', 'Cooking Essentials', 'kg', NULL, true, 540),
  ('Milk', 'Cooking Essentials', 'litre', NULL, true, 550),
  ('Butter', 'Cooking Essentials', 'kg', NULL, true, 560),
  ('Rice', 'Cooking Essentials', 'kg', NULL, true, 570),
  ('AP Flour (Moyda)', 'Cooking Essentials', 'kg', NULL, true, 580),
  ('Cheese', 'Cooking Essentials', 'kg', NULL, true, 590),
  ('Corn Flour', 'Cooking Essentials', 'kg', NULL, true, 600),
  ('Serving Bowl', 'Serving & Seating', 'pc', NULL, true, 610),
  ('Serving Spoon', 'Serving & Seating', 'pc', NULL, true, 620),
  ('Mixing Bati', 'Serving & Seating', 'pc', NULL, true, 630),
  ('Plate & Spoon', 'Serving & Seating', 'pack', NULL, true, 640),
  ('Serving Tray', 'Serving & Seating', 'pc', NULL, true, 650),
  ('Serving Plate', 'Serving & Seating', 'pc', NULL, true, 660),
  ('Plastic Stool', 'Serving & Seating', 'pc', NULL, true, 670),
  ('Soup Parcel Bowl', 'Packaging', 'pc', NULL, true, 680),
  ('One-Time Plastic Spoon', 'Packaging', 'pc', '["pc", "pack"]'::jsonb, true, 690),
  ('Meat Box', 'Packaging', 'pc', NULL, true, 700),
  ('Parcel Box', 'Packaging', 'pc', NULL, true, 710),
  ('Paper Pack / Thonga - Small', 'Packaging', 'kg', NULL, true, 720),
  ('Paper Pack / Thonga - Large', 'Packaging', 'kg', NULL, true, 730),
  ('Foil Paper', 'Packaging', 'roll', NULL, true, 740),
  ('Poly Bag - Small (Carry)', 'Packaging', 'kg', NULL, true, 750),
  ('Poly Bag - Large (Carry)', 'Packaging', 'kg', NULL, true, 760),
  ('Garbage Bag', 'Packaging', 'kg', '["kg", "pack"]'::jsonb, true, 770),
  ('Napkin / Tissue', 'Packaging', 'pack', NULL, true, 780),
  ('Water Bottle - 500ml', 'Packaging', 'pc', NULL, true, 790),
  ('Water Bottle - 250ml', 'Packaging', 'pc', NULL, true, 800),
  ('Sauce Cup', 'Packaging', 'pc', '["pc", "pack"]'::jsonb, true, 810),
  ('Straw & Cap', 'Packaging', 'pc', '["pc", "pack"]'::jsonb, true, 820),
  ('Ice', 'Packaging', 'kg', '["kg", "block"]'::jsonb, true, 830),
  ('Ice Carrying/Delivery', 'Packaging', 'trip', NULL, true, 840),
  ('Wonton Sheet', 'Cooking Essentials', 'packet', NULL, true, 850),
  ('Gloves', 'Packaging', 'pack', NULL, true, 860),
  ('Mask', 'Packaging', 'pack', NULL, true, 870),
  ('Hair Net', 'Packaging', 'pack', NULL, true, 880),
  ('Tissue Box', 'Packaging', 'pc', NULL, true, 890),
  ('Salary', 'Staff & Home', 'person', NULL, false, 900),
  ('Salary Advance', 'Staff & Home', 'person', NULL, false, 910),
  ('Loan', 'Staff & Home', 'person', NULL, false, 920),
  ('Chef Breakfast', 'Staff & Home', 'day', NULL, true, 930),
  ('Nasta (Snack)', 'Staff & Home', 'day', NULL, true, 940),
  ('Lunch', 'Staff & Home', 'day', NULL, true, 950),
  ('Dinner', 'Staff & Home', 'day', NULL, true, 960),
  ('Chef House Rent', 'Staff & Home', 'month', NULL, false, 970),
  ('Home Utility', 'Staff & Home', 'month', NULL, false, 980),
  ('Shop Rent', 'Staff & Home', 'month', NULL, false, 990),
  ('Shop Electric Bill', 'Staff & Home', 'month', NULL, false, 1000),
  ('Shop Water Bill', 'Staff & Home', 'month', NULL, false, 1010),
  ('Shop Cleaning', 'Staff & Home', 'month', '["month", "trip"]'::jsonb, true, 1020),
  ('Auto Fare', 'Staff & Home', 'trip', NULL, true, 1030),
  ('Bulk Transport / Van Hire', 'Staff & Home', 'trip', NULL, true, 1040),
  ('Cold Drink', 'Staff & Home', 'pc', NULL, true, 1050),
  ('Home Essentials', 'Staff & Home', 'trip', NULL, true, 1060),
  ('Gas Cylinder Refill - Shop/Cart', 'Shop Operations & Repairs', 'cylinder', NULL, true, 1070),
  ('Gas Cylinder Refill - Chef Home', 'Shop Operations & Repairs', 'cylinder', NULL, true, 1080),
  ('Repair & Maintenance Work', 'Shop Operations & Repairs', 'job', NULL, false, 1090),
  ('Hardware/Tools', 'Shop Operations & Repairs', 'pc', NULL, true, 1100),
  ('Cash Box', 'Shop Operations & Repairs', 'pc', NULL, true, 1110)
ON CONFLICT (name) DO NOTHING;
-- Usability round 7 (2026-09-22): Cleaning Supplies category — wheel powder,
-- vim, soap, brush, broom, and similar shop-cleaning items were previously
-- unmapped "Other" line items (see ALIGNMENT_REPORT_2026-09-20.md). Safe to
-- always re-run.
INSERT INTO bazar_items (name, category, unit, unit_options, unit_based, sort_order) VALUES
  ('Wheel Powder', 'Cleaning Supplies', '500g', '["500g", "kg"]'::jsonb, true, 1120),
  ('Vim Powder', 'Cleaning Supplies', '500g', '["500g", "kg"]'::jsonb, true, 1130),
  ('Vim Liquid', 'Cleaning Supplies', 'litre', '["500ml", "litre"]'::jsonb, true, 1140),
  ('Bar Soap', 'Cleaning Supplies', 'pc', '["pc", "pack"]'::jsonb, true, 1150),
  ('Liquid Hand Soap', 'Cleaning Supplies', 'pc', '["pc", "pack"]'::jsonb, true, 1160),
  ('Detergent Powder', 'Cleaning Supplies', '500g', '["500g", "kg"]'::jsonb, true, 1170),
  ('Floor Cleaner (Phenyl)', 'Cleaning Supplies', 'litre', '["500ml", "litre"]'::jsonb, true, 1180),
  ('Toilet Cleaner', 'Cleaning Supplies', 'pc', NULL, true, 1190),
  ('Dish Sponge/Scrubber', 'Cleaning Supplies', 'pc', '["pc", "pack"]'::jsonb, true, 1200),
  ('Scrub Brush', 'Cleaning Supplies', 'pc', NULL, true, 1210),
  ('Broom', 'Cleaning Supplies', 'pc', NULL, true, 1220),
  ('Mop', 'Cleaning Supplies', 'pc', NULL, true, 1230),
  ('Bucket', 'Cleaning Supplies', 'pc', NULL, true, 1240)
ON CONFLICT (name) DO NOTHING;
-- Usability round 8 (2026-09-22): "frequent" quick-pick items — a manually
-- curated shortlist so common purchases don't require browsing categories.
ALTER TABLE bazar_items ADD COLUMN IF NOT EXISTS is_frequent BOOLEAN NOT NULL DEFAULT false;
-- Usability round 9 (2026-09-22): baki (credit sales) tracking. baki_given
-- is a credit sale made today (real revenue, no cash yet — counted in
-- total_sales but never in total_counted); baki_received is cash collected
-- today for an earlier baki sale (real cash today, but not today's sale —
-- it's already part of total_counted like any other cash, and only
-- subtracted back out of total_sales so it isn't double-counted as revenue).
ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS baki_given NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS baki_received NUMERIC(12,2) NOT NULL DEFAULT 0;
-- Usability round 10 (2026-09-22): weekly closing roster + task tracker.

-- Default team for each day of the week (0=Sunday .. 6=Saturday) — who's
-- *supposed* to close that weekday, separate from `daily_entries.closed_by`
-- which is who *actually* closed (whoever was available that specific day).
CREATE TABLE IF NOT EXISTS roster (
  day_of_week SMALLINT PRIMARY KEY CHECK (day_of_week BETWEEN 0 AND 6),
  people      TEXT[] NOT NULL DEFAULT '{}'
);
INSERT INTO roster (day_of_week, people)
SELECT d, '{}' FROM generate_series(0, 6) AS d
ON CONFLICT (day_of_week) DO NOTHING;

CREATE TABLE IF NOT EXISTS tasks (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  assigned_to  TEXT,
  due_date     DATE,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);

-- Multi-person assignment (replaces the single assigned_to going forward;
-- that column is kept, unused, rather than dropped). Backfill wraps any
-- existing single assignee into a one-element array.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignees TEXT[] NOT NULL DEFAULT '{}';
UPDATE tasks SET assignees = ARRAY[assigned_to] WHERE assigned_to IS NOT NULL AND assignees = '{}';

-- One row per status change / note — the audit trail for a task, shown as a
-- comment thread (mirrors entry_edit_log's audit-trail pattern elsewhere).
CREATE TABLE IF NOT EXISTS task_comments (
  id         SERIAL PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  comment    TEXT NOT NULL,
  status_at  TEXT,  -- the task's status at the time of this comment, if it was a status change
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments (task_id, created_at);

-- Usability round 11 (2026-09-23): manageable bazar categories. `category`
-- on bazar_items stays plain TEXT (not an FK — matches this project's
-- established "free text, not an enum" style elsewhere), but this table is
-- the curated list the catalog UI offers for add/rename/remove, backfilled
-- once from whatever category names already exist on bazar_items. Renaming
-- a row here must also UPDATE bazar_items.category to match (done by the
-- API, not by a trigger, to keep this a plain lookup table).
CREATE TABLE IF NOT EXISTS bazar_categories (
  id         SERIAL PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  icon       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO bazar_categories (name, sort_order)
SELECT DISTINCT category, 0 FROM bazar_items WHERE category IS NOT NULL AND category != ''
ON CONFLICT (name) DO NOTHING;
UPDATE bazar_categories SET icon = v.icon FROM (VALUES
  ('Meat & Egg', '🍗'), ('Vegetables', '🥬'), ('Herbs & Leaves', '🌿'),
  ('Raw Spices', '🌶️'), ('Processed Spices & Sauces', '🍶'), ('Cooking Essentials', '🛢️'),
  ('Serving & Seating', '🍽️'), ('Packaging', '📦'), ('Staff & Home', '🧑‍🍳'),
  ('Shop Operations & Repairs', '🔧'), ('Cleaning Supplies', '🧽'), ('Other', '🗂️')
) AS v(name, icon) WHERE bazar_categories.name = v.name AND bazar_categories.icon IS NULL;

-- Usability round 12 (2026-09-25): bazar catalog category reorganization —
-- see docs/superpowers/specs/2026-09-25-bazar-category-reorg-design.md.
-- "Staff & Home" was a jumble of staff/home costs AND shop costs; split them.
-- "Serving & Seating" + "Packaging" merge into one category. A few items
-- move to the category that actually matches what they're for.
ALTER TABLE bazar_categories ADD COLUMN IF NOT EXISTS group_name TEXT;

INSERT INTO bazar_categories (name, icon, group_name)
VALUES ('Shop', '🏪', 'Overhead'), ('Serving, Seating & Packaging', '🍽️', NULL)
ON CONFLICT (name) DO NOTHING;

UPDATE bazar_items SET category = 'Shop'
 WHERE name IN ('Shop Rent', 'Shop Utility', 'Shop Electric Bill', 'Shop Water Bill', 'Shop Cleaning', 'Bulk Transport / Van Hire')
   AND category = 'Staff & Home';

UPDATE bazar_items SET category = 'Shop'
 WHERE name IN ('Cash Box', 'Hardware/Tools', 'Repair & Maintenance Work')
   AND category = 'Shop Operations & Repairs';
UPDATE bazar_items SET category = 'Cooking Essentials'
 WHERE name = 'Gas Cylinder Refill - Shop/Cart' AND category = 'Shop Operations & Repairs';
UPDATE bazar_items SET category = 'Staff & Home'
 WHERE name = 'Gas Cylinder Refill - Chef Home' AND category = 'Shop Operations & Repairs';

UPDATE bazar_items SET category = 'Serving, Seating & Packaging'
 WHERE category IN ('Serving & Seating', 'Packaging');

-- "Onthon Sheet" was always Wonton Sheet — an ingredient (used to wrap rolls
-- and wontons before frying), not packaging. The catalog seed above used to
-- still say 'Onthon Sheet' (fixed now, but on a database where this ran
-- before that fix, ON CONFLICT DO NOTHING would keep silently recreating an
-- "Onthon Sheet" row every re-run once this UPDATE had already renamed the
-- real one) — repoint any purchases on that stray row and remove it before
-- the plain rename below, which is a no-op once no "Onthon Sheet" row exists.
UPDATE bazar_plan_items SET item_id = (SELECT id FROM bazar_items WHERE name = 'Wonton Sheet')
 WHERE item_id = (SELECT id FROM bazar_items WHERE name = 'Onthon Sheet')
   AND EXISTS (SELECT 1 FROM bazar_items WHERE name = 'Wonton Sheet');
DELETE FROM bazar_items
 WHERE name = 'Onthon Sheet' AND EXISTS (SELECT 1 FROM bazar_items x WHERE x.name = 'Wonton Sheet');
UPDATE bazar_items SET name = 'Wonton Sheet', category = 'Cooking Essentials'
 WHERE name = 'Onthon Sheet';

DELETE FROM bazar_categories WHERE name IN ('Shop Operations & Repairs', 'Serving & Seating', 'Packaging')
  AND NOT EXISTS (SELECT 1 FROM bazar_items WHERE bazar_items.category = bazar_categories.name);

UPDATE bazar_categories SET group_name = 'Overhead' WHERE name IN ('Staff & Home', 'Shop');
UPDATE bazar_categories SET group_name = 'Cooking'
 WHERE name IN ('Vegetables', 'Herbs & Leaves', 'Raw Spices', 'Processed Spices & Sauces', 'Cooking Essentials');

INSERT INTO bazar_items (name, category, unit, icon, active)
VALUES
  ('Chef Medicine', 'Staff & Home', 'pc', '💊', true),
  ('White Pepper', 'Processed Spices & Sauces', 'gm', '🧂', true),
  ('Chicken Sausage', 'Meat & Egg', 'pc', '🌭', true),
  ('Peeler', 'Cooking Essentials', 'pc', '🔪', true),
  ('Extra Travel / Bazar Trip', 'Staff & Home', 'trip', '🚗', true)
ON CONFLICT (name) DO NOTHING;

-- Cash in Hand (beta), 2026-09-25 — see
-- docs/superpowers/specs/2026-09-25-cash-in-hand-design.md for the full design.
-- One row per tracked day, mirroring the daily_entries per-day-row pattern
-- already used throughout this app. Only created for
-- entry_date >= cash_in_hand_settings.starting_date.
CREATE TABLE IF NOT EXISTS cash_in_hand_ledger (
  entry_date        DATE PRIMARY KEY REFERENCES daily_entries(entry_date) ON DELETE CASCADE,
  opening_balance   NUMERIC(12,2) NOT NULL,
  day_delta         NUMERIC(12,2) NOT NULL,
  adjustment_delta  NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_balance   NUMERIC(12,2) NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  pending_since     TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A reconciliation correction — always dated to when it's entered, never
-- silently rewriting a confirmed day's own recorded numbers. Applying one
-- recomputes closing_balance for its target day and cascades forward
-- through every later day (see app/api/cash-in-hand/adjustments/route.js).
CREATE TABLE IF NOT EXISTS cash_in_hand_adjustments (
  id           SERIAL PRIMARY KEY,
  entry_date   DATE NOT NULL REFERENCES cash_in_hand_ledger(entry_date),
  amount       NUMERIC(12,2) NOT NULL,
  note         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Singleton settings row (id always 1). NULL starting_date means "not
-- configured yet" — the whole feature shows as "not started" until set.
CREATE TABLE IF NOT EXISTS cash_in_hand_settings (
  id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  starting_date     DATE,
  starting_balance  NUMERIC(12,2),
  note              TEXT,
  set_at            TIMESTAMPTZ
);
INSERT INTO cash_in_hand_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
