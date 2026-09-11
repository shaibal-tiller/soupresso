# Investment / capital-expense tracking — design

**Date:** 2026-09-12
**Status:** Approved for planning (scope explicitly narrowed by user)
**Deliverable:** 5 of 5 in the daily-hishab overhaul, scope cut down 2026-09-12: populate the
existing spreadsheet data and support new/edit/update. Return-calculation/analysis is
explicitly deferred, not built here.

## Problem

`~/Downloads/Soupresso Investment.xlsx` is the only record of the shop's startup capital
spending — 94 itemized expenses across two side-by-side columns on one sheet, grouped into
implicit categories, totalling ৳133,410 (verified: every category subtotal and the grand total
in the sheet match a fresh sum of the extracted line items exactly). Nothing in the app tracks
this. Going forward, later investments/expenses of this kind need a place to be added, not just
this one historical snapshot.

## Goals

1. Import all 94 line items from the spreadsheet into the database, category-tagged.
2. A list page showing every entry (sortable by date, filterable by category), with category
   subtotals and a grand total.
3. Add a new entry; edit/update an existing one.
4. Bilingual UI chrome (consistent with the rest of the app); item descriptions stay as
   entered (free text, not translated — same treatment as menu item names).

## Non-goals

- Return-calculation / ROI / payback analysis — explicitly deferred.
- Delete — the user asked for "new, edit, update," not delete; omitted to match stated scope.
- Per-partner attribution or a contribution ledger (there is no partner/equity model in v1;
  out of scope here).
- Linking investment entries to the daily cash-register flow (`daily_entries`) — this is a
  separate, standalone record.
- Preserving exact per-item dates from the source — none exist in the spreadsheet. All seeded
  rows get one default date (2026-08-13, the cutoff the sheet itself references in one of its
  section headers), editable individually afterward like any other entry.

## Data model

```sql
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
```

`category` is free text, not an enum/foreign key — the 7 categories below come from the
spreadsheet's own grouping, but a new entry can use any category string; the list page derives
its category filter options from whatever is actually in the table, not a hardcoded list. This
matches the app's existing pattern for `daily_entries.notes` and menu item names: real text,
not a constrained vocabulary.

## Seed data

7 categories, 94 rows, extracted and arithmetically verified against the source spreadsheet:

| Category | Items | Subtotal |
|---|---|---|
| Food Cart | 18 | ৳46,530 |
| Chef Home Development | 13 | ৳19,005 |
| Gas | 6 | ৳8,000 |
| Convayance & Misc | 7 | ৳4,180 |
| Food Taste & Raw Materials | 18 | ৳14,730 |
| Cookaries & Accessories | 23 | ৳34,080 |
| Others | 9 | ৳6,885 |
| **Total** | **94** | **৳133,410** |

The full row-by-row list (description + amount) lives in the implementation plan, not repeated
here — it's transcription data, not a design decision.

## UI

**New page `app/investments/page.js`**, new nav tab "Investments" in `AppShell`:

- A list, most-recent first, grouped by category with a subtotal per group and a grand total
  at the top — mirrors the existing Products/Dashboard visual language (`.card`, `.kpi-row`,
  `denom-table`-style rows), not a new visual system.
- A category filter (pill row, like the existing `.toggle-row` pattern), options derived from
  distinct categories present in the data.
- "Add entry" opens a small form (date picker, category — a text input with the 7 known
  categories as datalist suggestions, description, amount via `NumberInput`, notes) — same
  interaction shape as the existing "Add a new item" form on the Products page.
- Clicking an existing row opens the same form pre-filled, for editing; saving calls the same
  upsert endpint with an `id`.

**API `app/api/investments/route.js`:**
- `GET` — list all entries (optionally `?category=`), newest first.
- `POST` — create (no `id`) or update (`id` present), same shape as `app/api/products/route.js`.

## Testing

Per the user's standing preference (see project memory: minimize subagent/browser testing —
this deliverable has no subagent involved at all, executed inline): `npm run build`, and a
`curl` check against the running Docker stack proving a create + an update round-trip. Full
UI walkthrough is the user's own manual pass via the Docker address.

## Risks / mitigations

- **Seed re-run safety** — the seed script must be idempotent (safe to run more than once)
  since `schema.sql`/`scripts/init-db.js` can be re-run. Use a natural dedupe key: since there's
  no natural unique key across (date, category, description, amount) guaranteed unique, the
  seed inserts are gated behind a one-time marker check (`SELECT COUNT(*) FROM investments`
  before inserting — only seed when the table is empty) rather than per-row `ON CONFLICT`,
  matching how `seed-history.sql` doesn't need per-row conflict handling either (it's a
  one-time import, not a repeatable migration).
- **Default date on 94 rows** — flagged explicitly to the user; correctable per-row via the
  edit form, or in bulk with one SQL statement if they want a different default later.
