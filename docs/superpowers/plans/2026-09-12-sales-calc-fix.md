# Sales-Calc Fix, Wizard Reorder, Closer Names, Bhangti Suggestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the sales-calculation formula so it correctly nets out chef bazar-settlement cash movements, reorder the wizard so the sales figure shown is always final, add an optional "who closed the hishab" multi-select, and suggest tomorrow's bhangti from today's denomination count.

**Architecture:** One formula fix in the single source-of-truth `lib/cash-math.js` (used by both the client preview and the API). One additive, idempotent schema migration. Everything else is UI wiring in `app/entry/page.js` and its API route.

**Tech Stack:** Next.js 14.2.35, plain JavaScript, raw SQL via `pg`. Tests: `node --test` (existing suite).

**Spec:** `docs/superpowers/specs/2026-09-12-sales-calc-fix-design.md`

## Global Constraints

- No change to any already-stored value. The 19 seeded historical rows (Aug 11–Sep 2) are never
  touched by this work — no backfill, no migration script that rewrites `total_sales` /
  `cash_taken_home` on existing rows.
- The formula lives in exactly one place, `lib/cash-math.js`, imported by both
  `app/entry/page.js` (live preview) and `app/api/entries/route.js` (save) — never duplicate it.
- `closed_by` is optional everywhere: not required to save, no server-side validation beyond
  "array of strings if present," the 15-name list is a UI convenience only.
- The bhangti suggestion never auto-applies — it only pre-fills `nextBhangti` on an explicit
  click; the field stays a normal, freely-editable `NumberInput` afterward.
- Per the user's standing preference, do not do exhaustive in-browser/Playwright verification.
  Verify with `npm test`, `npm run build`, and targeted `curl` checks against the running
  Docker stack. End-to-end / visual verification is the user's own manual pass.
- This plan is executed inline (no subagent dispatch) — the executor already has full,
  first-hand knowledge of every file below from reading them immediately before writing this
  plan; splitting into subagent dispatches would add review-cycle overhead with no
  fresh-eyes benefit here, consistent with the user's efficiency request.

---

### Task 1: Fix `lib/cash-math.js` and add its test file

**Files:**
- Modify: `lib/cash-math.js`
- Create: `lib/cash-math.test.js`

**Interfaces:**
- `computeCashSummary(...)` return shape changes: drops `bazarVarianceLabel` (dead field, no
  remaining call site anywhere in the app — confirmed by `grep -rn bazarVarianceLabel app/`
  returning nothing before this change). Keeps `totalSales`, `bazarVariance`, `cashTakenHome`,
  `isShort`.

- [ ] **Step 1: Write the failing tests**

Create `lib/cash-math.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCashSummary, denominationTotal } from './cash-math.js';

test('computeCashSummary: zero variance', () => {
  const s = computeCashSummary({
    totalCounted: 5000, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 1000,
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(s.bazarVariance, 0);
  assert.equal(s.totalSales, 4500);      // 5000 - 500 + 0
  assert.equal(s.cashTakenHome, 3500);   // 5000 - 1000 - 500
});

test('computeCashSummary: chef needed extra (positive variance) is added back into sales, not double-subtracted from cash taken home', () => {
  const s = computeCashSummary({
    totalCounted: 4800, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 1200,
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(s.bazarVariance, 200);
  assert.equal(s.totalSales, 4500);      // 4800 - 500 + 200 -- same true sales as the zero-variance case
  assert.equal(s.cashTakenHome, 3300);   // 4800 - 1000 - 500 (NOT 4800 - 200 - 1000 - 500 = 3100)
});

test('computeCashSummary: chef returned money (negative variance) is subtracted from sales', () => {
  const s = computeCashSummary({
    totalCounted: 5100, openingBhangti: 500,
    bazarAdvanceReceived: 1000, bazarActualCost: 800,
    nextBazarAdvance: 1000, nextBhangti: 500,
  });
  assert.equal(s.bazarVariance, -200);
  assert.equal(s.totalSales, 4400);      // 5100 - 500 - 200
  assert.equal(s.cashTakenHome, 3600);   // 5100 - 1000 - 500
});

test('computeCashSummary: isShort boundary', () => {
  assert.equal(computeCashSummary({ totalCounted: 100, nextBazarAdvance: 50, nextBhangti: 51 }).isShort, true);
  assert.equal(computeCashSummary({ totalCounted: 100, nextBazarAdvance: 50, nextBhangti: 50 }).isShort, false);
});

test('computeCashSummary: no args defaults to all zero', () => {
  const s = computeCashSummary();
  assert.equal(s.totalSales, 0);
  assert.equal(s.cashTakenHome, 0);
  assert.equal(s.isShort, false);
});

test('computeCashSummary: no longer returns bazarVarianceLabel', () => {
  const s = computeCashSummary({ totalCounted: 100 });
  assert.equal('bazarVarianceLabel' in s, false);
});

test('denominationTotal: sums note*qty', () => {
  assert.equal(denominationTotal({ 1000: 2, 500: 1, 50: 3 }), 2650);
});

test('denominationTotal: empty/partial/null-safe', () => {
  assert.equal(denominationTotal({}), 0);
  assert.equal(denominationTotal(null), 0);
  assert.equal(denominationTotal({ 100: 0, 50: 2 }), 100);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — `totalSales`/`cashTakenHome` values don't match (old formula), and the
`bazarVarianceLabel` test fails because the field is still present.

- [ ] **Step 3: Implement the fix in `lib/cash-math.js`**

Replace the file's header comment and `computeCashSummary` with:

```js
// The exact cash-reconciliation logic, in one place so the entry form
// (live preview) and the API (source of truth on save) can never disagree.
//
// Terminology, deliberately precise:
//   - "Bazar variance" is actual_cost minus advance_received. Positive means
//     the chef needed extra money for bazar and was topped up from the box
//     (today or as part of closing); negative means the chef returned unspent
//     advance to the box. Either way, that movement is a chef-settlement, not
//     a sale.
//   - "Total Sales" is total_counted minus opening_bhangti, adjusted by
//     bazar_variance so a chef top-up/return never inflates or deflates the
//     reported sales figure: total_counted - opening_bhangti + bazar_variance.
//     Not revenue, not profit — gross cash collected today, net of the
//     chef-settlement noise.
//   - "Cash taken home" is simply what's left in the box now, minus what's
//     set aside for tomorrow's bazar advance and bhangti float. It does not
//     need to account for bazar_variance separately — total_counted already
//     reflects however that settlement happened.

export function computeCashSummary({
  totalCounted = 0,
  openingBhangti = 0,
  bazarAdvanceReceived = 0,
  bazarActualCost = 0,
  nextBazarAdvance = 0,
  nextBhangti = 0,
} = {}) {
  const bazarVariance = round2(bazarActualCost - bazarAdvanceReceived);
  const totalSales = round2(totalCounted - openingBhangti + bazarVariance);
  const cashTakenHome = round2(totalCounted - nextBazarAdvance - nextBhangti);

  return {
    totalSales,
    bazarVariance,
    cashTakenHome,
    isShort: cashTakenHome < 0,
  };
}
```

Leave `denominationTotal`, `round2`, and `STANDARD_DENOMINATIONS` untouched.

- [ ] **Step 4: Run to verify pass**

Run: `npm test`
Expected: PASS, all tests including the pre-existing `lib/numerals.test.js` / `lib/i18n.test.js`
(13 tests) plus this file's 8 new ones.

- [ ] **Step 5: Update the two doc comments that describe the old formula**

In `schema.sql`, update the comments on the `daily_entries` columns (do not touch the SQL
itself, comment-only):

```sql
  -- Step 2: today's sale = total_counted - opening_bhangti + bazar_variance
  opening_bhangti     NUMERIC(12,2) NOT NULL DEFAULT 0,   -- float carried from yesterday's next_bhangti
```
and
```sql
  total_sales         NUMERIC(12,2) NOT NULL DEFAULT 0,   -- total_counted - opening_bhangti + bazar_variance
  bazar_variance       NUMERIC(12,2) NOT NULL DEFAULT 0,   -- bazar_actual_cost - bazar_advance_received
  cash_taken_home      NUMERIC(12,2) NOT NULL DEFAULT 0,   -- total_counted - next_bazar_advance - next_bhangti
```

In `README.md`, under "## The math, precisely", replace the three bullet points with:

```markdown
- **Total Sales** = total counted in the box − opening bhangti (the float
  kept from yesterday) + bazar variance (see below). The variance term keeps
  a chef top-up or refund from inflating or deflating the reported figure.
  Nothing else — not revenue, not profit.
- **Bazar variance** = actual bazar cost − bazar advance received. Positive
  means the chef needed more money; negative means the chef returns the
  difference.
- **Cash taken home** = total counted − tomorrow's bazar advance − tomorrow's
  bhangti. (It does not subtract bazar variance again — total counted already
  reflects however that settlement happened.)
```

- [ ] **Step 6: Commit**

```bash
git add lib/cash-math.js lib/cash-math.test.js schema.sql README.md
git commit -m "Fix sales formula to net out bazar-variance chef settlements"
```

---

### Task 2: Additive `closed_by` migration

**Files:**
- Modify: `schema.sql`

- [ ] **Step 1: Add the idempotent migration**

Append, right after the existing `is_off_day` migration line at the bottom of `schema.sql`:

```sql
-- If your database already has daily_entries without closed_by, run this:
ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS closed_by TEXT[] NOT NULL DEFAULT '{}';
```

- [ ] **Step 2: Apply it to the local test Postgres**

Run (the executor's local dev DB from earlier work, port 5544 — adjust `psql`/path if a
different local Postgres is in use; do NOT run this against any production connection string):

```bash
PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH" PGHOST=localhost PGPORT=5544 PGUSER=soupresso PGDATABASE=soupresso psql -c "ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS closed_by TEXT[] NOT NULL DEFAULT '{}';"
```

Verify: `... psql -c "\d daily_entries"` shows `closed_by` as `text[]`.

- [ ] **Step 3: Commit**

```bash
git add schema.sql
git commit -m "Add closed_by column for optional hishab-closer attribution"
```

---

### Task 3: Wizard reorder (Bazar before Sales)

**Files:**
- Modify: `app/entry/page.js`

- [ ] **Step 1: Swap the step order**

In `app/entry/page.js`:

1. Change `stepLabels` (currently `['Count box', 'Sales', 'Bazar', 'Tomorrow', 'Review']`) to
   `['Count box', 'Bazar', 'Sales', 'Tomorrow', 'Review']`.
2. Swap the guard conditions on the two step-content blocks: the block currently guarded
   `step === 1` (card title `"Today's total sales"`, opening-bhangti field, sales calc-row) →
   change its guard to `step === 2`. The block currently guarded `step === 2` (card title
   `"Settle yesterday's bazar"`, advance/actual fields, variance step-result) → change its
   guard to `step === 1`.
3. Do not change `step === 0`, `step === 3`, `step === 4`, or any state/handler — only the two
   guard conditions and the label array move.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: success (this is a JSX-only change, no new imports).

- [ ] **Step 3: Commit**

```bash
git add app/entry/page.js
git commit -m "Reorder wizard: settle bazar before showing today's sales"
```

---

### Task 4: Bhangti suggestion from today's denomination count

**Files:**
- Modify: `app/entry/page.js`
- Modify: `app/globals.css`
- Modify: `lib/i18n.js`

**Interfaces:**
- Consumes: `denominationTotal` from `@/lib/cash-math` (already imported in `app/entry/page.js`).

- [ ] **Step 1: Add the two new i18n keys**

Add to `lib/i18n.js`'s `BN` object (anywhere in the Daily Entry section is fine):

```js
  'Suggested bhangti': 'প্রস্তাবিত ভাংতি',
  'Use this amount': 'এই পরিমাণ ব্যবহার করুন',
  'Total': 'মোট',
```

(Confirmed by `grep -n "'Total':" lib/i18n.js` returning nothing — the key does not already
exist under this exact casing, so it must be added here, not assumed.)

- [ ] **Step 2: Compute the suggestion in `app/entry/page.js`**

Add, near the existing `totalCounted`/`summary` derivation (after the `summary` `const`, before
the `handleSave` function):

```js
  const SMALL_NOTES = STANDARD_DENOMINATIONS.filter((d) => d <= 50); // 50,20,10,5,2,1
  const suggestedBhangtiNotes = mode === 'denom'
    ? SMALL_NOTES.filter((d) => (denoms[d] || 0) > 0).map((d) => ({ d, qty: denoms[d], subtotal: d * denoms[d] }))
    : [];
  const suggestedBhangtiTotal = suggestedBhangtiNotes.reduce((sum, n) => sum + n.subtotal, 0);
```

(`STANDARD_DENOMINATIONS` is already imported; `denominationTotal` is not needed here since we
already have the per-note breakdown in `denoms` — summing the filtered list directly is
simpler and gives us the per-note rows to render too.)

- [ ] **Step 3: Render the suggestion card**

In the (now, after Task 3) `step === 3` "Tomorrow" block, insert the suggestion card between
the card-title and the `next_bazar_advance` field, only when there's something to suggest:

```jsx
{mode === 'denom' && suggestedBhangtiNotes.length > 0 && (
  <div className="step-result" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
    <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--text2)' }}>{t('Suggested bhangti')}</div>
    {suggestedBhangtiNotes.map((n) => (
      <div key={n.d} className="calc-row" style={{ padding: '2px 0' }}>
        <span>{'৳'}{digits(String(n.d))} × {num(n.qty)}</span>
        <span>{taka(n.subtotal)}</span>
      </div>
    ))}
    <div className="calc-row result" style={{ padding: '6px 0' }}>
      <span>{t('Total')}</span>
      <span>{taka(suggestedBhangtiTotal)}</span>
    </div>
    <button type="button" className="btn secondary" onClick={() => setNextBhangti(suggestedBhangtiTotal)}>
      {t('Use this amount')}
    </button>
  </div>
)}
```

`t('Total')` uses the `'Total'` key added in Step 1.

- [ ] **Step 4: Build**

Run: `npm run build && npm test`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add app/entry/page.js lib/i18n.js
git commit -m "Suggest tomorrow's bhangti from today's denomination count"
```

---

### Task 5: "Who closed the hishab" — optional multi-select

**Files:**
- Modify: `app/entry/page.js`
- Modify: `app/api/entries/route.js`
- Modify: `app/globals.css`
- Modify: `lib/i18n.js`

- [ ] **Step 1: Add the i18n key**

Add to `lib/i18n.js`'s `BN`:

```js
  "Who's closing today?": 'আজ কে হিসাব বন্ধ করছেন?',
```

- [ ] **Step 2: Add the chip-select CSS**

Append to `app/globals.css`:

```css
/* ---- CHIP MULTI-SELECT (hishab closers) ---- */
.chip-select { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.chip-select button {
  padding: 7px 12px; border-radius: 999px; border: 1px solid var(--border2);
  background: var(--bg2); color: var(--text2); font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.chip-select button.on { background: var(--brand-green); color: #fff; border-color: var(--brand-green); }
```

- [ ] **Step 3: `app/entry/page.js` — state, load, save, UI**

1. Add a module-level constant near the top of the file (after `TOTAL_STEPS`):

```js
const HISHAB_CLOSERS = [
  'Ashraful', 'Shagor', 'Shaibal', 'Sadman', 'Arman (Josh)', 'Arman Mahmud',
  'Himel', 'Hridoy', 'Zamil', 'Ezaz', 'Shakil', 'Limon', 'Nazmul Rabbi',
  'Supto', 'Chef (Sujit)',
];
```

2. Add state: `const [closedBy, setClosedBy] = useState([]);` alongside the other `useState`
   declarations.

3. In `load()`, when an existing entry is found: `setClosedBy(e.closed_by || []);` (alongside
   the existing `setNotes(e.notes || '')`). In the "no entry yet" branch, reset it:
   `setClosedBy([]);` (alongside the existing `setNotes('')`).

4. In `handleSave()`'s POST body, add `closedBy: isOffDay ? [] : closedBy,` alongside the other
   fields (after `notes`).

5. Add a toggle helper near `updateLine`-style helpers (or inline in the JSX) — simplest as an
   inline handler in the render, no separate function needed:
   ```jsx
   onClick={() => setClosedBy((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])}
   ```

6. In the `step === 4` "Review & save" block, add the chip field directly above the existing
   Notes `<div className="field">`:

```jsx
<div className="field" style={{ marginTop: 12 }}>
  <label>{t("Who's closing today?")}</label>
  <div className="chip-select">
    {HISHAB_CLOSERS.map((name) => (
      <button
        key={name}
        type="button"
        className={closedBy.includes(name) ? 'on' : ''}
        onClick={() => setClosedBy((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name])}
      >
        {name}
      </button>
    ))}
  </div>
</div>
```

Names are proper nouns — do not wrap them in `t(...)`.

- [ ] **Step 4: `app/api/entries/route.js` — accept and store `closedBy`**

1. Destructure `closedBy` alongside the other body fields.
2. Add a light shape guard right after the `entryDate` regex check:
   ```js
   const closedByArr = Array.isArray(closedBy) ? closedBy.filter((n) => typeof n === 'string') : [];
   ```
3. Add `closed_by` to the INSERT column list, the `ON CONFLICT DO UPDATE SET` clause
   (`closed_by = EXCLUDED.closed_by`), and the parameterized values array (append
   `closedByArr` as the next `$n` — pg serializes a JS array to a Postgres `text[]`
   automatically, no `JSON.stringify` needed, matching how `denominations` is handled
   differently only because that column is `JSONB` not an array type).

- [ ] **Step 5: Build**

Run: `npm run build && npm test`
Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add app/entry/page.js app/api/entries/route.js app/globals.css lib/i18n.js
git commit -m "Add optional 'who closed the hishab' multi-select"
```

---

### Task 6: Verification — rebuild Docker, targeted API checks, hand off address

**Files:** none (verification only).

- [ ] **Step 1: Full local suite**

Run: `npm test && npm run build`
Expected: both green.

- [ ] **Step 2: Rebuild the Docker stack with the schema change**

The `db` container's volume was seeded before the `closed_by` migration existed. Recreate it
so the fresh init scripts (including the new `ALTER TABLE`) apply, or apply the same `ALTER
TABLE` statement directly to the running container — the latter is faster and doesn't require
re-seeding:

```bash
docker exec bilingual-numbers-db-1 psql -U soupresso -d soupresso -c "ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS closed_by TEXT[] NOT NULL DEFAULT '{}';"
docker compose -f docker-compose.dev.yml up -d --build app
```

- [ ] **Step 3: Targeted API check proving the formula fix end-to-end**

Log in and POST a test entry exercising a positive bazar variance, confirm the returned
`total_sales` matches the corrected formula, then delete the test row:

```bash
curl -s -c /tmp/soup-cookies.jar -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"dev@soupresso.local","password":"devpass123"}'

curl -s -b /tmp/soup-cookies.jar -X POST http://localhost:3000/api/entries \
  -H 'Content-Type: application/json' \
  -d '{"entryDate":"2026-09-11","totalCounted":4800,"openingBhangti":500,"bazarAdvanceReceived":1000,"bazarActualCost":1200,"nextBazarAdvance":1000,"nextBhangti":500,"closedBy":["Shaibal","Chef (Sujit)"],"notes":"plan verification"}'
# expect total_sales: "4500.00", bazar_variance: "200.00", cash_taken_home: "3300.00",
# closed_by: ["Shaibal","Chef (Sujit)"]

docker exec bilingual-numbers-db-1 psql -U soupresso -d soupresso -c "delete from daily_entries where entry_date='2026-09-11';"
```

- [ ] **Step 4: Report the address**

Confirm `docker compose -f docker-compose.dev.yml ps` shows both containers `Up`, then report
`http://localhost:3000` (login `dev@soupresso.local` / `devpass123`) to the user for their own
manual pass — no scripted browser walkthrough.

- [ ] **Step 5: Final commit if the sweep changed anything**

Only if Step 2's manual `ALTER TABLE` revealed a mismatch requiring a code fix — otherwise no
commit needed for this task.

---

## Self-Review

**1. Spec coverage** — formula fix (Task 1), no-backfill constraint (Global Constraints + Task 1
doc updates only, no data rewrite), wizard reorder (Task 3), closer names (Task 5), bhangti
suggestion (Task 4), single-source-of-truth constraint (Task 1, both consumers already import
from `lib/cash-math.js`, unchanged), reduced-testing preference (Global Constraints + Task 6).
No gaps.

**2. Placeholder scan** — Task 4 Step 3 has one explicit "verify before assuming" instruction
with the exact fallback key to add if the assumption is wrong — not an unresolved TBD, a
concrete contingency. No other placeholders.

**3. Type/name consistency** — `computeCashSummary` return shape used identically in Task 1's
tests and (unchanged call site) `app/entry/page.js`/`app/api/entries/route.js`. `closedBy`
(camelCase in JS/API) vs `closed_by` (snake_case DB column) — consistent with the existing
`isOffDay`/`is_off_day`, `entryDate`/`entry_date` convention already in the codebase. `HISHAB_CLOSERS`
defined once (Task 5), used once. `suggestedBhangtiNotes`/`suggestedBhangtiTotal` defined
(Task 4 Step 2) and consumed (Task 4 Step 3) with matching names.
