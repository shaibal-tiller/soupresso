# Sales Tally Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/products` page with a new `/sales-tally` page that lets the chef log production in batches (most items) or a closing bowl count with single/double splitting (Soup, Parcel Soup), then shows a computed-sales-vs-actual-sales variance with a good/warning/danger status.

**Architecture:** Two new Postgres tables (`production_entries`, `bowl_counts`) plus a `tracking_mode` column on `menu_items`, driving a pure calculation module (`lib/sales-tally.js`) that three new API routes call. A new client page consumes those routes and ports over the existing menu-management UI.

**Tech Stack:** Next.js 14 App Router, plain JavaScript, raw SQL via `pg`, Node's built-in `node:test` runner, plain CSS (`app/globals.css`), the app's existing `useLang`/`i18n` bilingual system.

**Spec:** `docs/superpowers/specs/2026-09-27-sales-tally-design.md`

## Global Constraints

- Single/double counting applies only to Parcel Soup (`bowl_double` tracking mode) — do not build a general per-item multiplier system.
- `production_entries` and `bowl_counts` store `entry_date` as a plain `DATE` with **no foreign key** to `daily_entries` — production/bowl data can be logged before that date's cash entry exists.
- Never drop, migrate, or write to the old `daily_product_sales` table — it's left in place, untouched, unused.
- Variance status thresholds are exact: `abs(variance) <= 50` → `good`, `<= 100` → `warning`, `> 100` → `danger`. These are informational only — never block a save.
- **Never run any DB-touching command (`npm run db:init`, `node scripts/init-db.js`, a direct `psql`/`pg` connection) against the `DATABASE_URL` in `.env.local` — that is the live production Neon database.** All schema and API verification in this plan happens against a local Docker Postgres (Task 2), never against `.env.local`.
- No Playwright/browser-automation testing for this feature. Verify schema changes via `psql` inside the Docker container and verify API routes via `curl` against the Docker app container. The one exception is the final task, which hands the user a local URL for their own manual click-through — the agent does not drive a browser itself.

## Review Focus

- **No cash entry yet for the opened date** — `GET /api/sales-tally` must return `hasCashEntry: false` / `actualSales: null` / `variance: null`, not treat a missing row as zero sales. Covered in Task 4.
- **Wrong endpoint for an item's tracking mode** — posting a production batch for a `bowl_single`/`bowl_double` item, or a bowl count for a `production` item, must be rejected with 400, not silently accepted into the wrong table. Covered in Tasks 5 and 6.
- **Deactivated item with historical data** — an item switched to inactive must still appear (with its real quantity/value) in a past date's tally that has recorded activity, while being excluded from a current date's "nothing logged yet" list. Covered in Task 4.
- **Variance boundary inclusivity** — exactly ৳50 and exactly ৳100 must land on the *good*/*warning* and *warning*/*danger* sides respectively (`<=`, not `<`), and a negative variance (computed total under actual sales) must use `abs()` for the same thresholds. Covered in Task 1.
- **Parcel Soup double-count math** — a `bowl_double` item's sold quantity must be `single + 2*double`, not `single + double` or `double` alone; a `bowl_single` item must ignore any `doubleCount` sent to it. Covered in Tasks 1 and 6.

---

## Task 1: Pure reconciliation math (`lib/sales-tally.js`)

**Files:**
- Create: `lib/sales-tally.js`
- Test: `lib/sales-tally.test.js`

**Interfaces:**
- Produces: `GOOD_THRESHOLD` (50), `WARNING_THRESHOLD` (100), `quantitySoldForItem(item)`, `varianceStatus(variance)`, `computeReconciliation(items, actualSales)` — all named exports, consumed by `app/api/sales-tally/route.js` in Task 4.
  - `item` shape: `{ trackingMode: 'production'|'bowl_single'|'bowl_double', price: number, entries?: {quantity:number}[], singleCount?: number, doubleCount?: number }`
  - `computeReconciliation(items, actualSales)` returns `{ computedTotal: number, actualSales: number|null, variance: number|null, status: 'good'|'warning'|'danger'|null }`. `actualSales` of `null` means no cash entry exists yet for the date — `variance`/`status` are then also `null`.

- [ ] **Step 1: Write the failing tests**

Create `lib/sales-tally.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOOD_THRESHOLD, WARNING_THRESHOLD,
  quantitySoldForItem, varianceStatus, computeReconciliation,
} from './sales-tally.js';

test('quantitySoldForItem: production mode sums all batch entries', () => {
  const item = { trackingMode: 'production', entries: [{ quantity: 20 }, { quantity: 10 }, { quantity: 5 }] };
  assert.equal(quantitySoldForItem(item), 35);
});

test('quantitySoldForItem: production mode with no entries is 0', () => {
  assert.equal(quantitySoldForItem({ trackingMode: 'production', entries: [] }), 0);
  assert.equal(quantitySoldForItem({ trackingMode: 'production' }), 0);
});

test('quantitySoldForItem: bowl_single mode is just singleCount, doubleCount ignored', () => {
  const item = { trackingMode: 'bowl_single', singleCount: 12, doubleCount: 99 };
  assert.equal(quantitySoldForItem(item), 12);
});

test('quantitySoldForItem: bowl_double mode is single + 2*double', () => {
  const item = { trackingMode: 'bowl_double', singleCount: 4, doubleCount: 3 };
  assert.equal(quantitySoldForItem(item), 10); // 4 + 2*3
});

test('quantitySoldForItem: bowl modes default missing counts to 0', () => {
  assert.equal(quantitySoldForItem({ trackingMode: 'bowl_single' }), 0);
  assert.equal(quantitySoldForItem({ trackingMode: 'bowl_double', singleCount: 2 }), 2);
});

test('varianceStatus: boundaries are inclusive', () => {
  assert.equal(varianceStatus(50), 'good');
  assert.equal(varianceStatus(-50), 'good');
  assert.equal(varianceStatus(50.01), 'warning');
  assert.equal(varianceStatus(100), 'warning');
  assert.equal(varianceStatus(-100), 'warning');
  assert.equal(varianceStatus(100.01), 'danger');
  assert.equal(varianceStatus(-500), 'danger');
  assert.equal(varianceStatus(0), 'good');
});

test('GOOD_THRESHOLD and WARNING_THRESHOLD are 50 and 100', () => {
  assert.equal(GOOD_THRESHOLD, 50);
  assert.equal(WARNING_THRESHOLD, 100);
});

test('computeReconciliation: sums quantitySold*price across mixed tracking modes', () => {
  const items = [
    { trackingMode: 'production', price: 15, entries: [{ quantity: 20 }, { quantity: 10 }] }, // 30*15=450
    { trackingMode: 'bowl_single', price: 60, singleCount: 12 },                              // 12*60=720
    { trackingMode: 'bowl_double', price: 70, singleCount: 4, doubleCount: 3 },                // 10*70=700
  ];
  const result = computeReconciliation(items, 1900);
  assert.equal(result.computedTotal, 1870); // 450+720+700
  assert.equal(result.actualSales, 1900);
  assert.equal(result.variance, -30); // 1870-1900
  assert.equal(result.status, 'good');
});

test('computeReconciliation: no cash entry yet -> actualSales/variance/status are null', () => {
  const items = [{ trackingMode: 'bowl_single', price: 60, singleCount: 12 }];
  const result = computeReconciliation(items, null);
  assert.equal(result.computedTotal, 720);
  assert.equal(result.actualSales, null);
  assert.equal(result.variance, null);
  assert.equal(result.status, null);
});

test('computeReconciliation: empty items list computes to 0, still compares against actualSales', () => {
  const result = computeReconciliation([], 200);
  assert.equal(result.computedTotal, 0);
  assert.equal(result.variance, -200);
  assert.equal(result.status, 'danger');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test lib/sales-tally.test.js`
Expected: FAIL — `Cannot find module './sales-tally.js'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/sales-tally.js`:

```js
// Pure reconciliation math for the Sales Tally feature. No DB, no React —
// see docs/superpowers/specs/2026-09-27-sales-tally-design.md.

export const GOOD_THRESHOLD = 50;
export const WARNING_THRESHOLD = 100;

/**
 * quantity sold for one item, given its tracking mode.
 * - production: sum of all logged batch quantities.
 * - bowl_single: the closing single count (doubleCount is ignored).
 * - bowl_double: single + 2*double (two portions sometimes share one bowl).
 */
export function quantitySoldForItem(item) {
  if (item.trackingMode === 'production') {
    return (item.entries || []).reduce((sum, e) => sum + Number(e.quantity), 0);
  }
  if (item.trackingMode === 'bowl_double') {
    return Number(item.singleCount || 0) + 2 * Number(item.doubleCount || 0);
  }
  // bowl_single
  return Number(item.singleCount || 0);
}

/** good (<=50 off), warning (<=100 off), or danger (>100 off) — thresholds are on abs(variance). */
export function varianceStatus(variance) {
  const abs = Math.abs(variance);
  if (abs <= GOOD_THRESHOLD) return 'good';
  if (abs <= WARNING_THRESHOLD) return 'warning';
  return 'danger';
}

/**
 * computedTotal = sum(quantitySold(item) * item.price) across all items.
 * actualSales === null means no cash entry exists yet for the date, so
 * variance/status stay null rather than comparing against a fabricated 0.
 */
export function computeReconciliation(items, actualSales) {
  const computedTotal = items.reduce(
    (sum, item) => sum + quantitySoldForItem(item) * Number(item.price),
    0
  );
  if (actualSales == null) {
    return { computedTotal, actualSales: null, variance: null, status: null };
  }
  const variance = computedTotal - Number(actualSales);
  return { computedTotal, actualSales: Number(actualSales), variance, status: varianceStatus(variance) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test lib/sales-tally.test.js`
Expected: PASS, all 11 tests green.

- [ ] **Step 5: Run the full existing test suite to check for regressions**

Run: `npm test`
Expected: PASS — all pre-existing test files plus `lib/sales-tally.test.js` green.

- [ ] **Step 6: Commit**

```bash
git add lib/sales-tally.js lib/sales-tally.test.js
git commit -m "Add pure reconciliation math for Sales Tally (lib/sales-tally.js)"
```

---

## Task 2: Schema migration + local Docker dev stack

**Files:**
- Modify: `schema.sql` (append at end of file)
- Create: `Dockerfile` (gitignored — local dev tooling only, matches existing `.gitignore` entry)
- Create: `docker-compose.dev.yml` (gitignored, same reason)
- Create: `.dockerignore`

**Interfaces:**
- Produces: `menu_items.tracking_mode` column, `production_entries` table, `bowl_counts` table — consumed by every API route task below (3-6).

- [ ] **Step 1: Append the migration to `schema.sql`**

Add this block at the very end of `schema.sql` (after the existing `INSERT INTO cash_in_hand_settings...` line):

```sql

-- Sales Tally (production batches + closing bowl counts), 2026-09-27 — see
-- docs/superpowers/specs/2026-09-27-sales-tally-design.md for the full design.
-- Replaces the old Products page's single daily_product_sales number with
-- per-item tracking that matches how sales are actually recorded on paper.

-- If your database already has menu_items without tracking_mode, run this:
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS tracking_mode TEXT NOT NULL DEFAULT 'production'
  CHECK (tracking_mode IN ('production', 'bowl_single', 'bowl_double'));

-- Batch log for 'production'-mode items — many rows per item per day, one
-- per batch made. No FK to daily_entries: production is logged through the
-- day, often before that day's cash entry is saved.
CREATE TABLE IF NOT EXISTS production_entries (
  id           SERIAL PRIMARY KEY,
  entry_date   DATE NOT NULL,
  item_id      INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_production_entries_date ON production_entries (entry_date);

-- Closing bowl count for 'bowl_single'/'bowl_double'-mode items (Soup /
-- Parcel Soup) — one row per item per day. double_count is always 0 for
-- bowl_single items; for bowl_double, quantity sold = single + 2*double.
CREATE TABLE IF NOT EXISTS bowl_counts (
  entry_date     DATE NOT NULL,
  item_id        INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  single_count   INTEGER NOT NULL DEFAULT 0 CHECK (single_count >= 0),
  double_count   INTEGER NOT NULL DEFAULT 0 CHECK (double_count >= 0),
  PRIMARY KEY (entry_date, item_id)
);

-- Parcel Soup is a new menu item (separate price from the dine-in bowl).
-- Price below is a placeholder — correct it from Manage Menu once this ships.
INSERT INTO menu_items (name, price, sort_order, tracking_mode) VALUES
  ('Parcel Soup (Thai Soup, to go)', 70, 1, 'bowl_double')
ON CONFLICT (name) DO NOTHING;

UPDATE menu_items SET tracking_mode = 'bowl_single' WHERE name = 'Thai Soup (Chicken & Mushroom)';
UPDATE menu_items SET tracking_mode = 'bowl_double' WHERE name = 'Parcel Soup (Thai Soup, to go)';
```

- [ ] **Step 2: Create the local Docker dev stack**

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

Create `.dockerignore` (keeps `.env.local` — which holds the production `DATABASE_URL` — out of the build context entirely):

```
node_modules
.next
.git
.env
.env.local
.env*.local
*.log
```

Create `docker-compose.dev.yml`:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: soupresso
      POSTGRES_USER: soupresso
      POSTGRES_PASSWORD: soupresso
    volumes:
      - ./schema.sql:/docker-entrypoint-initdb.d/1-schema.sql:ro
      - ./seed-history.sql:/docker-entrypoint-initdb.d/2-seed-history.sql:ro
      - soupresso-docker-pgdata:/var/lib/postgresql/data
    ports:
      - "5434:5432"

  app:
    build: .
    depends_on:
      - db
    environment:
      DATABASE_URL: postgres://soupresso:soupresso@db:5432/soupresso
      DATABASE_SSL: "false"
      APP_EMAIL: dev@soupresso.local
      APP_PASSWORD: devpass123
      SESSION_SECRET: local-docker-dev-secret-not-for-production-use
    ports:
      - "3000:3000"

volumes:
  soupresso-docker-pgdata:
```

- [ ] **Step 3: Bring up the database and verify the migration applied cleanly**

Run:
```bash
docker compose -f docker-compose.dev.yml up -d db
docker compose -f docker-compose.dev.yml exec db psql -U soupresso -d soupresso -c "\d menu_items"
docker compose -f docker-compose.dev.yml exec db psql -U soupresso -d soupresso -c "\dt"
```
Expected: `menu_items` description shows a `tracking_mode` column with the `production`/`bowl_single`/`bowl_double` check constraint; the table list includes `production_entries` and `bowl_counts`.

- [ ] **Step 4: Verify the seed data**

Run:
```bash
docker compose -f docker-compose.dev.yml exec db psql -U soupresso -d soupresso -c \
  "SELECT name, price, tracking_mode FROM menu_items ORDER BY sort_order;"
```
Expected: a row `Parcel Soup (Thai Soup, to go) | 70.00 | bowl_double`, a row `Thai Soup (Chicken & Mushroom) | 60.00 | bowl_single`, and every other seeded item showing `tracking_mode = production`.

- [ ] **Step 5: Commit (schema.sql only — the Docker files are gitignored)**

```bash
git add schema.sql
git status   # confirm Dockerfile / docker-compose.dev.yml / .dockerignore do NOT appear staged (gitignored)
git commit -m "Add production_entries/bowl_counts tables and menu_items.tracking_mode for Sales Tally"
```

---

## Task 3: Extend `/api/products` with `trackingMode`

**Files:**
- Modify: `app/api/products/route.js`

**Interfaces:**
- Consumes: `production_entries`/`bowl_counts`/`menu_items.tracking_mode` from Task 2.
- Produces: `POST /api/products` now accepts/persists `trackingMode` (`'production'|'bowl_single'|'bowl_double'`, defaults to `'production'`); `GET /api/products` rows already include `tracking_mode` via `SELECT *` (no change needed there). Consumed by the Manage Menu tab in Task 8 and read informally by Task 5/6's item lookups.

- [ ] **Step 1: Modify the POST handler**

In `app/api/products/route.js`, replace the body of `POST` with (full file after the change):

```js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';

export const dynamic = 'force-dynamic'; // always hits the live database, never statically cached

export async function GET() {
  try {
    const { rows } = await query(
      `SELECT * FROM menu_items ORDER BY sort_order ASC, name ASC`
    );
    return NextResponse.json({ items: rows });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const TRACKING_MODES = ['production', 'bowl_single', 'bowl_double'];

// Create a new item, or update an existing one if `id` is provided.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { id, name, price, active = true, sortOrder = 0, trackingMode = 'production' } = body || {};

  const p = coerceLocaleNumber(price);
  if (!name || price === undefined || p == null) {
    return NextResponse.json({ error: 'name and a numeric price are required' }, { status: 400 });
  }
  const sort = coerceLocaleNumber(sortOrder) ?? 0;
  const mode = TRACKING_MODES.includes(trackingMode) ? trackingMode : 'production';

  try {
    if (id) {
      const { rows } = await query(
        `UPDATE menu_items SET name=$1, price=$2, active=$3, sort_order=$4, tracking_mode=$5 WHERE id=$6 RETURNING *`,
        [name, p, !!active, sort, mode, id]
      );
      return NextResponse.json({ item: rows[0] });
    } else {
      const { rows } = await query(
        `INSERT INTO menu_items (name, price, active, sort_order, tracking_mode) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [name, p, !!active, sort, mode]
      );
      return NextResponse.json({ item: rows[0] });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Rebuild and start the full Docker stack**

```bash
docker compose -f docker-compose.dev.yml up -d --build
```
Expected: `app` container builds and starts without errors; `docker compose -f docker-compose.dev.yml logs app --tail 30` shows Next.js listening on port 3000, no stack trace.

- [ ] **Step 3: Verify via curl**

```bash
# log in first to get the session cookie (jar.txt), then use it for every subsequent call
curl -s -c jar.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@soupresso.local","password":"devpass123"}'

curl -s -b jar.txt -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Wrap","price":25,"trackingMode":"bowl_single"}'
```
Expected: JSON response `{"item": {..., "tracking_mode": "bowl_single", ...}}`.

```bash
curl -s -b jar.txt "http://localhost:3000/api/products" | python3 -m json.tool | grep -A1 '"name": "Test Wrap"'
```
Expected: shows `"tracking_mode": "bowl_single"` for that item.

- [ ] **Step 4: Commit**

```bash
git add app/api/products/route.js
git commit -m "Add trackingMode to menu item create/update"
```

---

## Task 4: `GET /api/sales-tally` — the day's full reconciliation payload

**Files:**
- Create: `app/api/sales-tally/route.js`

**Interfaces:**
- Consumes: `quantitySoldForItem`, `computeReconciliation` from `lib/sales-tally.js` (Task 1); `menu_items`/`production_entries`/`bowl_counts`/`daily_entries` from Task 2.
- Produces: `GET /api/sales-tally?date=YYYY-MM-DD` → `{ date, items: [{ id, name, price, trackingMode, singleCount, doubleCount, entries: [{id, quantity, createdAt}], quantitySold, value }], computedTotal, hasCashEntry, actualSales, variance, status }`. Consumed by Task 7's page and by Tasks 5/6's curl verification.

- [ ] **Step 1: Write the route**

Create `app/api/sales-tally/route.js`:

```js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { quantitySoldForItem, computeReconciliation } from '@/lib/sales-tally';

export const dynamic = 'force-dynamic'; // always hits the live database, never statically cached

// GET /api/sales-tally?date=YYYY-MM-DD
// Every active menu item, plus any item with logged activity on that date
// even if it's since been deactivated (so past days stay accurate), joined
// with that item's production batches or closing bowl count for the date.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 });

  try {
    const { rows } = await query(
      `SELECT
         m.id, m.name, m.price, m.tracking_mode,
         COALESCE(bc.single_count, 0) AS single_count,
         COALESCE(bc.double_count, 0) AS double_count,
         COALESCE(
           (SELECT json_agg(json_build_object('id', pe.id, 'quantity', pe.quantity, 'createdAt', pe.created_at) ORDER BY pe.created_at)
            FROM production_entries pe WHERE pe.item_id = m.id AND pe.entry_date = $1),
           '[]'
         ) AS entries
       FROM menu_items m
       LEFT JOIN bowl_counts bc ON bc.item_id = m.id AND bc.entry_date = $1
       WHERE m.active = true
          OR EXISTS (SELECT 1 FROM production_entries pe2 WHERE pe2.item_id = m.id AND pe2.entry_date = $1)
          OR EXISTS (SELECT 1 FROM bowl_counts bc2 WHERE bc2.item_id = m.id AND bc2.entry_date = $1)
       ORDER BY m.sort_order ASC, m.name ASC`,
      [date]
    );

    const items = rows.map((r) => {
      const item = {
        id: r.id,
        name: r.name,
        price: Number(r.price),
        trackingMode: r.tracking_mode,
        singleCount: Number(r.single_count),
        doubleCount: Number(r.double_count),
        entries: r.entries || [],
      };
      const quantitySold = quantitySoldForItem(item);
      return { ...item, quantitySold, value: quantitySold * item.price };
    });

    const { rows: entryRows } = await query(
      `SELECT total_sales FROM daily_entries WHERE entry_date = $1`,
      [date]
    );
    const hasCashEntry = entryRows.length > 0;
    const actualSales = hasCashEntry ? Number(entryRows[0].total_sales) : null;

    const { computedTotal, variance, status } = computeReconciliation(items, actualSales);

    return NextResponse.json({ date, items, computedTotal, hasCashEntry, actualSales, variance, status });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Rebuild the app container**

```bash
docker compose -f docker-compose.dev.yml up -d --build app
```

- [ ] **Step 3: Verify "no cash entry yet" behavior via curl**

Pick a date with no `daily_entries` row (e.g. far in the future, `2027-01-01`):
```bash
curl -s -b jar.txt "http://localhost:3000/api/sales-tally?date=2027-01-01" | python3 -m json.tool
```
Expected: `"hasCashEntry": false`, `"actualSales": null`, `"variance": null`, `"status": null`, `"computedTotal": 0`, and `items` lists every active menu item (including the seeded Parcel Soup and the `Test Wrap` item from Task 3) each with `quantitySold: 0`.

- [ ] **Step 4: Seed a real day and verify the computed total + variance**

```bash
docker compose -f docker-compose.dev.yml exec db psql -U soupresso -d soupresso -c \
  "INSERT INTO daily_entries (entry_date, total_counted, total_sales) VALUES ('2026-09-27', 2000, 2000) ON CONFLICT (entry_date) DO UPDATE SET total_sales = 2000;"

docker compose -f docker-compose.dev.yml exec db psql -U soupresso -d soupresso -c \
  "INSERT INTO production_entries (entry_date, item_id, quantity) SELECT '2026-09-27', id, 20 FROM menu_items WHERE name = 'Momo (per pc)';"
docker compose -f docker-compose.dev.yml exec db psql -U soupresso -d soupresso -c \
  "INSERT INTO production_entries (entry_date, item_id, quantity) SELECT '2026-09-27', id, 10 FROM menu_items WHERE name = 'Momo (per pc)';"
docker compose -f docker-compose.dev.yml exec db psql -U soupresso -d soupresso -c \
  "INSERT INTO bowl_counts (entry_date, item_id, single_count, double_count) SELECT '2026-09-27', id, 4, 3 FROM menu_items WHERE name = 'Parcel Soup (Thai Soup, to go)';"

curl -s -b jar.txt "http://localhost:3000/api/sales-tally?date=2026-09-27" | python3 -m json.tool
```
Expected: the Momo item shows `"entries": [{"quantity": 20, ...}, {"quantity": 10, ...}]` and `"quantitySold": 30`; the Parcel Soup item shows `"singleCount": 4`, `"doubleCount": 3`, `"quantitySold": 10`; `"hasCashEntry": true`, `"actualSales": 2000`; `computedTotal` equals `30*15 + 10*70` (`450+700=1150`) plus zero from every other untouched item; `variance` = `computedTotal - 2000`; `status` matches that variance per the thresholds (a large negative variance here, so `"danger"` — that's expected and correct, this is deliberately unbalanced seed data for the test).

- [ ] **Step 5: Verify a deactivated item still counts historically**

```bash
docker compose -f docker-compose.dev.yml exec db psql -U soupresso -d soupresso -c \
  "UPDATE menu_items SET active = false WHERE name = 'Momo (per pc)';"

curl -s -b jar.txt "http://localhost:3000/api/sales-tally?date=2026-09-27" | python3 -m json.tool | grep -A6 '"name": "Momo'
curl -s -b jar.txt "http://localhost:3000/api/sales-tally?date=2027-01-02" | python3 -m json.tool | grep '"name": "Momo'
```
Expected: the first call (the date with logged batches) still shows Momo with `"quantitySold": 30`; the second call (a fresh date, no activity) shows no Momo entry at all, since it's now inactive and has no activity that day. Restore it afterward: `docker compose -f docker-compose.dev.yml exec db psql -U soupresso -d soupresso -c "UPDATE menu_items SET active = true WHERE name = 'Momo (per pc)';"`

- [ ] **Step 6: Commit**

```bash
git add app/api/sales-tally/route.js
git commit -m "Add GET /api/sales-tally: per-day items, computed total, and variance"
```

---

## Task 5: Production batch entries — add and delete

**Files:**
- Create: `app/api/sales-tally/entries/route.js`

**Interfaces:**
- Consumes: `menu_items.tracking_mode`, `production_entries` (Task 2).
- Produces: `POST /api/sales-tally/entries` `{date, itemId, quantity}` → `{entry: {id, quantity, createdAt}}`; `DELETE /api/sales-tally/entries?id=` → `{ok: true}`. Consumed by Task 7's "add batch"/"delete batch" actions.

- [ ] **Step 1: Write the route**

Create `app/api/sales-tally/entries/route.js`:

```js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';

export const dynamic = 'force-dynamic';

// POST /api/sales-tally/entries  { date, itemId, quantity }
// Logs one production batch for a 'production'-mode item.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { date, itemId, quantity } = body || {};
  const qty = coerceLocaleNumber(quantity);
  if (!date || !itemId || qty == null || qty <= 0) {
    return NextResponse.json({ error: 'date, itemId, and a positive quantity are required' }, { status: 400 });
  }

  try {
    const { rows: itemRows } = await query(`SELECT tracking_mode FROM menu_items WHERE id = $1`, [itemId]);
    if (!itemRows.length) return NextResponse.json({ error: 'item not found' }, { status: 404 });
    if (itemRows[0].tracking_mode !== 'production') {
      return NextResponse.json({ error: 'this item is not tracked by production batches' }, { status: 400 });
    }
    const { rows } = await query(
      `INSERT INTO production_entries (entry_date, item_id, quantity)
       VALUES ($1, $2, $3) RETURNING id, quantity, created_at AS "createdAt"`,
      [date, itemId, Math.round(qty)]
    );
    return NextResponse.json({ entry: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/sales-tally/entries?id=N -> remove one mis-logged batch.
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });
  try {
    await query(`DELETE FROM production_entries WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Rebuild the app container**

```bash
docker compose -f docker-compose.dev.yml up -d --build app
```

- [ ] **Step 3: Verify add + delete via curl**

```bash
# Add a batch for Nachos (a 'production'-mode item) on 2026-09-27
NACHOS_ID=$(docker compose -f docker-compose.dev.yml exec -T db psql -U soupresso -d soupresso -t -c \
  "SELECT id FROM menu_items WHERE name = 'Nachos';" | tr -d ' ')

curl -s -b jar.txt -X POST http://localhost:3000/api/sales-tally/entries \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-09-27\",\"itemId\":$NACHOS_ID,\"quantity\":5}"
```
Expected: `{"entry": {"id": <n>, "quantity": 5, "createdAt": "..."}}`.

```bash
curl -s -b jar.txt "http://localhost:3000/api/sales-tally?date=2026-09-27" | python3 -m json.tool | grep -A6 '"name": "Nachos"'
```
Expected: Nachos now shows one entry of quantity 5 and `"quantitySold": 5`.

```bash
ENTRY_ID=$(curl -s -b jar.txt "http://localhost:3000/api/sales-tally?date=2026-09-27" | python3 -c "import json,sys; d=json.load(sys.stdin); print([i for i in d['items'] if i['name']=='Nachos'][0]['entries'][0]['id'])")
curl -s -b jar.txt -X DELETE "http://localhost:3000/api/sales-tally/entries?id=$ENTRY_ID"
curl -s -b jar.txt "http://localhost:3000/api/sales-tally?date=2026-09-27" | python3 -m json.tool | grep -A4 '"name": "Nachos"'
```
Expected: DELETE returns `{"ok": true}`; the follow-up GET shows Nachos with `"entries": []` and `"quantitySold": 0` again.

- [ ] **Step 4: Verify the wrong-tracking-mode rejection**

```bash
PARCEL_ID=$(docker compose -f docker-compose.dev.yml exec -T db psql -U soupresso -d soupresso -t -c \
  "SELECT id FROM menu_items WHERE name = 'Parcel Soup (Thai Soup, to go)';" | tr -d ' ')

curl -s -w '\n%{http_code}\n' -b jar.txt -X POST http://localhost:3000/api/sales-tally/entries \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-09-27\",\"itemId\":$PARCEL_ID,\"quantity\":5}"
```
Expected: HTTP 400 and `{"error": "this item is not tracked by production batches"}` — Parcel Soup is `bowl_double`, not `production`.

- [ ] **Step 5: Commit**

```bash
git add app/api/sales-tally/entries/route.js
git commit -m "Add POST/DELETE /api/sales-tally/entries for production batch logging"
```

---

## Task 6: Closing bowl count upsert

**Files:**
- Create: `app/api/sales-tally/bowl-count/route.js`

**Interfaces:**
- Consumes: `menu_items.tracking_mode`, `bowl_counts` (Task 2).
- Produces: `POST /api/sales-tally/bowl-count` `{date, itemId, singleCount, doubleCount}` → `{bowlCount: {entry_date, item_id, single_count, double_count}}`. Consumed by Task 7's bowl-count inputs.

- [ ] **Step 1: Write the route**

Create `app/api/sales-tally/bowl-count/route.js`:

```js
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { coerceLocaleNumber } from '@/lib/numerals';

export const dynamic = 'force-dynamic';

// POST /api/sales-tally/bowl-count  { date, itemId, singleCount, doubleCount }
// Upserts the closing bowl count for a 'bowl_single'/'bowl_double'-mode item.
// doubleCount is forced to 0 for 'bowl_single' items regardless of what's sent.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { date, itemId, singleCount, doubleCount } = body || {};
  if (!date || !itemId) {
    return NextResponse.json({ error: 'date and itemId are required' }, { status: 400 });
  }
  const single = Math.max(0, Math.round(coerceLocaleNumber(singleCount) ?? 0));
  const double = Math.max(0, Math.round(coerceLocaleNumber(doubleCount) ?? 0));

  try {
    const { rows: itemRows } = await query(`SELECT tracking_mode FROM menu_items WHERE id = $1`, [itemId]);
    if (!itemRows.length) return NextResponse.json({ error: 'item not found' }, { status: 404 });
    const mode = itemRows[0].tracking_mode;
    if (mode !== 'bowl_single' && mode !== 'bowl_double') {
      return NextResponse.json({ error: 'this item is not tracked by bowl count' }, { status: 400 });
    }
    const effectiveDouble = mode === 'bowl_double' ? double : 0;

    const { rows } = await query(
      `INSERT INTO bowl_counts (entry_date, item_id, single_count, double_count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (entry_date, item_id) DO UPDATE SET single_count = EXCLUDED.single_count, double_count = EXCLUDED.double_count
       RETURNING entry_date, item_id, single_count, double_count`,
      [date, itemId, single, effectiveDouble]
    );
    return NextResponse.json({ bowlCount: rows[0] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Rebuild the app container**

```bash
docker compose -f docker-compose.dev.yml up -d --build app
```

- [ ] **Step 3: Verify upsert + double-count-forced-to-zero via curl**

```bash
SOUP_ID=$(docker compose -f docker-compose.dev.yml exec -T db psql -U soupresso -d soupresso -t -c \
  "SELECT id FROM menu_items WHERE name = 'Thai Soup (Chicken & Mushroom)';" | tr -d ' ')

curl -s -b jar.txt -X POST http://localhost:3000/api/sales-tally/bowl-count \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-09-27\",\"itemId\":$SOUP_ID,\"singleCount\":15,\"doubleCount\":9}"
```
Expected: `{"bowlCount": {..., "single_count": 15, "double_count": 0}}` — Soup is `bowl_single`, so `doubleCount` is forced to 0 even though 9 was sent.

```bash
SOUP_ID=$(docker compose -f docker-compose.dev.yml exec -T db psql -U soupresso -d soupresso -t -c \
  "SELECT id FROM menu_items WHERE name = 'Thai Soup (Chicken & Mushroom)';" | tr -d ' ')

curl -s -b jar.txt -X POST http://localhost:3000/api/sales-tally/bowl-count \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-09-27\",\"itemId\":$SOUP_ID,\"singleCount\":20,\"doubleCount\":0}"
curl -s -b jar.txt "http://localhost:3000/api/sales-tally?date=2026-09-27" | python3 -m json.tool | grep -A5 '"name": "Thai Soup'
```
Expected: the second POST overwrites (upserts) the first — the GET shows `"singleCount": 20`, not 15 or 35.

- [ ] **Step 4: Verify the wrong-tracking-mode rejection**

```bash
NACHOS_ID=$(docker compose -f docker-compose.dev.yml exec -T db psql -U soupresso -d soupresso -t -c \
  "SELECT id FROM menu_items WHERE name = 'Nachos';" | tr -d ' ')

curl -s -w '\n%{http_code}\n' -b jar.txt -X POST http://localhost:3000/api/sales-tally/bowl-count \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-09-27\",\"itemId\":$NACHOS_ID,\"singleCount\":5,\"doubleCount\":0}"
```
Expected: HTTP 400, `{"error": "this item is not tracked by bowl count"}` — Nachos is `production`.

- [ ] **Step 5: Commit**

```bash
git add app/api/sales-tally/bowl-count/route.js
git commit -m "Add POST /api/sales-tally/bowl-count for Soup/Parcel Soup closing counts"
```

---

## Task 7: New `/sales-tally` page — Today's tally view

**Files:**
- Create: `app/sales-tally/page.js`
- Modify: `lib/i18n.js` (add new BN translations — see below, add near the end of the `BN` object, before its closing `};`)

**Interfaces:**
- Consumes: `GET /api/sales-tally` (Task 4), `POST`/`DELETE /api/sales-tally/entries` (Task 5), `POST /api/sales-tally/bowl-count` (Task 6); `todayStr`/`shiftDateStr` from `lib/dates.js`; `useLang` from `app/LangProvider.js`; `NumberInput` from `app/NumberInput.js`; `cachedFetchJson`/`peekCache`/`invalidateCache`/`prefetchJson`/`runWhenIdle` from `lib/clientCache.js`.
- Produces: a page at `/sales-tally` reachable directly by URL (not yet linked from nav — Task 8 adds the nav link and the "Manage menu" tab alongside it).

- [ ] **Step 1: Add the new BN translation keys**

In `lib/i18n.js`, add this block inside the `BN` object (anywhere before its closing `};` — e.g. right after the existing `// ---- Products (app/products/page.js) ----` block):

```js
  // ---- Sales Tally (app/sales-tally/page.js) ----
  'Batch': 'ব্যাচ',
  'Remove': 'বাদ দিন',
  'Qty made': 'কতটি তৈরি হয়েছে',
  'Add batch': 'ব্যাচ যোগ করুন',
  'Single': 'একক',
  'Double': 'দ্বিগুণ',
  'Bowls sold': 'কতটি বাটি বিক্রি হয়েছে',
  'Qty sold': 'বিক্রীত পরিমাণ',
  'Reconciliation': 'হিসাব মিলানো',
  'Computed total': 'হিসাব করা মোট',
  'Actual sales': 'বাস্তব বিক্রয়',
  'Variance': 'পার্থক্য',
  'Looking good — well within range.': 'ভালোই আছে — সীমার মধ্যে।',
  'A bit off — worth checking when you can.': 'কিছুটা গরমিল — সময় পেলে একবার দেখুন।',
  'Off by a lot — please double check the counts.': 'অনেকটা গরমিল — গণনা আবার যাচাই করুন।',
  'Cash entry not saved for this day yet.': 'এই দিনের ক্যাশ হিসাব এখনও সংরক্ষিত হয়নি।',
```

- [ ] **Step 2: Write the page**

Create `app/sales-tally/page.js`:

```jsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../AppShell';
import { todayStr, shiftDateStr } from '@/lib/dates';
import { useLang } from '../LangProvider';
import NumberInput from '../NumberInput';
import { cachedFetchJson, peekCache, invalidateCache, prefetchJson, runWhenIdle } from '@/lib/clientCache';

function tallyUrl(d) {
  return `/api/sales-tally?date=${d}`;
}

export default function SalesTallyPage() {
  const { t, taka, digits, dateDisplay } = useLang();
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batchQty, setBatchQty] = useState({});

  const requestRef = useRef(0);

  const loadTally = useCallback(async (d) => {
    const url = tallyUrl(d);
    const requestId = ++requestRef.current;
    const cached = peekCache(url);
    if (cached) setData(cached);
    else setLoading(true);
    try {
      const json = await cachedFetchJson(url);
      if (requestRef.current !== requestId) return;
      setData(json);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => { loadTally(date); }, [date, loadTally]);

  useEffect(() => {
    if (loading) return;
    runWhenIdle(() => {
      prefetchJson(tallyUrl(shiftDateStr(date, -1)));
      prefetchJson(tallyUrl(shiftDateStr(date, 1)));
    });
  }, [date, loading]);

  async function addBatch(item) {
    const qty = batchQty[item.id];
    if (!qty || Number(qty) <= 0) return;
    setSaving(true);
    await fetch('/api/sales-tally/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, itemId: item.id, quantity: qty }),
    });
    setBatchQty((prev) => ({ ...prev, [item.id]: '' }));
    setSaving(false);
    invalidateCache(tallyUrl(date));
    loadTally(date);
  }

  async function deleteBatch(entryId) {
    setSaving(true);
    await fetch(`/api/sales-tally/entries?id=${entryId}`, { method: 'DELETE' });
    setSaving(false);
    invalidateCache(tallyUrl(date));
    loadTally(date);
  }

  async function saveBowlCount(item, singleCount, doubleCount) {
    setSaving(true);
    await fetch('/api/sales-tally/bowl-count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, itemId: item.id, singleCount, doubleCount }),
    });
    setSaving(false);
    invalidateCache(tallyUrl(date));
    loadTally(date);
  }

  const statusClass = { good: 'green', warning: 'amber', danger: 'red' };

  return (
    <AppShell>
      <div className="day-nav">
        <button onClick={() => setDate(shiftDateStr(date, -1))}>‹</button>
        <div className="date-display">{dateDisplay(date)}</div>
        <button onClick={() => setDate(shiftDateStr(date, 1))}>›</button>
      </div>

      {loading || !data ? (
        <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
      ) : data.items.length === 0 ? (
        <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No menu items yet — add some under "Manage menu".')}</p>
      ) : (
        <>
          {data.items.map((item) => (
            <div className="card" key={item.id}>
              <div className="card-title">{item.name}</div>

              {item.trackingMode === 'production' ? (
                <>
                  {item.entries.length > 0 && (
                    <table className="denom-table">
                      <thead><tr><th>{t('Batch')}</th><th></th></tr></thead>
                      <tbody>
                        {item.entries.map((entry) => (
                          <tr key={entry.id}>
                            <td>{digits(String(entry.quantity))}</td>
                            <td>
                              <button
                                className="btn secondary"
                                style={{ padding: '4px 9px', fontSize: 11 }}
                                aria-label={t('Remove')}
                                onClick={() => deleteBatch(entry.id)}
                                disabled={saving}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: item.entries.length > 0 ? 10 : 0 }}>
                    <NumberInput
                      value={batchQty[item.id] ?? ''}
                      min={0}
                      placeholder={t('Qty made')}
                      onValueChange={(n) => setBatchQty((prev) => ({ ...prev, [item.id]: n }))}
                    />
                    <button className="btn" onClick={() => addBatch(item)} disabled={saving}>{t('Add batch')}</button>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                    <label>{item.trackingMode === 'bowl_double' ? t('Single') : t('Bowls sold')}</label>
                    <NumberInput
                      value={item.singleCount}
                      min={0}
                      onValueChange={() => {}}
                      onBlur={(n) => { if (n != null) saveBowlCount(item, n, item.doubleCount); }}
                    />
                  </div>
                  {item.trackingMode === 'bowl_double' && (
                    <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                      <label>{t('Double')}</label>
                      <NumberInput
                        value={item.doubleCount}
                        min={0}
                        onValueChange={() => {}}
                        onBlur={(n) => { if (n != null) saveBowlCount(item, item.singleCount, n); }}
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="kpi-row" style={{ marginTop: 12 }}>
                <div className="kpi"><div className="kpi-label">{t('Qty sold')}</div><div className="kpi-value">{digits(String(item.quantitySold))}</div></div>
                <div className="kpi"><div className="kpi-label">{t('Value')}</div><div className="kpi-value">{taka(item.value)}</div></div>
              </div>
            </div>
          ))}

          <div className="card">
            <div className="card-title">{t('Reconciliation')}</div>
            <div className={`insight ${data.hasCashEntry ? statusClass[data.status] : 'amber'}`}>
              <div className="result-row"><span>{t('Computed total')}</span><b>{taka(data.computedTotal)}</b></div>
              {data.hasCashEntry ? (
                <>
                  <div className="result-row"><span>{t('Actual sales')}</span><b>{taka(data.actualSales)}</b></div>
                  <div className="result-row"><span>{t('Variance')}</span><b>{taka(data.variance)}</b></div>
                  {data.status === 'good' && <p style={{ margin: '8px 0 0' }}>{t('Looking good — well within range.')}</p>}
                  {data.status === 'warning' && <p style={{ margin: '8px 0 0' }}>{t('A bit off — worth checking when you can.')}</p>}
                  {data.status === 'danger' && <p style={{ margin: '8px 0 0' }}>{t('Off by a lot — please double check the counts.')}</p>}
                </>
              ) : (
                <p style={{ margin: 0 }}>{t('Cash entry not saved for this day yet.')}</p>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}
```

- [ ] **Step 3: Run the full test suite (checks the i18n BN-dict validity test still passes)**

Run: `npm test`
Expected: PASS — `lib/i18n.test.js`'s "every BN entry is a non-empty string and not identical to its key" check passes for the new keys too.

- [ ] **Step 4: Rebuild the app container and smoke-check the route**

```bash
docker compose -f docker-compose.dev.yml up -d --build app
curl -s -o /dev/null -w '%{http_code}\n' -b jar.txt http://localhost:3000/sales-tally
```
Expected: `200`.

- [ ] **Step 5: Commit**

```bash
git add app/sales-tally/page.js lib/i18n.js
git commit -m "Add /sales-tally page: today's production/bowl-count tally + reconciliation"
```

---

## Task 8: Manage Menu tab, nav link, and old-page cleanup

**Files:**
- Modify: `app/sales-tally/page.js` (add the tab toggle + Manage Menu tab)
- Modify: `app/AppShell.js:14` (nav entry)
- Modify: `lib/i18n.js` (add nav/menu-tab keys, remove dead keys from the old page)
- Modify: `app/globals.css` (small select style)
- Delete: `app/products/page.js`
- Delete: `app/api/daily-sales/route.js`

**Interfaces:**
- Consumes: `/api/products` GET/POST (Task 3); everything from Task 7.
- Produces: the finished `/sales-tally` page with both tabs; `/products` route and `/api/daily-sales` route no longer exist.

- [ ] **Step 1: Update the i18n dictionary**

In `lib/i18n.js`:

Remove these now-dead entries (only ever used by the old `app/products/page.js`, which this task deletes) from the `BN` object: `'Daily quantities'`, `'How many sold today'`, `'Total units sold'`, `'Menu value'`, `'Save quantities'`, `'/unit'`, `'Saved.'`.

Change the nav label entry from:
```js
  'Products': 'পণ্য',
```
to:
```js
  'Sales Tally': 'বিক্রয় হিসাব',
```

Add these new entries (in the same "Sales Tally" block added in Task 7):
```js
  "Today's tally": 'আজকের হিসাব',
  'Tracking': 'পদ্ধতি',
  'Production (batches)': 'উৎপাদন (ব্যাচ)',
  'Bowl count': 'বাটি গণনা',
  'Bowl count (single + double)': 'বাটি গণনা (একক + দ্বিগুণ)',
```

- [ ] **Step 2: Update the nav entry**

In `app/AppShell.js`, change line 14 from:
```js
  { href: '/products', label: 'Products' },
```
to:
```js
  { href: '/sales-tally', label: 'Sales Tally' },
```

- [ ] **Step 3: Add the tracking-mode select style**

In `app/globals.css`, add this rule right after the existing `.field input, .field select { ... }` block (around line 58-61):
```css
.tracking-mode-select {
  font-family: var(--mono); font-size: 11.5px; padding: 5px 6px; border-radius: 6px;
  border: 1px solid var(--border2); background: var(--bg3); color: var(--text);
}
```

- [ ] **Step 4: Rewrite `app/sales-tally/page.js` with tabs + Manage Menu**

Replace the entire contents of `app/sales-tally/page.js` with:

```jsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import AppShell from '../AppShell';
import { todayStr, shiftDateStr } from '@/lib/dates';
import { useLang } from '../LangProvider';
import NumberInput from '../NumberInput';
import { cachedFetchJson, peekCache, invalidateCache, prefetchJson, runWhenIdle } from '@/lib/clientCache';

function tallyUrl(d) {
  return `/api/sales-tally?date=${d}`;
}
const MENU_URL = '/api/products';
const TRACKING_MODES = ['production', 'bowl_single', 'bowl_double'];

export default function SalesTallyPage() {
  const { t, taka, digits, dateDisplay } = useLang();
  const [tab, setTab] = useState('tally');
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [batchQty, setBatchQty] = useState({});
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');

  const requestRef = useRef(0);

  const loadTally = useCallback(async (d) => {
    const url = tallyUrl(d);
    const requestId = ++requestRef.current;
    const cached = peekCache(url);
    if (cached) setData(cached);
    else setLoading(true);
    try {
      const json = await cachedFetchJson(url);
      if (requestRef.current !== requestId) return;
      setData(json);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  const loadMenu = useCallback(async () => {
    const requestId = ++requestRef.current;
    const cached = peekCache(MENU_URL);
    if (cached) setMenuItems(cached.items || []);
    else setLoading(true);
    try {
      const json = await cachedFetchJson(MENU_URL);
      if (requestRef.current !== requestId) return;
      setMenuItems(json.items || []);
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'tally') loadTally(date);
    else loadMenu();
  }, [tab, date, loadTally, loadMenu]);

  useEffect(() => {
    if (tab !== 'tally' || loading) return;
    runWhenIdle(() => {
      prefetchJson(tallyUrl(shiftDateStr(date, -1)));
      prefetchJson(tallyUrl(shiftDateStr(date, 1)));
    });
  }, [tab, date, loading]);

  async function addBatch(item) {
    const qty = batchQty[item.id];
    if (!qty || Number(qty) <= 0) return;
    setSaving(true);
    await fetch('/api/sales-tally/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, itemId: item.id, quantity: qty }),
    });
    setBatchQty((prev) => ({ ...prev, [item.id]: '' }));
    setSaving(false);
    invalidateCache(tallyUrl(date));
    loadTally(date);
  }

  async function deleteBatch(entryId) {
    setSaving(true);
    await fetch(`/api/sales-tally/entries?id=${entryId}`, { method: 'DELETE' });
    setSaving(false);
    invalidateCache(tallyUrl(date));
    loadTally(date);
  }

  async function saveBowlCount(item, singleCount, doubleCount) {
    setSaving(true);
    await fetch('/api/sales-tally/bowl-count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, itemId: item.id, singleCount, doubleCount }),
    });
    setSaving(false);
    invalidateCache(tallyUrl(date));
    loadTally(date);
  }

  async function addMenuItem() {
    if (!newName || !newPrice) return;
    setSaving(true);
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, price: Number(newPrice) }),
    });
    setNewName('');
    setNewPrice('');
    setSaving(false);
    invalidateCache(MENU_URL);
    loadMenu();
  }

  async function updatePrice(item, newPriceValue) {
    if (newPriceValue === '' || isNaN(Number(newPriceValue))) return;
    setSaving(true);
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id, name: item.name, price: Number(newPriceValue),
        active: item.active, sortOrder: item.sort_order, trackingMode: item.tracking_mode,
      }),
    });
    setSaving(false);
    invalidateCache(MENU_URL);
    loadMenu();
  }

  async function toggleActive(item) {
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id, name: item.name, price: item.price,
        active: !item.active, sortOrder: item.sort_order, trackingMode: item.tracking_mode,
      }),
    });
    invalidateCache(MENU_URL);
    loadMenu();
  }

  async function updateTrackingMode(item, trackingMode) {
    setSaving(true);
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id, name: item.name, price: item.price,
        active: item.active, sortOrder: item.sort_order, trackingMode,
      }),
    });
    setSaving(false);
    invalidateCache(MENU_URL);
    loadMenu();
  }

  const statusClass = { good: 'green', warning: 'amber', danger: 'red' };
  const trackingLabel = {
    production: t('Production (batches)'),
    bowl_single: t('Bowl count'),
    bowl_double: t('Bowl count (single + double)'),
  };

  return (
    <AppShell>
      <div className="toggle-row">
        <button className={tab === 'tally' ? 'on' : ''} onClick={() => setTab('tally')}>{t("Today's tally")}</button>
        <button className={tab === 'menu' ? 'on' : ''} onClick={() => setTab('menu')}>{t('Manage menu')}</button>
      </div>

      {tab === 'tally' ? (
        <>
          <div className="day-nav">
            <button onClick={() => setDate(shiftDateStr(date, -1))}>‹</button>
            <div className="date-display">{dateDisplay(date)}</div>
            <button onClick={() => setDate(shiftDateStr(date, 1))}>›</button>
          </div>

          {loading || !data ? (
            <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
          ) : data.items.length === 0 ? (
            <p style={{ color: 'var(--text2)', fontSize: 13 }}>{t('No menu items yet — add some under "Manage menu".')}</p>
          ) : (
            <>
              {data.items.map((item) => (
                <div className="card" key={item.id}>
                  <div className="card-title">{item.name}</div>

                  {item.trackingMode === 'production' ? (
                    <>
                      {item.entries.length > 0 && (
                        <table className="denom-table">
                          <thead><tr><th>{t('Batch')}</th><th></th></tr></thead>
                          <tbody>
                            {item.entries.map((entry) => (
                              <tr key={entry.id}>
                                <td>{digits(String(entry.quantity))}</td>
                                <td>
                                  <button
                                    className="btn secondary"
                                    style={{ padding: '4px 9px', fontSize: 11 }}
                                    aria-label={t('Remove')}
                                    onClick={() => deleteBatch(entry.id)}
                                    disabled={saving}
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: item.entries.length > 0 ? 10 : 0 }}>
                        <NumberInput
                          value={batchQty[item.id] ?? ''}
                          min={0}
                          placeholder={t('Qty made')}
                          onValueChange={(n) => setBatchQty((prev) => ({ ...prev, [item.id]: n }))}
                        />
                        <button className="btn" onClick={() => addBatch(item)} disabled={saving}>{t('Add batch')}</button>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                        <label>{item.trackingMode === 'bowl_double' ? t('Single') : t('Bowls sold')}</label>
                        <NumberInput
                          value={item.singleCount}
                          min={0}
                          onValueChange={() => {}}
                          onBlur={(n) => { if (n != null) saveBowlCount(item, n, item.doubleCount); }}
                        />
                      </div>
                      {item.trackingMode === 'bowl_double' && (
                        <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                          <label>{t('Double')}</label>
                          <NumberInput
                            value={item.doubleCount}
                            min={0}
                            onValueChange={() => {}}
                            onBlur={(n) => { if (n != null) saveBowlCount(item, item.singleCount, n); }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="kpi-row" style={{ marginTop: 12 }}>
                    <div className="kpi"><div className="kpi-label">{t('Qty sold')}</div><div className="kpi-value">{digits(String(item.quantitySold))}</div></div>
                    <div className="kpi"><div className="kpi-label">{t('Value')}</div><div className="kpi-value">{taka(item.value)}</div></div>
                  </div>
                </div>
              ))}

              <div className="card">
                <div className="card-title">{t('Reconciliation')}</div>
                <div className={`insight ${data.hasCashEntry ? statusClass[data.status] : 'amber'}`}>
                  <div className="result-row"><span>{t('Computed total')}</span><b>{taka(data.computedTotal)}</b></div>
                  {data.hasCashEntry ? (
                    <>
                      <div className="result-row"><span>{t('Actual sales')}</span><b>{taka(data.actualSales)}</b></div>
                      <div className="result-row"><span>{t('Variance')}</span><b>{taka(data.variance)}</b></div>
                      {data.status === 'good' && <p style={{ margin: '8px 0 0' }}>{t('Looking good — well within range.')}</p>}
                      {data.status === 'warning' && <p style={{ margin: '8px 0 0' }}>{t('A bit off — worth checking when you can.')}</p>}
                      {data.status === 'danger' && <p style={{ margin: '8px 0 0' }}>{t('Off by a lot — please double check the counts.')}</p>}
                    </>
                  ) : (
                    <p style={{ margin: 0 }}>{t('Cash entry not saved for this day yet.')}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <div className="card">
          <div className="card-title">{t('Menu items')}</div>
          {loading ? (
            <p style={{ color: 'var(--text2)' }}>{t('Loading…')}</p>
          ) : (
            <>
              <table className="denom-table">
                <thead><tr><th>{t('Item')}</th><th>{t('Price (৳)')}</th><th>{t('Tracking')}</th><th>{t('Active')}</th></tr></thead>
                <tbody>
                  {menuItems.map((item) => (
                    <tr key={item.id} style={{ opacity: item.active ? 1 : 0.5 }}>
                      <td>{item.name}</td>
                      <td>
                        <NumberInput
                          value={item.price} min={0} className=""
                          style={{ width: 80 }}
                          onValueChange={() => {}}
                          onBlur={(n) => { if (n != null && n !== Number(item.price)) updatePrice(item, n); }}
                        />
                      </td>
                      <td>
                        <select
                          className="tracking-mode-select"
                          value={item.tracking_mode}
                          onChange={(e) => updateTrackingMode(item, e.target.value)}
                        >
                          {TRACKING_MODES.map((mode) => (
                            <option key={mode} value={mode}>{trackingLabel[mode]}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button className="btn secondary" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => toggleActive(item)}>
                          {item.active ? t('Hide') : t('Show')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>{t('Edit a price and click away from the field to save it.')}</p>
            </>
          )}

          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div className="card-title">{t('Add a new item')}</div>
            <div className="field">
              <label>{t('Name')}</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('e.g. Chicken Roll')} />
            </div>
            <div className="field">
              <label>{t('Price (৳)')}</label>
              <NumberInput value={newPrice} min={0} placeholder={t('e.g. 50')} onValueChange={(n) => setNewPrice(n == null ? '' : String(n))} />
            </div>
            <button className="btn block" onClick={addMenuItem} disabled={saving || !newName || !newPrice}>{t('Add item')}</button>
          </div>
        </div>
      )}
    </AppShell>
  );
}
```

- [ ] **Step 5: Delete the old page and route**

```bash
git rm app/products/page.js
git rm -r app/api/daily-sales
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Rebuild and verify the full stack**

```bash
docker compose -f docker-compose.dev.yml up -d --build
curl -s -o /dev/null -w '%{http_code}\n' -b jar.txt http://localhost:3000/sales-tally
curl -s -o /dev/null -w '%{http_code}\n' -b jar.txt http://localhost:3000/products
```
Expected: `/sales-tally` → `200`; `/products` → `404` (page removed).

```bash
PARCEL_ID=$(docker compose -f docker-compose.dev.yml exec -T db psql -U soupresso -d soupresso -t -c \
  "SELECT id FROM menu_items WHERE name = 'Parcel Soup (Thai Soup, to go)';" | tr -d ' ')

curl -s -b jar.txt -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"id":'"$PARCEL_ID"',"name":"Parcel Soup (Thai Soup, to go)","price":75,"active":true,"sortOrder":1,"trackingMode":"bowl_double"}'
```
Expected: `{"item": {..., "price": "75.00", "tracking_mode": "bowl_double", ...}}` — Manage Menu's price edit still round-trips end-to-end through the same `/api/products` route.

- [ ] **Step 8: Commit**

```bash
git add app/sales-tally/page.js app/AppShell.js lib/i18n.js app/globals.css
git commit -m "Add Manage Menu tab + nav link; remove old Products page and /api/daily-sales"
```

---

## Task 9: Whole-feature verification and handoff

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated test suite**

Run: `npm test`
Expected: every test file passes, including `lib/sales-tally.test.js` and `lib/i18n.test.js`.

- [ ] **Step 2: Run a production build**

Run: `npm run build`
Expected: builds cleanly, no errors. (Run this on the host, not just inside the Docker image build from Task 2 — confirms the code builds outside the container too.)

- [ ] **Step 3: Fresh end-to-end Docker verification**

```bash
docker compose -f docker-compose.dev.yml down -v   # wipe the volume so schema.sql re-runs from a clean DB
docker compose -f docker-compose.dev.yml up -d --build
```
Expected: containers start clean; `docker compose -f docker-compose.dev.yml exec db psql -U soupresso -d soupresso -c "SELECT name, price, tracking_mode FROM menu_items ORDER BY sort_order;"` shows Parcel Soup (`bowl_double`) and Thai Soup (`bowl_single`) seeded correctly from `schema.sql` alone (no manual fixups).

```bash
curl -s -c jar.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@soupresso.local","password":"devpass123"}'

docker compose -f docker-compose.dev.yml exec db psql -U soupresso -d soupresso -c \
  "INSERT INTO daily_entries (entry_date, total_counted, total_sales) VALUES ('2026-10-01', 500, 500) ON CONFLICT (entry_date) DO UPDATE SET total_sales = 500;"

NACHOS_ID=$(docker compose -f docker-compose.dev.yml exec -T db psql -U soupresso -d soupresso -t -c \
  "SELECT id FROM menu_items WHERE name = 'Nachos';" | tr -d ' ')
SOUP_ID=$(docker compose -f docker-compose.dev.yml exec -T db psql -U soupresso -d soupresso -t -c \
  "SELECT id FROM menu_items WHERE name = 'Thai Soup (Chicken & Mushroom)';" | tr -d ' ')

curl -s -b jar.txt -X POST http://localhost:3000/api/sales-tally/entries \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-10-01\",\"itemId\":$NACHOS_ID,\"quantity\":5}"
curl -s -b jar.txt -X POST http://localhost:3000/api/sales-tally/bowl-count \
  -H "Content-Type: application/json" \
  -d "{\"date\":\"2026-10-01\",\"itemId\":$SOUP_ID,\"singleCount\":0,\"doubleCount\":0}"

curl -s -b jar.txt "http://localhost:3000/api/sales-tally?date=2026-10-01" | python3 -m json.tool
```
Expected: Nachos shows one entry of quantity 5, `computedTotal = 5*100 = 500` (Nachos is ৳100 per the seed menu), `hasCashEntry: true`, `actualSales: 500`, `variance: 0`, `status: "good"` — a clean end-to-end pass on a completely fresh database, confirming `schema.sql`'s migration order and every route work together from a cold start, not just incrementally on top of manual fixups from earlier tasks.

- [ ] **Step 4: Confirm the working tree is clean**

```bash
git status
```
Expected: clean (everything from Tasks 1-8 committed); `Dockerfile`, `docker-compose.dev.yml`, `.dockerignore`, and `jar.txt` do not show as untracked-and-uncommitted concerns since the first three are gitignored — but if `jar.txt` (the curl cookie jar) was created inside the repo directory during testing, delete it: `rm -f jar.txt` (it's a throwaway credential file, never commit it).

- [ ] **Step 5: Hand off for manual verification**

Per this project's established testing workflow, do not drive a browser directly — instead tell the user:
- The Docker stack is running at `http://localhost:3000` (login `dev@soupresso.local` / `devpass123`).
- Ask them to click through `/sales-tally`: add a couple of production batches, delete one, set a Soup bowl count and a Parcel Soup single+double count, and check the Manage Menu tab's tracking-mode selector and Parcel Soup's price (currently the ৳70 placeholder from Task 2 — remind them to correct it to the real price here).
- Once they confirm it looks right, ask whether to proceed to deploying (per this project's operational constraint, production deploys go through a feature branch + PR for a Vercel preview, never a direct push to `main` — see `docs/superpowers/plans/../CLAUDE.md`-equivalent memory, or just ask the user directly since no CLAUDE.md exists in this repo).
