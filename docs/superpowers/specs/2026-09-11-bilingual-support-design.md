# Bilingual support (English / বাংলা) — design

**Date:** 2026-09-11
**Status:** Approved for planning
**Codebase:** Soupresso Cash Register v1 (`app/` App Router, plain JavaScript, raw SQL via `pg`, plain CSS).
**Deliverable:** 1 of 5 in the daily-hishab overhaul. Later: 2 = sales-calc fix + EOD model,
3 = bazar planner with photo item cards, 4 = home-cash running balance + receipt/PDF redesign,
5 = investment / return analysis. Each gets its own spec → plan → build.

## Problem

v1 has **no bilingual support of any kind**:

- `app/layout.js` hard-codes `<html lang="en">`. No language toggle anywhere.
- ~100 user-facing English string literals across 6 screens, all hard-coded in JSX.
- ~20 inline `` `৳${Number(n).toLocaleString(...)}` `` sites and three per-file `const fmt = …`
  helpers — always Western digits.
- 10 `<input type="number">` fields (Daily Entry wizard, Products). Browsers restrict these
  to Western digits, so a Bangla keyboard cannot type into them at all.

The people closing the daily hishab type on Bangla keyboards and read Bangla numerals on the
paper ledgers this app replaces. "The language toggler needed for functional and usable
Bangla; system should understand both Bangla and English numbers properly" is a stated
requirement.

## Goals

1. A persistent **language toggle** (EN / বাং) in the app top bar and on the login screen.
2. **All six screens** (Daily Entry, Receipts, Dashboard, Products, Login, nav/shell) render
   their UI strings in Bangla when Bangla is selected.
3. Every numeric field accepts **Bangla digits (০–৯), Western digits (0–9), or a mix**, plus a
   Bangla/Western decimal point and `,` grouping — normalized to a real number before it
   reaches state or an API route.
4. When Bangla is selected, **all displayed numbers** — totals, calc rows, denomination
   subtotals, dashboard KPIs, charts, receipts — render in Bangla numerals with lakh-style
   grouping (১,৫০,০০০).
5. In Bangla mode, **dates** render with Bangla numerals but **English weekday/month names**
   (e.g. "Wednesday, September ১০, ২০২৬"). Decision: names stay English — unambiguous, less
   translation surface, matches how the team already writes dates.
6. No schema change, no migration, no change to any stored value.

## Non-goals

- Translating weekday / month names to Bangla (explicitly decided against — see Goal 5).
- Translating free-text the user typed themselves (entry `notes`, menu item names) — shown
  verbatim in whichever script they were entered.
- Server-side language detection / SSR-correct first paint. All six pages are `'use client'`
  and already render behind a "Loading…" state while they fetch; a one-frame English flash
  before the client reads the stored preference is acceptable.
- A translation-management system / extraction tooling. The dictionary is a plain object in
  one file, edited by hand.
- `<html lang>` being server-correct — it is updated client-side after mount (Goal: a11y hint
  only).

## Approach

### New file: `lib/numerals.js` (pure, no imports)

```js
export const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

// '0'..'9' -> '০'..'৯' and back
const WESTERN_TO_BN = { /* built from BN_DIGITS */ };
const BN_TO_WESTERN = { /* built from BN_DIGITS */ };

/** Swap Western digits for Bangla digits (lang==='bn') or return s unchanged. */
export function toLocaleDigits(s, lang) { ... }

/**
 * Parse a user-entered number that may use Bangla or Western digits, a `.`
 * decimal separator, `,` grouping, a `৳` sign, and surrounding whitespace.
 * Returns a finite Number, or null for empty / malformed input (so callers can
 * distinguish "blank" from "0").
 */
export function parseLocaleNumber(raw) { ... }        // string|null|undefined -> number|null

/** parseLocaleNumber, but a value that is already a finite number passes through. */
export function coerceLocaleNumber(raw) { ... }        // unknown -> number|null

/** Grouped number, no currency symbol. bn -> bn-BD locale (lakh grouping) + Bangla digits. */
export function formatNumber(n, lang) { ... }

/** '৳' + grouped integer amount. Negative -> leading '−'. bn -> Bangla digits. */
export function formatTaka(n, lang) { ... }
```

`parseLocaleNumber` algorithm: null/empty → `null`; translate ০–৯ → 0–9; strip `৳`,
whitespace, and `,`; if it matches `/^-?\d*\.?\d+$/` → `Number(...)`, guarded against
non-finite; else `null`.

`formatNumber` / `formatTaka`: `new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-BD')`.
If a given ICU build emits Western digits for `bn-BD`, wrap the result in
`toLocaleDigits(_, 'bn')` as a safety net (decided at implementation time, verified in-browser).

### New file: `lib/i18n.js` (imports nothing from the app)

```js
export const LANGS = ['en', 'bn'];
export const DEFAULT_LANG = 'en';
export const LANG_STORAGE_KEY = 'soupresso_lang';

// Every user-facing English string in the app, mapped to its Bangla translation.
// Keys are the exact English source string. Missing key -> fall back to the key.
export const BN = {
  'Daily Entry': 'দৈনিক হিসাব',
  'Receipts': 'রসিদ',
  // ... full dictionary, ~100 entries (enumerated in the plan)
};

/** t('bn', 'Save') -> 'সংরক্ষণ'; t('en', x) -> x; unknown key -> key. */
export function translate(lang, key) {
  if (lang !== 'bn') return key;
  return BN[key] ?? key;
}
```

The plan enumerates the full string list, grouped by file, with Bangla for each. Where the
old (pre-v1) app had a translation the plan reuses it; where v1 introduced new copy the plan
supplies a fresh translation.

### New file: `app/LangProvider.js` (`'use client'`)

React context. Value:

```js
{
  lang,                       // 'en' | 'bn'
  setLang(next),              // persists to localStorage, updates document.documentElement.lang
  t(key),                     // translate(lang, key)
  taka(n),                    // formatTaka(n, lang)
  num(n),                     // formatNumber(n, lang)
  digits(str),                // toLocaleDigits(str, lang)
  dateLong(dateStr),          // formatDateLong(dateStr, lang)
  dateDisplay(dateStr),       // formatDateDisplay(dateStr, lang)
  dateNice(dateVal),          // formatDateNice(dateVal, lang)
}
```

- Initial state is `DEFAULT_LANG` on the server and the first client render (deterministic —
  no hydration mismatch).
- A mount `useEffect` reads `localStorage[LANG_STORAGE_KEY]`; if it is `'bn'`, switches.
- `setLang` writes `localStorage`, sets state, and sets `document.documentElement.lang`.
- `useLang()` hook throws if used outside the provider.

Mounted once in `app/layout.js` (the only server component) wrapping `{children}`. A
client provider with server children is fine.

### New file: `app/LangToggle.js` (`'use client'`)

A single segmented button: `EN | বাং`. Calls `setLang`. Rendered in `AppShell`'s top bar
(next to "Log out") and on the login card (top-right or under the subtitle). ~20 lines +
a few lines of CSS appended to `app/globals.css`.

### New file: `app/NumberInput.js` (`'use client'`)

Replaces `<input type="number">`. Props: `value` (number | '' | string), `onValueChange(n,
rawText)` where `n` is `parseLocaleNumber(rawText)`, plus `placeholder`, `min`, `autoFocus`,
`className`, `id`, `aria-label`, `disabled`. Behavior:

- Renders `<input type="text" inputMode="decimal" autoComplete="off">`.
- Holds the raw typed text in local state so the user sees exactly what they typed.
- On change: `onValueChange(parseLocaleNumber(next), next)`.
- On blur: if parse is non-null, reformat the visible text to `formatNumber(n, lang)`
  (grouped, in the current script). Blank stays blank.
- Non-empty + unparseable → `aria-invalid`, red ring (reuse the `.field input:focus` /
  destructive styling already in `globals.css` or add one rule).
- Keeps the `min="0"` behavior as a soft invalid hint only (submission is validated where
  it already is — API routes and existing checks).

### Edits to existing files

**`lib/dates.js`** — add an optional `lang` param to `formatDateDisplay`, `formatDateLong`,
`formatDateNice`; wrap the returned string in `toLocaleDigits(_, lang)` (imported from
`lib/numerals.js`). `todayStr`, `toDateStr`, `shiftDateStr` are unchanged (they produce ISO
`YYYY-MM-DD`, never displayed raw).

**`app/layout.js`** — wrap `{children}` in `<LangProvider>`. `<html lang="en">` stays as the
static default; the provider updates it client-side.

**`app/AppShell.js`** — `useLang()`; translate the 4 tab labels and "Log out"; render
`<LangToggle />` in `.topbar-inner`.

**`app/entry/page.js`** — the largest change. `useLang()`; replace the local `fmt` with
`taka`; translate all ~34 strings (step labels, card titles, field labels, hints, button
text, modal copy, off-day copy); replace all 6 `<input type="number">` with `<NumberInput>`
(denomination cells, direct total, opening bhangti, bazar advance received, bazar actual
cost, next bazar advance, next bhangti), adapting each `onChange` to `onValueChange`;
replace every inline `.toLocaleString()` with `num(...)` or fold into `taka(...)`.

**`app/history/page.js`** — `useLang()`; `fmt` → `taka`; translate ~12 strings; `formatDateLong(date)`
→ `dateLong(date)`.

**`app/dashboard/page.js`** — `useLang()`; `fmt` → `taka`; translate ~17 strings (range pill
labels, view labels, KPI labels, table headers, "No data…"); chart tick/label/tooltip text
through `num`/`taka`/`dateDisplay`; the `RANGES` / `VIEWS` label arrays become `t(...)` at
render, not at module load.

**`app/products/page.js`** — `useLang()`; translate ~23 strings; replace the 3
`<input type="number">` (daily quantity, price edit, new-item price) with `<NumberInput>`;
`.toLocaleString()` → `num`.

**`app/login/page.js`** — `useLang()`; translate ~7 strings; render `<LangToggle />`.

**API route hardening** (`app/api/entries/route.js`, `app/api/daily-sales/route.js`,
`app/api/products/route.js`) — where a numeric body field is read as `Number(x)`, use
`coerceLocaleNumber(x)` from `lib/numerals.js` instead, keeping the existing
`isNaN` / required checks. `<NumberInput>` already sends clean numbers; this is
defense-in-depth for any un-migrated field or direct API use. No route logic changes.

### Test runner (new — v1 has none)

`package.json` gains `"test": "node --test 'lib/*.test.js'"`. Node 22 auto-detects the ESM
syntax in the `lib/*.js` files (a one-line perf warning, harmless). Do **not** add
`"type": "module"` to `package.json` — `scripts/init-db.js` uses CommonJS `require` and
would break.

Automated tests cover only the pure functions:

- `lib/numerals.test.js` — `parseLocaleNumber` (Bangla / Western / mixed / `,` grouping /
  Bangla & Western decimal / `৳` prefix / whitespace / `''` → null / `'abc'` → null /
  `'1.2.3'` → null / `'-500'` / `'০'` → 0), `coerceLocaleNumber` (number passthrough, NaN →
  null), `toLocaleDigits` (digits only, separators/letters untouched), `formatNumber` /
  `formatTaka` (`en` unchanged vs today, `bn` contains only Bangla digits, negative sign).
- `lib/i18n.test.js` — `translate('en', x) === x`; `translate('bn', 'Save')` is non-empty
  and ≠ the key; unknown key falls back to the key; every value in `BN` is a non-empty
  string; no `BN` key maps to itself.

React components and pages are verified manually (mobile viewport, both languages) — the
plan's per-task manual steps.

## Data flow

```
user types "১৫০০" / "1,500" / "১,৫০০.৫০"  in a <NumberInput>
  raw text state = "১৫০০"    ──renders──▶  user sees "১৫০০"
  parseLocaleNumber → 1500
    └─ onValueChange(1500, "১৫০০") ──▶ page state (Number) ──▶ fetch POST body { totalCounted: 1500, ... }
                                                                     │
  API route: coerceLocaleNumber(body.totalCounted) ?? 0  ───────────┘   (defensive)
    → stored NUMERIC unchanged
  read back ──▶ taka(1500) ──▶ "৳১,৫০০" (bn) / "৳1,500" (en)
```

## Risks / mitigations

- **`bn-BD` currency/number ICU quirks** (symbol placement, Western fallback digits) — verify
  in-browser during the build; `toLocaleDigits` wrap is the fallback.
- **Hydration mismatch** if the provider reads `localStorage` during render — avoided by
  design: server + first client render are always `DEFAULT_LANG`, the switch happens in
  `useEffect`.
- **A missed string or `toLocaleString` site** — the plan's final task greps: no
  `toLocaleString(` left in `app/`, no `type="number"` on an `<input>` in `app/`, and a
  visual both-languages pass on every screen.
- **Translation quality** — the plan supplies every Bangla string inline for review; the
  user can correct any of them in `lib/i18n.js` after the build without touching logic.
- **`lib/dates.js` circular import** — `dates.js` imports `numerals.js`; `numerals.js`
  imports nothing. One direction, safe.
