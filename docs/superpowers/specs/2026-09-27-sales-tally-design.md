# Sales Tally (replaces Products/"Produce") — design

**Date:** 2026-09-27
**Status:** Approved for planning (approach and clarifying decisions confirmed by user in chat)
**Deliverable:** new feature, not part of the original 5-deliverable daily-hishab overhaul.

## Problem

Since roughly 20 September (exact date to be confirmed from paper records), the chef has been
informally tracking what he makes and sells so it can be checked against the day's cash sales —
but there's no page for it. The written habit is:

- For most items, the chef notes how much he made; if a batch sells out and he makes more, that
  gets added too (production happens in multiple batches through the day).
- For Soup and the to-go "Parcel" version of soup, instead of tracking production, he counts
  bowls at closing. A wrinkle: sometimes two parcel portions are sold in one bowl/container, so a
  plain bowl count would undercount — these get split into "single" and "double" counts.
- Multiplying each item's counted quantity by its menu price gives an expected sales total,
  which is compared against the day's actual counted cash sales to sanity-check that nothing's
  missing or miscounted.

The existing `/products` page (`app/products/page.js`) only supports one flat "quantity sold"
number per item per day and has no concept of batches, bowl counts, or reconciliation against
sales — it doesn't fit this workflow. It's being replaced.

## Goals

1. Let the chef (or whoever's on till) log production in batches per item, per day — add a
   batch, see a running total, delete a mis-entered batch.
2. Let Soup and Parcel Soup be entered instead as a bowl count at closing, with Parcel Soup
   additionally split into single/double counts (double = two portions in one bowl).
3. Compute that day's expected sales total (quantity × menu price, summed) and compare it
   against the day's actual counted sales (`daily_entries.total_sales`), with a plain-language
   status: **good** (within ৳50), **warning** (within ৳100), **danger** (beyond ৳100).
4. Support opening any past date (not just today), so paper records from ~20 September onward
   can be backfilled at leisure.
5. Keep the existing menu management (name/price/active) as part of this page, and extend it
   with the new per-item tracking mode.

## Non-goals

- No automatic backfill or data migration from the old `daily_product_sales` table — that table
  was never reconciled against prices and covers a different, coarser workflow. It's left in
  place (unused) rather than migrated or dropped.
- No enforcement/blocking on a bad variance — the color status is informational only ("just for
  our understanding"), never prevents saving.
- No requirement that a day's cash entry (`daily_entries`) already exist before production/bowl
  data can be logged for that date — the chef logs through the day, well before closing/cash
  count happens (see Data model).
- Single/double counting is specific to Parcel Soup for now, not a general per-item multiplier
  system.

## Decisions made in brainstorming (see chat, 2026-09-27)

1. **Parcel Soup is a new, separate menu item/price** (not the same line as regular Soup) —
   packaging changes the price. Exact price TBD by the user (see Open questions); seeded with a
   placeholder that must be corrected in Manage Menu before relying on the numbers.
2. **The comparison figure is `daily_entries.total_sales`** for that same date — the existing
   cash-count-derived sales figure, unchanged. This feature only reads it, never writes it.
3. **Backfill must work** — any date can be opened and filled in, same as today/going-forward.
4. **Single/double is hardcoded to Parcel Soup**, not a general capability, per user's explicit
   choice to keep scope small.
5. **Tracking mode is a per-item setting**, not hardcoded by item name — added as a `menu_items`
   column, editable from Manage Menu. This is a judgment call (not explicitly asked): hardcoding
   by name ("if name contains 'Soup'") would silently break if an item is renamed, and the extra
   cost of a per-item setting is minimal since Manage Menu already edits per-item fields.
6. **No FK from the new log tables to `daily_entries`** — unlike the old `daily_product_sales`
   table, `production_entries`/`bowl_counts` store `entry_date` as a plain `DATE` with no foreign
   key. This lets production be logged all day before a cash entry for that date exists, and lets
   the API tell "cash entry not saved yet" apart from "cash entry saved, sales were ৳0" by simply
   checking whether a `daily_entries` row exists at all, instead of a fragile heuristic on default
   values.

## Data model

```sql
-- New column on the existing menu items table.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS tracking_mode TEXT NOT NULL DEFAULT 'production'
  CHECK (tracking_mode IN ('production', 'bowl_single', 'bowl_double'));

-- Batch log for 'production'-mode items. Many rows per item per day.
CREATE TABLE IF NOT EXISTS production_entries (
  id           SERIAL PRIMARY KEY,
  entry_date   DATE NOT NULL,
  item_id      INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()   -- when it was logged in the app, not a claimed production time
);
CREATE INDEX IF NOT EXISTS idx_production_entries_date ON production_entries (entry_date);

-- Closing bowl count for 'bowl_single'/'bowl_double'-mode items. One row per item per day.
CREATE TABLE IF NOT EXISTS bowl_counts (
  entry_date     DATE NOT NULL,
  item_id        INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  single_count   INTEGER NOT NULL DEFAULT 0 CHECK (single_count >= 0),
  double_count   INTEGER NOT NULL DEFAULT 0 CHECK (double_count >= 0),  -- always 0 for bowl_single items
  PRIMARY KEY (entry_date, item_id)
);

-- Seed: Parcel Soup as a new menu item; mark both soup lines with their tracking mode.
-- Price is a placeholder (see Open questions) — correct it in Manage Menu after this ships.
INSERT INTO menu_items (name, price, sort_order, tracking_mode) VALUES
  ('Parcel Soup (Thai Soup, to go)', 70, 1, 'bowl_double')
ON CONFLICT (name) DO NOTHING;

UPDATE menu_items SET tracking_mode = 'bowl_single' WHERE name = 'Thai Soup (Chicken & Mushroom)';
UPDATE menu_items SET tracking_mode = 'bowl_double' WHERE name = 'Parcel Soup (Thai Soup, to go)';
```

Quantity sold per item per day:
- `production`: `SUM(quantity)` from `production_entries` for that item+date.
- `bowl_single`: `single_count` (double is unused/always 0).
- `bowl_double`: `single_count + 2 * double_count`.

## Reconciliation

For a given date:
- `computed_total = Σ (quantitySold(item) × item.price)` over every item with either an active
  flag or any logged activity that date (see API query below — historical entries always count,
  even for an item later deactivated).
- Look up `daily_entries.total_sales` for that date. If no row exists, `actual_sales = null` and
  the UI shows "cash entry not saved for this day yet" instead of a variance — the computed total
  still displays.
- `variance = computed_total - actual_sales` (only when `actual_sales` is not null).
- Status from `abs(variance)`: `<= 50` → **good**, `<= 100` → **warning**, `> 100` → **danger**.

## API

- `GET /api/sales-tally?date=YYYY-MM-DD` — returns:
  ```json
  {
    "date": "2026-09-27",
    "items": [
      { "id": 1, "name": "Thai Soup (Chicken & Mushroom)", "price": 60, "trackingMode": "bowl_single",
        "singleCount": 12, "doubleCount": 0, "quantitySold": 12 },
      { "id": 7, "name": "Parcel Soup (Thai Soup, to go)", "price": 70, "trackingMode": "bowl_double",
        "singleCount": 4, "doubleCount": 3, "quantitySold": 10 },
      { "id": 2, "name": "Momo (per pc)", "price": 15, "trackingMode": "production",
        "entries": [{ "id": 101, "quantity": 20, "createdAt": "..." }, { "id": 104, "quantity": 10, "createdAt": "..." }],
        "quantitySold": 30 }
    ],
    "computedTotal": 2020,
    "hasCashEntry": true,
    "actualSales": 1980,
    "variance": 40,
    "status": "good"
  }
  ```
  Query: every currently-active menu item (so today's blank items still show up to log against),
  UNION any item with a `production_entries` or `bowl_counts` row on that date even if now
  inactive (so historical days stay accurate after a menu change). Ordered by `sort_order`.

- `POST /api/sales-tally/entries` `{ date, itemId, quantity }` — inserts one production batch row.
  Rejects (400) if the item's `tracking_mode` isn't `production`.

- `DELETE /api/sales-tally/entries?id=` — deletes one production entry by id.

- `POST /api/sales-tally/bowl-count` `{ date, itemId, singleCount, doubleCount }` — upsert
  (`ON CONFLICT (entry_date, item_id) DO UPDATE`). Rejects (400) if the item's `tracking_mode`
  is `production`. `doubleCount` is ignored/forced to 0 server-side for `bowl_single` items.

- `/api/products` (existing, menu CRUD) — extended to accept/return `trackingMode` alongside
  `name`/`price`/`active`/`sortOrder`.

- `/api/daily-sales` (existing route) and the old "Daily quantities" tab are removed — fully
  superseded by the above. `daily_product_sales` table and its data are left in place, untouched.

## UI

- **New `/sales-tally` page**, replacing the `/products` nav entry (label: "Sales Tally", open to
  a better name). Old `/products` route and page file are removed.
- Date nav at the top (‹ date ›), identical pattern to the Products/Cash-in-Hand pages — any past
  or future date can be opened, supporting backfill.
- **Tab 1 — "Today's tally"** (default):
  - Bowl-mode items (Soup, Parcel Soup) each get a small card: a "Bowls sold" number input for
    `bowl_single` items; "Single" + "Double" number inputs for `bowl_double` items. Shows the
    computed quantity sold and value (qty × price) live.
  - Production-mode items each get a card: today's batch list (qty + a ✕ delete button per row),
    an "add batch" input + button that appends a new entry, running total quantity and value.
  - A summary card at the bottom: computed total, actual sales (or "not entered yet"), variance,
    and a colored good/warning/danger badge.
- **Tab 2 — "Manage menu"**: same as today's (name, price, active toggle, add new item), plus a
  tracking-mode selector (Production / Bowl count / Bowl count with single+double) per row.

## Error handling / edge cases

- **No cash entry yet for the opened date**: computed total still shows; variance/badge replaced
  with a neutral "cash entry not saved for this day yet" note. This is the common case while
  logging production earlier in the day, before closing.
- **Item deactivated after having historical entries**: still included in past days' totals (see
  API query); excluded from the "add new" list on the current/future date it was deactivated.
- **Deleting a production entry**: hard delete, no undo — matches the ✕-to-remove pattern already
  used elsewhere in this app (e.g. bazar basket rows). No confirmation dialog, consistent with
  existing patterns.
- **Bowl count re-entry**: saving again for the same date/item overwrites (upsert), since it's a
  single closing count, not a log.

## Testing

- Unit tests (new `lib/sales-tally.test.js`) for the pure quantity/variance math: `bowl_single`
  vs `bowl_double` quantity calculation, `computedTotal` summation, and status thresholds at the
  ৳50/৳100 boundaries (inclusive edges).
- API-level verification against local Postgres (this project's established pattern, per
  [[feedback-testing-workflow]] — no browser/Playwright testing): add/delete production entries,
  upsert a bowl count, confirm `GET` totals and status match hand-computed expectations for a
  date with a saved `daily_entries` row and for a date without one.

## Open questions for the user to confirm before planning

1. **Parcel Soup's actual price** — seeded above as a ৳70 placeholder. What should it really be?
2. **Page/nav label** — "Sales Tally" is a placeholder name; happy to use something else (e.g.
   "Sales Check", "Item Reconciliation").
3. **Exact start date for backfill** — spec assumes "~20 September, to be confirmed from paper."
   Not needed for planning/implementation, just flagging that no historical data will be
   pre-filled; it's entirely on the user to backfill once the page exists.
