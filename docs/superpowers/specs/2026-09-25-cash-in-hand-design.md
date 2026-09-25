# Cash in Hand — design

**Date:** 2026-09-25
**Status:** Approved for planning (approach and 3 key decisions confirmed by user in chat)
**Deliverable:** new feature (beta), not part of the original 5-deliverable daily-hishab overhaul.

## Problem

The shop's actual liquid cash position isn't tracked anywhere. Historically, running
investments provided starting capital; day to day, each day's expenses are paid out of that
day's sales, and whatever's left over (`cash_taken_home`) is taken home and folded into a
running cash-in-hand pool. On a day where expense exceeds sales (a big bazar purchase, a
salary payment), the shortfall is covered *from* that pool instead. Neither the receipts page
nor the Daily Entry wizard shows any of this today, and there's no running total anywhere in
the app.

## Goals

1. Track a running cash-in-hand balance, one day at a time, derived from each day's
   `cash_taken_home` (already computed by `lib/cash-math.js` — no new cash math, just a new
   running total layered on top of the existing figure).
2. A pending → confirmed lifecycle per day: a day's contribution is "pending" until either the
   next day's entry is saved or 24 hours pass, then it locks. Locked days are never edited
   directly again — corrections go through an explicit, notated reconciliation adjustment.
3. Surface the balance in three places it's currently invisible: the Daily Entry review step,
   the per-day receipt, and a new dashboard KPI.
4. A starting balance has to be set once (date + amount) before any of this produces real
   numbers — ships unconfigured; an admin action sets it later, once the user has independently
   confirmed what the real starting figure should be.

## Non-goals

- Retroactively reconstructing cash-in-hand for days before the starting date — out of scope;
  the starting balance *is* the summary of everything before it.
- A cron/scheduled job — the 24h confirm check runs lazily on page load (see Decisions).
- Changing `lib/cash-math.js` or `cash_taken_home` itself — this feature only consumes that
  number, it doesn't change how it's computed.
- Multi-currency, interest, or any banking integration — this is a manual cash ledger.

## Decisions made in brainstorming (see chat, 2026-09-25)

1. **Starting balance ships unset.** The feature includes an admin action to set
   `starting_date`/`starting_balance` whenever the user is ready; until then, cash-in-hand
   shows as "not started."
2. **24h confirmation is a lazy check on page load**, not a cron job — matches how the rest of
   this app already works (no existing background jobs). Checked at the top of the relevant GET
   routes (ledger, dashboard).
3. **While a day is pending, editing its entry auto-recomputes its ledger contribution.** Once
   confirmed, the row is frozen; further correction is only via a dated, notated adjustment
   (see Data model). This can't race a pending day past an already-confirmed successor, because
   a day only confirms once the *next* day's entry exists — so a pending day never has a
   confirmed day after it.

## Data model

```sql
-- One row per tracked day, mirroring the daily_entries per-day-row pattern already used
-- throughout this app. Only created for entry_date >= cash_in_hand_settings.starting_date.
CREATE TABLE IF NOT EXISTS cash_in_hand_ledger (
  entry_date        DATE PRIMARY KEY REFERENCES daily_entries(entry_date) ON DELETE CASCADE,
  opening_balance   NUMERIC(12,2) NOT NULL,      -- previous day's closing_balance (or the starting balance, for day 1)
  day_delta         NUMERIC(12,2) NOT NULL,      -- snapshot of that day's cash_taken_home at write time
  adjustment_delta  NUMERIC(12,2) NOT NULL DEFAULT 0,  -- sum of any reconciliation adjustments dated to this day
  closing_balance   NUMERIC(12,2) NOT NULL,      -- opening_balance + day_delta + adjustment_delta
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  pending_since     TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A reconciliation correction — always dated to when it's entered, never silently rewriting
-- a confirmed day's own recorded numbers. Applying one recomputes closing_balance for its
-- target day and cascades opening_balance/closing_balance forward through every later day
-- (pending or confirmed) — the running total shifts; each day's own day_delta/status doesn't.
CREATE TABLE IF NOT EXISTS cash_in_hand_adjustments (
  id           SERIAL PRIMARY KEY,
  entry_date   DATE NOT NULL REFERENCES cash_in_hand_ledger(entry_date),
  amount       NUMERIC(12,2) NOT NULL,   -- can be negative
  note         TEXT NOT NULL,            -- required — no adjustment without an explanation
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Singleton settings row (id always 1). NULL starting_date means "not configured yet."
CREATE TABLE IF NOT EXISTS cash_in_hand_settings (
  id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  starting_date     DATE,
  starting_balance  NUMERIC(12,2),
  note              TEXT,
  set_at            TIMESTAMPTZ
);
INSERT INTO cash_in_hand_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
```

## Lifecycle & write paths

**Setting the starting balance** (`POST /api/cash-in-hand/settings`, one-time — see Open
questions): writes `cash_in_hand_settings`, then backfills `cash_in_hand_ledger` rows for every
`daily_entries` row from `starting_date` through today by walking forward day by day,
`opening_balance` = previous day's `closing_balance` (or the starting balance for the first
day), `day_delta` = that day's current `cash_taken_home`. Days with no `daily_entries` row are
skipped (not fabricated as zero) — the next real day's `opening_balance` just carries forward
from the last day that existed.

**Saving a daily entry** (`POST /api/entries`, existing route, extended): after its normal
upsert, if `entry_date >= starting_date`, upsert the corresponding ledger row:
- If no row exists yet, or it exists and is `pending`: recompute `day_delta` from the just-saved
  `cash_taken_home`, recompute `closing_balance`, write `status='pending'` (or keep it), set/keep
  `pending_since`.
- Also check: does a ledger row exist for `entry_date - 1`, and is it still `pending`? If so,
  confirm it (`status='confirmed'`, `confirmed_at=now()`) — this is the "next day's entry
  triggers confirmation" rule.
- A confirmed row is never touched by this path — only by an adjustment (see below).

**Lazy 24h sweep** (helper called at the top of `GET /api/cash-in-hand` and `GET /api/dashboard`):
```sql
UPDATE cash_in_hand_ledger SET status = 'confirmed', confirmed_at = now()
WHERE status = 'pending' AND pending_since <= now() - interval '24 hours';
```

**Adding an adjustment** (`POST /api/cash-in-hand/adjustments`): inserts the adjustment row,
adds `amount` to the target day's `adjustment_delta`, recomputes that day's `closing_balance`,
then walks forward through every later ledger row (pending or confirmed) recomputing
`opening_balance`/`closing_balance` in sequence. Wrapped in one transaction.

## UI

- **New `/cash-in-hand` page** (nav tab): current balance as a large stat (flags "pending" if
  the latest day isn't confirmed yet), a day-by-day ledger table (date, opening, day delta,
  adjustment, closing, status), a "set starting balance" action (disabled/replaced by "add
  adjustment" once already set), and an "add adjustment" form (date, amount, required note).
- **Dashboard**: new KPI tile, latest balance (pending-inclusive), small note if unconfirmed.
- **Receipts** (`app/history/page.js`): each day's card shows that day's opening/closing
  balance and status, once a starting balance exists and that day is on/after it.
- **Daily Entry** (`app/entry/page.js`): Review step shows the live projected closing balance
  for the day being entered (previous day's balance + this draft's `cash_taken_home`), computed
  client-side from already-available data — no extra fetch beyond the previous day's ledger row.

## Error handling / edge cases

- **No starting balance set**: `/cash-in-hand`, the dashboard tile, receipts, and the entry
  review step all show "not started yet" rather than a zero or blank — zero would look like a
  real (wrong) balance.
- **Entry deleted/never happens for a day inside the tracked range**: no ledger row is created
  for that date; the next day that does get an entry uses the last real ledger row's
  `closing_balance` as its `opening_balance`, same as the backfill rule.
- **Off days**: still produce a `daily_entries` row (`is_off_day=true`) with its own
  `cash_taken_home` (typically 0), so they get a normal ledger row contributing that amount —
  consistent, no special-cased zero.

## Testing

- Pure-function unit tests (new `lib/cash-in-hand.test.js`, mirroring `lib/cash-math.test.js`'s
  style) for: computing a day's `closing_balance` from its inputs, the confirm-eligibility check
  given `pending_since`/now/whether a next-day row exists, and the adjustment cascade math.
- API-level verification against local Postgres (this project's established pattern): set a
  starting balance, save an entry and confirm the ledger row advances, confirm-on-next-day-entry,
  confirm-on-24h (simulate by backdating `pending_since`), add an adjustment and verify the
  cascade updates every later day.

## Open questions for the user to confirm before planning

1. **Changing the starting balance after it's already set** — the spec above treats it as
   effectively one-time (matching "we pick a date and set that as starting balance," singular).
   If it's ever wrong, should correcting it go through the same adjustment mechanism (an
   adjustment dated to the starting date, or to today), or does it need its own explicit
   "re-anchor" action? Recommending: treat it as a same adjustment — no special case needed.
2. **Adjustment target date** — can an adjustment be dated to any day in the ledger (confirmed
   or pending), or only to today/the most recent day? Recommending: any day, since "we ever
   need to reconcile" implies discovering an old error, not just fixing today.
