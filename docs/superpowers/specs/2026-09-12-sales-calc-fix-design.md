# Sales-calc fix, wizard reorder, closer names, bhangti suggestion — design

**Date:** 2026-09-12
**Status:** Approved for planning
**Codebase:** Soupresso Cash Register v1, on top of the bilingual-support branch
(`worktree-bilingual-numbers`, HEAD `3a6cc6c` at design time).
**Deliverable:** 2 of 5 in the daily-hishab overhaul. Earlier: 1 = bilingual support (done).
Later: 3 = bazar planner with photo item cards, 4 = home-cash running balance + receipt/PDF
redesign, 5 = investment data entry (scope cut down — see project memory).

## Problem

`lib/cash-math.js`'s `computeCashSummary` has a real arithmetic bug, not just a UX issue:

```js
totalSales = totalCounted - openingBhangti
bazarVariance = bazarActualCost - bazarAdvanceReceived
cashTakenHome = totalCounted - bazarVariance - nextBazarAdvance - nextBhangti
```

`bazarVariance` — the settlement for the chef fronting extra bazar money from his own pocket
(positive) or returning unspent advance (negative) — is applied to `cashTakenHome` but never
to `totalSales`. Whenever the chef is topped up from the box, that cash leaving the box lowers
`totalCounted`, which silently lowers the reported `totalSales` by the same amount — sales
understated. Whenever the chef returns money to the box, `totalCounted` rises and `totalSales`
is inflated by the same amount — sales overstated. This is exactly the bug described in the
original request. `cashTakenHome` additionally double-subtracts `bazarVariance`: once
implicitly (it already reduced `totalCounted` when physically paid) and once explicitly in the
formula.

Two smaller, related gaps: there's no record of who closed the day's hishab, and counting the
box "by denomination" doesn't help decide what to leave for tomorrow's bhangti — the operator
re-derives that from memory every day even though the day's own denomination counts already
contain the answer.

## Goals

1. Fix the formula so `totalSales` correctly excludes chef-settlement cash movements and
   `cashTakenHome` doesn't double-count them.
2. Reorder the wizard so the sales figure shown is always final, never provisional.
3. Record who closed the day (optional, multi-select from the 15 names).
4. Suggest tomorrow's bhangti from today's counted denominations when in "by denomination"
   mode.
5. No schema change to existing columns; no change to existing stored values.

## Non-goals

- Backfilling the 19 seeded historical rows (Aug 11–Sep 2) with the corrected formula. They
  were bulk-imported with `bazar_advance_received = 0` for every row (a spreadsheet import
  artifact, not a real chef-settlement record) — running the new formula against them would
  add their entire bazar expense into "sales," which is worse than leaving them alone. They
  keep whatever `total_sales`/`cash_taken_home` they were imported with.
- Building an independent point-of-sale / per-order sales tally as the source of truth for
  `totalSales`. The box-count-derived figure, once correctly netted of chef-settlement cash
  movements, is accurate; a POS overhaul is a different, much larger project not requested here.
- A denomination breakdown *stored* for `next_bhangti` — the suggestion only fills the existing
  single-number field; the DB keeps storing a total, not a per-note breakdown.
- Validating or requiring `closed_by` — explicitly optional per requirements.
- Enforcing the 15-name list server-side as an enum; it is a UI convenience list, not a
  constraint (a name typo or a 16th person someday shouldn't be a hard error).

## Approach

### 1. `lib/cash-math.js` — corrected formula

```js
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

Sign check: chef needed extra money (variance > 0, paid out of the box before/at close) →
`totalCounted` is lower than it would otherwise be → adding `+bazarVariance` recovers the true
sales figure. Chef returned money (variance < 0) → `totalCounted` is inflated → adding the
negative variance nets it back out. `cashTakenHome` is simply "what's in the box now minus
what's earmarked for tomorrow" — correct regardless of how the count got to its current value,
so it no longer needs `bazarVariance` at all.

`bazarVarianceLabel` (the pre-formatted English string) is removed from this function — it's
already dead code as of the bilingual-support branch, which replaced its only call site with an
inline, translated computation in `app/entry/page.js` using the same `bazarVariance` number.
The three translated label strings (`'Give chef extra:'`, `'Chef returns:'`,
`'Exact — no variance'`) already exist in `lib/i18n.js` and don't change.

The header comment documenting "Total Sales is total_counted minus opening_bhangti. That's
it" is updated to describe the corrected formula and why the variance term exists.

`README.md`'s "The math, precisely" section gets the same two-line update for consistency.

### 2. `app/entry/page.js` — wizard step reorder

Current order: Count box (0) → **Sales (1)** → **Bazar (2)** → Tomorrow (3) → Review (4).
New order: Count box (0) → **Bazar (1)** → **Sales (2)** → Tomorrow (3) → Review (4).

Only `stepLabels` and the two step-content blocks' `step === N` guards swap; no state, no
handlers, no API shape changes. `computeCashSummary` is already called unconditionally on every
render using whatever is in state, so once Bazar is entered at the (new) step 1, the Sales step
right after it shows the final number — never provisional.

### 3. "Who closed the hishab" — optional multi-select

**Schema:** one idempotent, additive migration, following the exact pattern `schema.sql`
already uses for `is_off_day`:

```sql
ALTER TABLE daily_entries ADD COLUMN IF NOT EXISTS closed_by TEXT[] NOT NULL DEFAULT '{}';
```

`TEXT[]` (native Postgres array) — `pg` maps it to/from a plain JS array with no extra
serialization code, and it's a fixed, known-small list, not free text needing a join table.

**Names list** (module-level constant, single source of truth, used only for rendering the
picker — never enforced as a DB constraint): Ashraful, Shagor, Shaibal, Sadman, Arman (Josh),
Arman Mahmud, Himel, Hridoy, Zamil, Ezaz, Shakil, Limon, Nazmul Rabbi, Supto, Chef (Sujit).

**UI:** a new field in the Review step (step 4), placed above the existing Notes field — a
wrapping row of toggle chips (reusing the existing `.toggle-row`/chip button styling already in
`globals.css`), multi-selectable, none selected by default. Bilingual: the 15 names are proper
nouns and are NOT translated (same treatment as the `Soupresso` brand name); the field label
("Who's closing today?") is a new `t()` key.

**API:** `app/api/entries/route.js` POST accepts an optional `closedBy` array in the body
(defaults to `[]` if absent/invalid), stores it in the `closed_by` column, and returns it in
the row (already covered by `SELECT *`). No new validation beyond "must be an array of
strings if present" — an unrecognized name is stored as-is, not rejected (Non-goal above).

### 4. Bhangti suggestion from today's denomination count

Only shown when `mode === 'denom'` at Step 1 (no suggestion is possible from a direct total —
there's no per-note breakdown to work from). Rendered in the (new) Step 3 "Tomorrow" card,
above the existing `next_bhangti` `NumberInput`:

- Compute `suggestedNotes = STANDARD_DENOMINATIONS.filter(d => d <= 50)` (i.e. ৳50, ৳20, ৳10,
  ৳5, ৳2, ৳1 — matches "leave 1s/2s/5s/10s/20s... sometimes all 50s... very infrequent to leave
  bigger notes"; defaulting to *all* counted 50s keeps the rule simple, and the operator can
  freely edit the resulting total down).
- `suggestedTotal = denominationTotal(pick(denoms, suggestedNotes))` — reuses the existing
  `denominationTotal` helper from `lib/cash-math.js` on a filtered copy of the day's `denoms`
  state.
- A small card lists each denomination with a nonzero count and its subtotal (e.g. "৳50 × 6 =
  ৳300"), a total line, and a "Use this amount" button that calls the existing
  `setNextBhangti(suggestedTotal)` — after which the field behaves exactly as it does today
  (a plain, freely-editable `NumberInput`). This is purely a starting suggestion, never
  auto-applied.
- No new state, no new DB field — `nextBhangti` stays exactly what it is today; only its
  starting value can be one click away instead of re-counted from memory.

## Data flow

```
Step 0: count denominations (unchanged) → denoms state
Step 1 (was 2): Bazar — enter bazarAdvanceReceived, bazarActualCost
                 → bazarVariance computed live
Step 2 (was 1): Sales — computeCashSummary() now includes bazarVariance
                 → totalSales shown is FINAL (was provisional before the reorder)
Step 3: Tomorrow — nextBazarAdvance, nextBhangti
                 → if mode==='denom': suggested-bhangti card computed from Step 0's denoms,
                   one click fills nextBhangti; still freely editable
Step 4: Review — closedBy chips (optional) + existing Notes → save
POST /api/entries → stores closedBy; computeCashSummary() (same corrected function) is the
                     server-side source of truth, matching the client preview exactly
```

## Testing

Unit (extend the existing `node --test` suite):
- `lib/cash-math.test.js` (new file) — `computeCashSummary`: variance-positive case (sales
  includes the top-up, cash-taken-home doesn't double-subtract), variance-negative case,
  zero-variance case (unchanged from today), `isShort` boundary. `denominationTotal` already
  has no test — add one alongside since this deliverable relies on it for the bhangti
  suggestion; cover empty/partial denomination maps.

Manual (per the user's standing preference — see project memory: minimize subagent browser
testing, run via Docker and let the user verify): the plan's verification step builds and runs
the Docker Compose stack and reports the address; deep click-through testing is the user's own
pass, not a scripted subagent one. Task-level verification stays to `npm test` + `npm run
build` + one or two direct `curl`/API checks proving the corrected formula end-to-end, not a
full browser walkthrough.

## Risks / mitigations

- **Existing in-progress entries mid-edit when this ships** — none exist outside seeded history
  in the target environment; not a concern for this app's usage pattern (one shop, one entry
  per day, edited same-day or shortly after).
- **A day already saved under the old (buggy) formula, later re-opened and re-saved** — its
  `total_sales`/`cash_taken_home` will silently update to the corrected values on next save
  (existing `entry_edit_log` audit trail captures the before-state, so the change is visible in
  history, not silently lost).
- **`closed_by` default `'{}'`** ensures the additive migration never fails on existing rows and
  every pre-existing row reads back as an empty array, not null (simpler client code — no
  null-check needed before rendering/filtering the array).
