# Bilingual Support (English / বাংলা) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent EN/বাংলা language toggle that translates all six screens, and make every numeric field accept Bangla or Western digits while displaying numbers in the selected script.

**Architecture:** Two pure modules — `lib/numerals.js` (digit parsing + number formatting) and `lib/i18n.js` (string dictionary). A client `LangProvider` context (localStorage-backed) exposes `t`/`taka`/`num`/`digits`/`date*` helpers to every page. A `<NumberInput>` component replaces `<input type="number">`. A `<LangToggle>` sits in the top bar and login card. API routes defensively re-parse numeric body fields.

**Tech Stack:** Next.js 14.2.35, plain JavaScript (ESM syntax, no `"type": "module"`), React 18, raw SQL via `pg`, plain CSS. Tests: `node --test` (Node 22 auto-detects ESM).

**Spec:** `docs/superpowers/specs/2026-09-11-bilingual-support-design.md`

## Global Constraints

- **No schema change, no migration, no change to any stored value.** Presentation + input parsing only. The worktree's `.env.local` points at a local throwaway Postgres (`localhost:5544`); production is never touched.
- **Do NOT add `"type": "module"` to `package.json`** — `scripts/init-db.js` uses CommonJS `require` and would break. Node 22 auto-detects the ESM syntax already used throughout `lib/`.
- **English mode must be byte-identical to today.** Every helper with `lang === 'en'` (or no lang) returns exactly what v1 renders now.
- **Bangla digit set:** `০১২৩৪৫৬৭৮৯` ↔ `0123456789`.
- **Bangla `Intl` locale:** `'bn-BD'`. English/default: `'en-BD'` for numbers/currency (unchanged from v1's implicit default via `toLocaleString(undefined, …)` — pin it to `'en-BD'`), `'en-US'` for the weekday/month date parts (unchanged from `lib/dates.js`).
- **Dates in Bangla mode:** Bangla digits, **English weekday/month names**. Do not translate month or weekday names.
- **Do not translate user free-text:** entry `notes`, menu item `name` — render verbatim.
- **The negative-amount marker is `−` (U+2212)**, matching v1's existing `app/history/page.js`.
- **Persisted language key:** `localStorage['soupresso_lang']`, values `'en'` | `'bn'`.
- **Provider first render is always `'en'`** (server + first client paint) to avoid hydration mismatch; the stored preference is applied in a mount `useEffect`.
- Every task ends with `npm run build` passing. `npm test` passes from Task 1 onward.
- All six pages are already `'use client'`; keep them so.

---

### Task 1: `lib/numerals.js` + test runner

**Files:**
- Create: `lib/numerals.js`
- Create: `lib/numerals.test.js`
- Modify: `package.json` (add `test` script)

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  - `BN_DIGITS` — the string `'০১২৩৪৫৬৭৮৯'`
  - `toLocaleDigits(s: string, lang: 'en'|'bn'): string`
  - `parseLocaleNumber(raw: string|null|undefined): number|null`
  - `coerceLocaleNumber(raw: unknown): number|null`
  - `formatNumber(n: number, lang?: 'en'|'bn'): string`
  - `formatTaka(n: number, lang?: 'en'|'bn'): string`

- [ ] **Step 1: Add the test script to `package.json`**

Add to `"scripts"` (keep the existing `dev`/`build`/`start`/`db:init`):

```json
"test": "node --test \"lib/*.test.js\""
```

- [ ] **Step 2: Write the failing tests**

Create `lib/numerals.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BN_DIGITS,
  toLocaleDigits,
  parseLocaleNumber,
  coerceLocaleNumber,
  formatNumber,
  formatTaka,
} from './numerals.js';

test('BN_DIGITS is the ten Bangla digits', () => {
  assert.equal(BN_DIGITS, '০১২৩৪৫৬৭৮৯');
});

test('parseLocaleNumber: Western', () => {
  assert.equal(parseLocaleNumber('1500'), 1500);
  assert.equal(parseLocaleNumber('1,500'), 1500);
  assert.equal(parseLocaleNumber('1,50,000'), 150000);
  assert.equal(parseLocaleNumber('12.50'), 12.5);
  assert.equal(parseLocaleNumber('-500'), -500);
  assert.equal(parseLocaleNumber('0'), 0);
});

test('parseLocaleNumber: Bangla', () => {
  assert.equal(parseLocaleNumber('১৫০০'), 1500);
  assert.equal(parseLocaleNumber('১,৫০০'), 1500);
  assert.equal(parseLocaleNumber('১২.৫০'), 12.5);
  assert.equal(parseLocaleNumber('০'), 0);
});

test('parseLocaleNumber: mixed and noisy', () => {
  assert.equal(parseLocaleNumber('১5০0'), 1500);
  assert.equal(parseLocaleNumber('  ৳ 1,500 '), 1500);
  assert.equal(parseLocaleNumber('৳১৫০০'), 1500);
});

test('parseLocaleNumber: blank / malformed -> null', () => {
  assert.equal(parseLocaleNumber(''), null);
  assert.equal(parseLocaleNumber('   '), null);
  assert.equal(parseLocaleNumber(null), null);
  assert.equal(parseLocaleNumber(undefined), null);
  assert.equal(parseLocaleNumber('abc'), null);
  assert.equal(parseLocaleNumber('1.2.3'), null);
  assert.equal(parseLocaleNumber('--5'), null);
  assert.equal(parseLocaleNumber('1e5'), null);
});

test('coerceLocaleNumber', () => {
  assert.equal(coerceLocaleNumber(1500), 1500);
  assert.equal(coerceLocaleNumber('১৫০০'), 1500);
  assert.equal(coerceLocaleNumber(null), null);
  assert.equal(coerceLocaleNumber({}), null);
  assert.equal(coerceLocaleNumber(Number.NaN), null);
});

test('toLocaleDigits', () => {
  assert.equal(toLocaleDigits('৳1,500.50', 'bn'), '৳১,৫০০.৫০');
  assert.equal(toLocaleDigits('৳1,500.50', 'en'), '৳1,500.50');
  assert.equal(toLocaleDigits('Wed, Sep 10 2026', 'bn'), 'Wed, Sep ১০ ২০২৬');
});

test('formatNumber', () => {
  assert.equal(formatNumber(1500, 'en'), '1,500');
  assert.equal(formatNumber(150000, 'en'), '1,50,000');
  assert.equal(formatNumber(1500, 'bn'), '১,৫০০');
  assert.equal(formatNumber(150000, 'bn'), '১,৫০,০০০');
});

test('formatTaka: en unchanged, bn Bangla digits, negative sign', () => {
  assert.equal(formatTaka(1500), formatTaka(1500, 'en'));
  assert.equal(formatTaka(1500, 'en'), '৳1,500');
  assert.match(formatTaka(1500, 'bn'), /^৳[০-৯,]+$/);
  assert.doesNotMatch(formatTaka(1500, 'bn'), /[0-9]/);
  assert.equal(formatTaka(-1500, 'en'), '−৳1,500');
});
```

- [ ] **Step 3: Run tests — verify they fail**

Run: `npm test`
Expected: FAIL — `./numerals.js` does not exist.

- [ ] **Step 4: Implement `lib/numerals.js`**

```js
// Bangla/Western digit parsing and locale-aware number formatting.
// Pure — imported by client components, lib/dates.js, and API routes.

export const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

const WESTERN_TO_BN = {};
const BN_TO_WESTERN = {};
for (let i = 0; i < 10; i++) {
  WESTERN_TO_BN[String(i)] = BN_DIGITS[i];
  BN_TO_WESTERN[BN_DIGITS[i]] = String(i);
}

const numberFmt = {
  en: new Intl.NumberFormat('en-BD'),
  bn: new Intl.NumberFormat('bn-BD'),
};

/** Swap Western digits for Bangla digits when lang === 'bn'; otherwise return s unchanged. */
export function toLocaleDigits(s, lang) {
  if (lang !== 'bn') return String(s);
  return String(s).replace(/[0-9]/g, (d) => WESTERN_TO_BN[d]);
}

/**
 * Parse a user-entered number that may use Bangla or Western digits, a `.`
 * decimal separator, `,` grouping, a `৳` sign, and surrounding whitespace.
 * Returns a finite Number, or null for empty / malformed input.
 */
export function parseLocaleNumber(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (s === '') return null;
  s = s.replace(/[০-৯]/g, (d) => BN_TO_WESTERN[d]);
  s = s.replace(/[\s,৳]/g, '');
  if (!/^-?\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** parseLocaleNumber, but a value that is already a finite number passes through. */
export function coerceLocaleNumber(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') return parseLocaleNumber(raw);
  return null;
}

/** Grouped number, no currency symbol. */
export function formatNumber(n, lang) {
  const value = Number(n) || 0;
  const out = (lang === 'bn' ? numberFmt.bn : numberFmt.en).format(value);
  // Safety net if an ICU build returns Western digits for bn-BD.
  return lang === 'bn' ? toLocaleDigits(out, 'bn') : out;
}

/** '৳' + grouped integer amount. Negative -> leading '−' (U+2212). */
export function formatTaka(n, lang) {
  const value = Math.round(Number(n) || 0);
  const abs = formatNumber(Math.abs(value), lang);
  return (value < 0 ? '−৳' : '৳') + abs;
}
```

> Note: `formatTaka` renders whole taka (v1 always uses `maximumFractionDigits: 0`). `formatNumber` does not round — callers that need integers pass integers (denomination math, counts). If a fractional amount ever reaches `formatTaka` it is rounded, matching v1.

- [ ] **Step 5: Run tests — verify they pass**

Run: `npm test`
Expected: PASS. If `formatNumber(150000, 'en')` is not `'1,50,000'`, check the Node ICU: `en-BD` uses Indian grouping. If the CI/build Node lacks full ICU, `en-BD` may fall back to `'150,000'` — if so, change the assertion AND note it; do not switch locales (v1's current `toLocaleString(undefined,…)` already depends on the ambient locale).

- [ ] **Step 6: Commit**

```bash
git add lib/numerals.js lib/numerals.test.js package.json
git commit -m "Add Bangla/Western numeral parsing and formatting"
```

---

### Task 2: `lib/i18n.js` — string dictionary

**Files:**
- Create: `lib/i18n.js`
- Create: `lib/i18n.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `LANGS` = `['en', 'bn']`
  - `DEFAULT_LANG` = `'en'`
  - `LANG_STORAGE_KEY` = `'soupresso_lang'`
  - `BN` — the dictionary object below
  - `translate(lang, key): string`

- [ ] **Step 1: Write the failing tests**

Create `lib/i18n.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, DEFAULT_LANG, LANG_STORAGE_KEY, BN, translate } from './i18n.js';

test('constants', () => {
  assert.deepEqual(LANGS, ['en', 'bn']);
  assert.equal(DEFAULT_LANG, 'en');
  assert.equal(LANG_STORAGE_KEY, 'soupresso_lang');
});

test('translate: en is identity', () => {
  assert.equal(translate('en', 'Save quantities'), 'Save quantities');
  assert.equal(translate('en', 'anything at all'), 'anything at all');
});

test('translate: bn uses the dictionary, unknown falls back to key', () => {
  assert.equal(translate('bn', 'Daily Entry'), BN['Daily Entry']);
  assert.equal(translate('bn', 'a string not in the dict'), 'a string not in the dict');
});

test('every BN entry is a non-empty string and not identical to its key', () => {
  for (const [key, value] of Object.entries(BN)) {
    assert.equal(typeof value, 'string', `${key} -> non-string`);
    assert.ok(value.trim().length > 0, `${key} -> empty`);
    assert.notEqual(value, key, `${key} -> maps to itself`);
  }
});
```

- [ ] **Step 2: Run — verify fail**

Run: `npm test`
Expected: FAIL — `./i18n.js` missing.

- [ ] **Step 3: Implement `lib/i18n.js`**

```js
// Bilingual UI strings. Keys are the exact English source string used in JSX.
// translate('en', k) === k always; translate('bn', k) looks k up in BN and
// falls back to k if absent, so wrapping a string is always safe.

export const LANGS = ['en', 'bn'];
export const DEFAULT_LANG = 'en';
export const LANG_STORAGE_KEY = 'soupresso_lang';

export const BN = {
  // ---- Shell / nav (app/AppShell.js) ----
  'Daily Entry': 'দৈনিক হিসাব',
  'Receipts': 'রসিদ',
  'Dashboard': 'ড্যাশবোর্ড',
  'Products': 'পণ্য',
  'Log out': 'লগ আউট',

  // ---- Login (app/login/page.js) ----
  'Cash register — sign in to continue': 'ক্যাশ রেজিস্টার — চালিয়ে যেতে সাইন ইন করুন',
  'Email': 'ইমেইল',
  'Password': 'পাসওয়ার্ড',
  'Login failed.': 'লগইন ব্যর্থ হয়েছে।',
  'Could not reach the server. Check your connection and try again.':
    'সার্ভারে পৌঁছানো যায়নি। আপনার সংযোগ দেখে আবার চেষ্টা করুন।',
  'Signing in…': 'সাইন ইন হচ্ছে…',
  'Sign in': 'সাইন ইন',

  // ---- Shared ----
  'Loading…': 'লোড হচ্ছে…',
  'Cancel': 'বাতিল',
  'Save failed.': 'সংরক্ষণ ব্যর্থ হয়েছে।',
  'Saving…': 'সংরক্ষণ হচ্ছে…',
  'Bhangti in box': 'বাক্সে ভাংতি',
  'Note (optional)': 'নোট (ঐচ্ছিক)',
  'Notes (optional)': 'নোট (ঐচ্ছিক)',
  'Print': 'প্রিন্ট',
  'Edit': 'সম্পাদনা',

  // ---- Daily Entry (app/entry/page.js) ----
  'Count box': 'বাক্স গণনা',
  'Sales': 'বিক্রয়',
  'Bazar': 'বাজার',
  'Tomorrow': 'আগামীকাল',
  'Review': 'পর্যালোচনা',
  'Could not load this day.': 'এই দিনটি লোড করা যায়নি।',
  'Saved successfully!': 'সফলভাবে সংরক্ষিত হয়েছে!',
  'Could not reach the server.': 'সার্ভারে পৌঁছানো যায়নি।',
  'Shop was closed': 'দোকান বন্ধ ছিল',
  'Edit this day': 'এই দিনটি সম্পাদনা করুন',
  'Saved entry': 'সংরক্ষিত হিসাব',
  'Total sales': 'মোট বিক্রয়',
  'Expense (bazar)': 'খরচ (বাজার)',
  'Bazar advance (tomorrow)': 'বাজার অগ্রিম (আগামীকাল)',
  'Cash taken home': 'বাসায় নেওয়া নগদ',
  'Edit this entry': 'এই হিসাবটি সম্পাদনা করুন',
  'No entry yet': 'এখনও কোনো হিসাব নেই',
  'Start entry': 'হিসাব শুরু করুন',
  'Mark off day': 'ছুটির দিন চিহ্নিত করুন',
  'Shop closed': 'দোকান বন্ধ',
  'This day will be marked as an off day — no sales recorded.':
    'এই দিনটি ছুটির দিন হিসেবে চিহ্নিত হবে — কোনো বিক্রয় লেখা হবে না।',
  'e.g. Holiday, rain, personal day': 'যেমন ছুটি, বৃষ্টি, ব্যক্তিগত দিন',
  "Count today's box": 'আজকের বাক্স গণনা করুন',
  'By denomination': 'নোট অনুযায়ী',
  'Enter total': 'মোট লিখুন',
  'Total amount in box (৳)': 'বাক্সে মোট টাকা (৳)',
  'e.g. 10000': 'যেমন ১০০০০',
  'Total counted': 'মোট গণনা',
  "Today's total sales": 'আজকের মোট বিক্রয়',
  'How much bhangti (loose change) was already in the box from yesterday?':
    'গতকাল থেকে বাক্সে কত ভাংতি ছিল?',
  'Opening bhangti (৳)': 'শুরুর ভাংতি (৳)',
  '− Opening bhangti': '− শুরুর ভাংতি',
  "Today's sales": 'আজকের বিক্রয়',
  "Settle yesterday's bazar": 'গতকালের বাজার মেলান',
  "Bazar advance received (for today's shopping)": 'বাজার অগ্রিম পাওয়া গেছে (আজকের বাজারের জন্য)',
  'Actual bazar cost today': 'আজকের প্রকৃত বাজার খরচ',
  'Set aside for tomorrow': 'আগামীকালের জন্য আলাদা রাখুন',
  'Bazar advance to give chef now (৳)': 'এখন বাবুর্চিকে দেওয়া বাজার অগ্রিম (৳)',
  'Bhangti to keep in the box (৳)': 'বাক্সে রাখা ভাংতি (৳)',
  'Review & save': 'পর্যালোচনা ও সংরক্ষণ',
  'Bazar variance': 'বাজার পার্থক্য',
  "Tomorrow's bazar": 'আগামীকালের বাজার',
  "Tomorrow's bhangti": 'আগামীকালের ভাংতি',
  'Box is short.': 'বাক্সে টাকা কম পড়েছে।',
  "Not enough to cover tomorrow's advance and bhangti.":
    'আগামীকালের অগ্রিম ও ভাংতির জন্য যথেষ্ট নয়।',
  'Anything to remember': 'মনে রাখার মতো কিছু',
  '✕ Cancel': '✕ বাতিল',
  '← Back': '← পেছনে',
  'Next →': 'পরবর্তী →',
  '✓ Update': '✓ হালনাগাদ',
  '✓ Save': '✓ সংরক্ষণ',
  '✓ Mark off day': '✓ ছুটির দিন চিহ্নিত করুন',
  'Mark as off day?': 'ছুটির দিন হিসেবে চিহ্নিত করবেন?',
  'Update this entry?': 'এই হিসাবটি হালনাগাদ করবেন?',
  'Save this entry?': 'এই হিসাবটি সংরক্ষণ করবেন?',
  'Yes, mark off': 'হ্যাঁ, চিহ্নিত করুন',
  'Yes, update': 'হ্যাঁ, হালনাগাদ করুন',
  'Yes, save': 'হ্যাঁ, সংরক্ষণ করুন',

  // ---- Receipts (app/history/page.js) ----
  'No entry for this day yet.': 'এই দিনের জন্য এখনও কোনো হিসাব নেই।',
  'Go to Daily Entry': 'দৈনিক হিসাবে যান',
  'Daily Cash Receipt': 'দৈনিক নগদ রসিদ',
  'Shop Closed': 'দোকান বন্ধ',
  'Total Sales': 'মোট বিক্রয়',
  'Expense (Bazar)': 'খরচ (বাজার)',
  'Next day bazar advance': 'পরদিনের বাজার অগ্রিম',
  'Cash Taken Home': 'বাসায় নেওয়া নগদ',

  // ---- Dashboard (app/dashboard/page.js) ----
  '7 days': '৭ দিন',
  '14 days': '১৪ দিন',
  '30 days': '৩০ দিন',
  'This month': 'এই মাস',
  'All time': 'সর্বকাল',
  'Day': 'দিন',
  'Week': 'সপ্তাহ',
  'Month': 'মাস',
  'Total sales': 'মোট বিক্রয়',
  'Avg daily': 'দৈনিক গড়',
  'Total expense': 'মোট খরচ',
  'Taken home': 'বাসায় নেওয়া',
  'Days recorded': 'লেখা দিন',
  'Best day': 'সেরা দিন',
  'Last recorded': 'সর্বশেষ লেখা',
  'sales': 'বিক্রয়',
  'No data for this range yet.': 'এই সময়ের জন্য এখনও কোনো তথ্য নেই।',
  'Days': 'দিন',
  'Expense': 'খরচ',
  'Net': 'নিট',
  // dashboard API `range` labels, translated client-side:
  'Last 7 days': 'গত ৭ দিন',
  'Last 14 days': 'গত ১৪ দিন',
  'Last 30 days': 'গত ৩০ দিন',

  // ---- Products (app/products/page.js) ----
  'Daily quantities': 'দৈনিক পরিমাণ',
  'Manage menu': 'মেনু পরিচালনা',
  'How many sold today': 'আজ কতটি বিক্রি হয়েছে',
  'No menu items yet — add some under "Manage menu".':
    'এখনও কোনো মেনু আইটেম নেই — "মেনু পরিচালনা" থেকে যোগ করুন।',
  'Item': 'আইটেম',
  'Qty': 'পরিমাণ',
  'Value': 'মূল্য',
  'Total units sold': 'মোট বিক্রীত একক',
  'Menu value': 'মেনু মূল্য',
  'Saved.': 'সংরক্ষিত হয়েছে।',
  'Save quantities': 'পরিমাণ সংরক্ষণ করুন',
  'Menu items': 'মেনু আইটেম',
  'Price (৳)': 'দাম (৳)',
  'Active': 'সক্রিয়',
  'Hide': 'লুকান',
  'Show': 'দেখান',
  'Edit a price and click away from the field to save it.':
    'দাম পরিবর্তন করে ঘরের বাইরে ক্লিক করলে তা সংরক্ষিত হবে।',
  'Add a new item': 'নতুন আইটেম যোগ করুন',
  'Name': 'নাম',
  'e.g. Chicken Roll': 'যেমন চিকেন রোল',
  'e.g. 50': 'যেমন ৫০',
  'Add item': 'আইটেম যোগ করুন',
};

export function translate(lang, key) {
  if (lang !== 'bn') return key;
  return BN[key] ?? key;
}
```

- [ ] **Step 4: Run — verify pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/i18n.js lib/i18n.test.js
git commit -m "Add English/Bangla string dictionary"
```

---

### Task 3: `LangProvider`, `lib/dates.js` lang params, layout wiring

**Files:**
- Create: `app/LangProvider.js`
- Modify: `lib/dates.js`
- Modify: `app/layout.js`

**Interfaces:**
- Consumes: `translate`, `LANGS`, `DEFAULT_LANG`, `LANG_STORAGE_KEY` from `lib/i18n.js`; `formatTaka`, `formatNumber`, `toLocaleDigits` from `lib/numerals.js`; `formatDateLong`, `formatDateDisplay`, `formatDateNice` from `lib/dates.js`.
- Produces:
  - `LangProvider` (default export) — React context provider component.
  - `useLang()` (named export) — returns `{ lang, setLang, t, taka, num, digits, dateLong, dateDisplay, dateNice }`.
  - `lib/dates.js` format functions gain an optional trailing `lang` param.

- [ ] **Step 1: Add `lang` params to `lib/dates.js`**

Edit the three display helpers only (leave `todayStr`, `toDateStr`, `shiftDateStr` untouched). Add `import { toLocaleDigits } from './numerals.js';` at the top.

```js
export function formatDateDisplay(dateStr, lang) {
  const d = new Date(dateStr + 'T12:00:00');
  return toLocaleDigits(
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    lang,
  );
}

export function formatDateLong(dateStr, lang) {
  const d = new Date(dateStr + 'T12:00:00');
  return toLocaleDigits(
    d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    lang,
  );
}

export function formatDateNice(dateVal, lang) {
  const isoDatePart = String(dateVal).slice(0, 10);
  const d = new Date(isoDatePart + 'T12:00:00');
  if (isNaN(d)) return isoDatePart;
  return toLocaleDigits(
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    lang,
  );
}
```

`toLocaleDigits(s, undefined)` returns `s` unchanged, so existing callers that pass no `lang` keep working.

- [ ] **Step 2: Create `app/LangProvider.js`**

```jsx
'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { translate, LANGS, DEFAULT_LANG, LANG_STORAGE_KEY } from '@/lib/i18n';
import { formatTaka, formatNumber, toLocaleDigits } from '@/lib/numerals';
import { formatDateLong, formatDateDisplay, formatDateNice } from '@/lib/dates';

const LangContext = createContext(null);

export default function LangProvider({ children }) {
  const [lang, setLangState] = useState(DEFAULT_LANG);

  useEffect(() => {
    let stored = null;
    try {
      stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored && LANGS.includes(stored) && stored !== DEFAULT_LANG) {
      setLangState(stored);
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = lang;
    } catch {}
  }, [lang]);

  const setLang = useCallback((next) => {
    if (!LANGS.includes(next)) return;
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {}
    setLangState(next);
  }, []);

  const value = {
    lang,
    setLang,
    t: useCallback((key) => translate(lang, key), [lang]),
    taka: useCallback((n) => formatTaka(n, lang), [lang]),
    num: useCallback((n) => formatNumber(n, lang), [lang]),
    digits: useCallback((s) => toLocaleDigits(s, lang), [lang]),
    dateLong: useCallback((d) => formatDateLong(d, lang), [lang]),
    dateDisplay: useCallback((d) => formatDateDisplay(d, lang), [lang]),
    dateNice: useCallback((d) => formatDateNice(d, lang), [lang]),
  };

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
```

> Confirm `@/` path alias resolves — check `jsconfig.json`. v1 uses `@/lib/...` imports already (e.g. `app/api/entries/route.js`), so it does.

- [ ] **Step 3: Wrap `app/layout.js`**

```jsx
import './globals.css';
import LangProvider from './LangProvider';

// ...metadata and viewport unchanged...

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success. `npm test` still passes (dates.js change is covered indirectly; add no new test here — `toLocaleDigits` is already tested and the date functions keep their `en` output).

- [ ] **Step 5: Commit**

```bash
git add app/LangProvider.js lib/dates.js app/layout.js
git commit -m "Add LangProvider context and locale-aware date helpers"
```

---

### Task 4: `LangToggle` and `NumberInput` components + CSS

**Files:**
- Create: `app/LangToggle.js`
- Create: `app/NumberInput.js`
- Modify: `app/globals.css` (append rules)

**Interfaces:**
- Consumes: `useLang` from `app/LangProvider.js`; `parseLocaleNumber`, `formatNumber` from `lib/numerals.js`.
- Produces:
  - `LangToggle` (default export) — segmented EN/বাং button.
  - `NumberInput` (default export) — props `{ value, onValueChange(n, rawText), placeholder, min, autoFocus, className, id, disabled, 'aria-label' }`.

- [ ] **Step 1: `app/LangToggle.js`**

```jsx
'use client';

import { useLang } from './LangProvider';

export default function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button
        type="button"
        className={lang === 'en' ? 'on' : ''}
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        EN
      </button>
      <button
        type="button"
        className={lang === 'bn' ? 'on' : ''}
        aria-pressed={lang === 'bn'}
        onClick={() => setLang('bn')}
      >
        বাং
      </button>
    </div>
  );
}
```

- [ ] **Step 2: `app/NumberInput.js`**

```jsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { parseLocaleNumber, formatNumber } from '@/lib/numerals';
import { useLang } from './LangProvider';

function seed(value) {
  if (value == null || value === '') return '';
  return String(value);
}

export default function NumberInput({
  value,
  onValueChange,
  placeholder,
  min,
  autoFocus,
  className,
  id,
  disabled,
  ...rest
}) {
  const { lang } = useLang();
  const [text, setText] = useState(() => seed(value));
  const lastExternal = useRef(value);

  // Re-seed when a parent resets the value (e.g. form clear, day switch).
  useEffect(() => {
    if (value !== lastExternal.current) {
      lastExternal.current = value;
      setText(seed(value));
    }
  }, [value]);

  const parsed = parseLocaleNumber(text);
  const invalid = text.trim() !== '' && (parsed == null || (min != null && parsed < Number(min)));

  function handleChange(next) {
    setText(next);
    onValueChange(parseLocaleNumber(next), next);
  }

  function handleBlur() {
    if (parsed != null) setText(formatNumber(parsed, lang));
  }

  return (
    <input
      {...rest}
      id={id}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      autoFocus={autoFocus}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      value={text}
      aria-invalid={invalid || undefined}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
    />
  );
}
```

- [ ] **Step 3: Append to `app/globals.css`**

```css
/* ---- LANGUAGE TOGGLE ---- */
.lang-toggle { display: inline-flex; border: 1px solid var(--border2); border-radius: 8px; overflow: hidden; }
.lang-toggle button {
  background: var(--bg2); color: var(--text3); border: none; cursor: pointer;
  font-size: 12px; font-weight: 700; padding: 6px 10px; font-family: var(--sans);
}
.lang-toggle button.on { background: var(--brand-green); color: #fff; }

/* NumberInput invalid state (matches the app's red) */
input[aria-invalid='true'] { border-color: var(--red) !important; }
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add app/LangToggle.js app/NumberInput.js app/globals.css
git commit -m "Add LangToggle and NumberInput components"
```

---

### Task 5: Shell + Login — toggle placement and translation

**Files:**
- Modify: `app/AppShell.js`
- Modify: `app/login/page.js`

**Interfaces:**
- Consumes: `useLang` from `app/LangProvider.js`; `LangToggle` from `app/LangToggle.js`.

- [ ] **Step 1: `app/AppShell.js`**

Add `import LangToggle from './LangToggle';` and `import { useLang } from './LangProvider';`. In the component: `const { t } = useLang();`. The `TABS` array's `label` values stay English keys; render `{t(tab.label)}` instead of `{t.label}` — **rename the map param** from `t` to `tab` to avoid shadowing the `t` from `useLang` (the current code uses `TABS.map((t) => …)`). Wrap the tab label render in `t(...)`. Replace the `Log out` button text with `{t('Log out')}`. Add `<LangToggle />` inside `.topbar-inner`, before or after the Log out button.

Resulting `.topbar-inner`:

```jsx
<div className="topbar-inner">
  <div className="brand">
    <div className="brand-logo"><img src="/logo.jpg" alt="Soupresso" /></div>
    <div className="brand-name">Soupresso</div>
  </div>
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <LangToggle />
    <button className="btn secondary" style={{ padding: '7px 14px', fontSize: 12.5 }} onClick={logout}>
      {t('Log out')}
    </button>
  </div>
</div>
```

And the nav:

```jsx
<nav className="tabbar">
  {TABS.map((tab) => (
    <a key={tab.href} href={tab.href} className={pathname.startsWith(tab.href) ? 'active' : ''}>
      {t(tab.label)}
    </a>
  ))}
</nav>
```

- [ ] **Step 2: `app/login/page.js`**

`LoginForm` is where the strings live. Add `import { useLang } from '../LangProvider';` and `import LangToggle from '../LangToggle';`; `const { t } = useLang();` inside `LoginForm`. Translate: `'Cash register — sign in to continue'`, `'Email'`, `'Password'`, the two error strings (`data.error || t('Login failed.')` and the catch string), `'Signing in…'`, `'Sign in'`. Put `<LangToggle />` at the top of `.login-card` (before the logo, right-aligned) — e.g. wrap in `<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}><LangToggle /></div>`.

Leave the `<Suspense fallback={<div className="login-shell" />}>` and brand `Soupresso` heading as-is.

- [ ] **Step 3: Build + manual check**

Run: `npm run build`, then `npm run dev` (from the worktree; `.env.local` already points at local Postgres). Open `http://localhost:3000/login` at ~400px width:
1. Toggle shows EN active; click বাং → login copy switches to Bangla, `EN` no longer highlighted.
2. Reload the page → still Bangla (localStorage persisted).
3. Sign in with `dev@soupresso.local` / `devpass123` → lands on `/entry`; top bar shows the toggle and a Bangla "লগ আউট"; tabs are Bangla.
4. Toggle back to EN in the top bar → tabs + Log out revert.

- [ ] **Step 4: Commit**

```bash
git add app/AppShell.js app/login/page.js
git commit -m "Wire language toggle into shell and login, translate their strings"
```

---

### Task 6: Daily Entry — translation, NumberInput, numerals

**Files:**
- Modify: `app/entry/page.js`

**Interfaces:**
- Consumes: `useLang` from `../LangProvider`; `NumberInput` from `../NumberInput`.

- [ ] **Step 1: Imports and hook**

Add `import { useLang } from '../LangProvider';` and `import NumberInput from '../NumberInput';`. Inside `EntryPage`: `const { t, taka, num, dateNice } = useLang();`. Delete the local `const fmt = (n) => …` (line ~141) — replace every `fmt(x)` call with `taka(x)`.

- [ ] **Step 2: Replace the 6 number inputs**

Each `<input type="number" … />` becomes `<NumberInput … />` with `value` unchanged and `onChange={(e) => setX(e.target.value)}` becoming `onValueChange={(n) => setX(n ?? '')}` — **except** the denomination cells and the two "keep 0" numeric states, which must stay numeric:

| Location | Current | New |
|---|---|---|
| denomination cell (`denoms[d]`) | `onChange={(e) => setDenoms({ ...denoms, [d]: Math.max(0, Number(e.target.value) || 0) })}` | `<NumberInput value={denoms[d] || 0} min={0} onValueChange={(n) => setDenoms({ ...denoms, [d]: Math.max(0, n ?? 0) })} />` |
| direct total (`totalDirect`, string state) | `onChange={(e) => setTotalDirect(e.target.value)}` | `onValueChange={(n, raw) => setTotalDirect(n == null ? '' : String(n))}` |
| `openingBhangti` (string/number state, read via `Number(openingBhangti)`) | `onChange={(e) => setOpeningBhangti(e.target.value)}` | `onValueChange={(n) => setOpeningBhangti(n ?? '')}` |
| `bazarAdvanceReceived` | same shape | `onValueChange={(n) => setBazarAdvanceReceived(n ?? '')}` |
| `bazarActualCost` | same shape | `onValueChange={(n) => setBazarActualCost(n ?? '')}` |
| `nextBazarAdvance` | same shape | `onValueChange={(n) => setNextBazarAdvance(n ?? '')}` |
| `nextBhangti` | same shape | `onValueChange={(n) => setNextBhangti(n ?? '')}` |

The component already coerces these with `Number(openingBhangti) || 0` in `computeCashSummary` and the POST body, so storing `''` for "blank" is safe. Keep `autoFocus` where present. Keep `placeholder` (translate the `'e.g. 10000'` one via `t`).

The denomination subtotal `= ৳{(d * (denoms[d] || 0)).toLocaleString()}` → `= {taka(d * (denoms[d] || 0))}` (note: drop the leading `৳` since `taka` adds it).

- [ ] **Step 3: Replace every `.toLocaleString()` / inline number**

Search the file for `toLocaleString` and `৳{`. Replace:
- `৳{totalCounted.toLocaleString()}` → `{taka(totalCounted)}`
- `৳{Number(openingBhangti || 0).toLocaleString()}` → `{taka(Number(openingBhangti) || 0)}`
- `৳{summary.totalSales.toLocaleString()}` → `{taka(summary.totalSales)}`
- `{summary.bazarVariance >= 0 ? '−' : '+'}৳{Math.abs(summary.bazarVariance).toLocaleString()}` → `{summary.bazarVariance >= 0 ? '−' : '+'}{taka(Math.abs(summary.bazarVariance))}`
- `−৳{Number(nextBazarAdvance || 0).toLocaleString()}` → `{'−'}{taka(Number(nextBazarAdvance) || 0)}`
- `−৳{Number(nextBhangti || 0).toLocaleString()}` → `{'−'}{taka(Number(nextBhangti) || 0)}`
- the two `৳{summary.*.toLocaleString()}` in the confirm modal → `{taka(summary.*)}`
- the `existingEntry.*` values already go through `fmt(...)` → now `taka(...)`
- step counter `{step + 1} / {TOTAL_STEPS}` → `{num(step + 1)} / {num(TOTAL_STEPS)}`

- [ ] **Step 4: Translate strings**

Wrap every user-facing literal in `t(...)`. Full list (keys are already in `BN` from Task 2): the `stepLabels` array (`['Count box','Sales','Bazar','Tomorrow','Review']` → render `{t(label)}` in the dot map), the `msg` texts (`'Could not load this day.'`, `'Save failed.'`, `'Saved successfully!'`, `'Could not reach the server.'`), `'Loading…'`, `'Shop was closed'`, `'Edit this day'`, `'Saved entry'`, `'Total sales'`, `'Expense (bazar)'`, `'Bazar advance (tomorrow)'`, `'Bhangti in box'`, `'Cash taken home'`, `'Edit this entry'`, `'No entry yet'`, `'Start entry'` (rendered as `＋ Start entry` — keep the `＋ ` prefix outside `t`: `＋ {t('Start entry')}`), `'Mark off day'` (`🚫 {t('Mark off day')}`), `'Shop closed'`, `'This day will be marked as an off day — no sales recorded.'`, `'Note (optional)'`, `'e.g. Holiday, rain, personal day'`, `"Count today's box"`, `'By denomination'`, `'Enter total'`, `'Total amount in box (৳)'`, `'e.g. 10000'`, `'Total counted'`, `"Today's total sales"`, `'How much bhangti (loose change) was already in the box from yesterday?'`, `'Opening bhangti (৳)'`, `'− Opening bhangti'`, `"Today's sales"`, `"Settle yesterday's bazar"`, `"Bazar advance received (for today's shopping)"`, `'Actual bazar cost today'`, `'Set aside for tomorrow'`, `'Bazar advance to give chef now (৳)'`, `'Bhangti to keep in the box (৳)'`, `'Review & save'`, `'Bazar variance'`, `"Tomorrow's bazar"`, `"Tomorrow's bhangti"`, `'Box is short.'`, `"Not enough to cover tomorrow's advance and bhangti."`, `'Notes (optional)'`, `'Anything to remember'`, `'✕ Cancel'`, `'← Back'`, `'Next →'`, `'Saving…'`, `'✓ Update'`, `'✓ Save'`, `'✓ Mark off day'`, `'Cancel'` (the off-day branch's plain "Cancel"), `'Mark as off day?'`, `'Update this entry?'`, `'Save this entry?'`, `'Yes, mark off'`, `'Yes, update'`, `'Yes, save'`.

The three confirm-modal sentences interpolate the date. Build them as: `` `${t('Mark')} ${dateDisplay(date)} ${t('as a shop off day.')}` `` is fragile — instead keep them English-structured but translate the whole template via a small inline helper OR accept these three sentences staying English for now. **Decision:** translate them with placeholder substitution — add to `BN` (Task 2 already has the short forms; extend at implement time if the reviewer wants the full sentences). For this task: render the modal `<p>` as:
- off day: `{t('Mark as off day?')}` is the `<h3>`; for the `<p>`, use `{dateDisplay(date)}` alone with `{t('This day will be marked as an off day — no sales recorded.')}`.
- existing: `<p>{t('Update this entry?')} — {dateDisplay(date)}` and drop the "Previous version kept in the audit log" clause, or translate it if the reviewer asks.
- new: `<p>{t('Save this entry?')} — {dateDisplay(date)}`.

Replace `formatDateDisplay(date)` calls that remain with `dateDisplay(date)` from the hook, and the `carryForwardNote` construction `Carried forward from ${formatDateNice(...)}` → `` `${t('Carried forward from')} ${dateNice(data.carryForward.fromDate)}` `` and add `'Carried forward from': 'যেখান থেকে আনা হয়েছে'` to `BN` (Task 2 — add it there when doing this task; note the cross-task edit in the commit).

> Cross-task note: this task adds one key (`'Carried forward from'`) to `lib/i18n.js`. That is expected; keep `lib/i18n.test.js` green (the new value is non-empty and ≠ key).

- [ ] **Step 5: Build**

Run: `npm run build && npm test`
Expected: both pass.

- [ ] **Step 6: Manual verification**

`npm run dev`, mobile viewport, signed in, on `/entry`:
1. EN mode: wizard reads exactly as before; every number Western.
2. Start an entry, step 1 "By denomination": type `২` in the ৳৫০০ cell → subtotal shows `৳1,000` (EN) / switch to BN → `৳১,০০০`, and the cell shows `২`.
3. Step 1 "Enter total": type `১০০০০` → "Total counted ৳10,000" / BN `৳১০,০০০`.
4. Step 2: opening bhangti `৫০০` → "Today's sales" reflects `total − 500`.
5. Steps 3–4: enter bazar advance / cost / next amounts in Bangla digits; variance label and "Cash taken home" compute correctly.
6. Save → confirm modal shows correct figures → Yes → "Saved successfully!" (or Bangla). Reload the day → saved summary matches.
7. Toggle BN everywhere in the wizard: all labels, step names, buttons, modal in Bangla; all numbers Bangla numerals.
8. Blur a number field after typing `1500` → shows `1,500` (EN) / `১,৫০০` (BN).

- [ ] **Step 7: Commit**

```bash
git add app/entry/page.js lib/i18n.js
git commit -m "Translate Daily Entry and swap to NumberInput / Bangla numerals"
```

---

### Task 7: Receipts + Dashboard — translation and numerals

**Files:**
- Modify: `app/history/page.js`
- Modify: `app/dashboard/page.js`

**Interfaces:**
- Consumes: `useLang` from `../LangProvider`.

- [ ] **Step 1: `app/history/page.js`**

Add `import { useLang } from '../LangProvider';`; `const { t, taka, dateLong } = useLang();`. Delete local `fmt`, use `taka`. `formatDateLong(date)` → `dateLong(date)`. Translate: `'Loading…'`, `'No entry for this day yet.'`, `'Go to Daily Entry'`, `'Daily Cash Receipt'`, `'Shop Closed'`, `'Total Sales'`, `'Expense (Bazar)'`, `'Next day bazar advance'`, `'Bhangti in box'`, `'Cash Taken Home'`, and the two footer buttons — render `🖨 {t('Print')}` and `✎ {t('Edit')}`. The negative-amount branch `{Number(entry.cash_taken_home) < 0 ? '−' : ''}{fmt(entry.cash_taken_home)}` → since `taka` now emits its own `−` for negatives, change to just `{taka(Number(entry.cash_taken_home))}` and drop the manual sign and the `Math.abs` inside the old `fmt` (use `taka` which handles sign). Leave `entry.notes` verbatim.

- [ ] **Step 2: `app/dashboard/page.js`**

Add the hook: `const { t, taka, num, dateDisplay } = useLang();`. Delete local `fmt`, use `taka`.

- `RANGES` and `VIEWS`: keep the arrays as-is (English `label` values are dictionary keys); render `{t(r.label)}` / `{t(v.label)}` in the two `.map`s.
- KPI labels: `{t('Total sales')}`, `{t('Avg daily')}`, `{t('Total expense')}`, `{t('Taken home')}`, `{t('Days recorded')}`, `{t('Best day')}`.
- `{s.daysRecorded || 0}` → `{num(s.daysRecorded || 0)}`.
- "Most recent day" card: `{t('Last recorded')}`, `{t('sales')}`, and the date via `dateDisplay(...)` — replace `new Date(data.mostRecent.entry_date).toLocaleDateString('en-US', {...})` with `dateDisplay(String(data.mostRecent.entry_date).slice(0,10))`. Same for `s.bestDay.entry_date`.
- Chart: `Sales — {data?.range}` → `{t('Sales')} — {t(data?.range || '')}` (the API returns `'Last 7 days'` / `'Last 14 days'` / `'Last 30 days'` / `'This month'` / `'All time'` — all are dictionary keys). Bar value labels `{fmt(val)}` → `{taka(val)}`. `chartLabel` returns `d.getDate()` (a number) for the daily view → wrap: `return num(d.getDate())`; weekly/monthly labels are `month/day` strings or `YYYY-MM` — wrap in `digits(...)` (add `digits` to the hook destructure) so the digits localize. `chartTooltip` strings: leave English structure but run the numbers through `taka`; acceptable to leave tooltips English for now (native `title` attr — low priority; note it).
- "No data for this range yet." → `{t('No data for this range yet.')}`.
- Weekly/monthly table headers: `{view === 'weekly' ? t('Week') : t('Month')}`, `{t('Days')}`, `{t('Sales')}`, `{t('Expense')}`, `{t('Net')}`. Body: `{r.days_count}` → `{num(r.days_count)}`; the three money cells → `taka`; the label cell date → `dateDisplay` or `digits`.
- `maxSale` / `barH` math is numeric — unchanged.

- [ ] **Step 3: Build**

Run: `npm run build && npm test`
Expected: pass.

- [ ] **Step 4: Manual verification**

`npm run dev`, signed in:
1. `/history` — pick a seeded day (e.g. use the date picker to Aug 20). Receipt renders; toggle BN → labels + amounts + the long date all Bangla (month/weekday still English words, digits Bangla). Print preview (`🖨`) still looks right.
2. A day with negative `cash_taken_home` (Aug 16 or 21) → shows `−৳…` once, not `−−` or `৳-…`.
3. `/dashboard` — KPIs, chart, and (switch to Week/Month view) the summary table all translate and localize digits on toggle. Range pills + view pills translate. Numbers in the bars localize.

- [ ] **Step 5: Commit**

```bash
git add app/history/page.js app/dashboard/page.js
git commit -m "Translate Receipts and Dashboard, localize their numerals"
```

---

### Task 8: Products — translation and NumberInput

**Files:**
- Modify: `app/products/page.js`

**Interfaces:**
- Consumes: `useLang` from `../LangProvider`; `NumberInput` from `../NumberInput`.

- [ ] **Step 1: Hook + imports**

`import { useLang } from '../LangProvider';`, `import NumberInput from '../NumberInput';`, `const { t, num } = useLang();`.

- [ ] **Step 2: Replace 3 number inputs**

| Field | Current | New |
|---|---|---|
| daily quantity (`item.quantity`) | `<input type="number" min="0" value={item.quantity} onChange={(e) => { const next=[...items]; next[idx]={...item, quantity: Math.max(0, Number(e.target.value)||0)}; setItems(next); }} />` | `<NumberInput value={item.quantity} min={0} onValueChange={(n) => { const next=[...items]; next[idx]={...item, quantity: Math.max(0, n ?? 0)}; setItems(next); }} />` |
| price edit (`item.price`, uncontrolled `defaultValue` + `onBlur`) | `<input type="number" min="0" defaultValue={item.price} style={{width:80}} onBlur={(e) => { if (Number(e.target.value) !== Number(item.price)) updatePrice(item, e.target.value); }} />` | `<NumberInput value={item.price} min={0} className="" onValueChange={(n) => { if (n != null && n !== Number(item.price)) updatePrice(item, n); }} />` — note: switches from onBlur-only to on-change; `updatePrice` already guards `isNaN`. Keep the `width:80` via a style prop passthrough (`NumberInput` spreads `...rest`, so `style={{ width: 80 }}` works). |
| new item price (`newPrice` string state) | `<input type="number" min="0" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="e.g. 50" />` | `<NumberInput value={newPrice} min={0} placeholder={t('e.g. 50')} onValueChange={(n) => setNewPrice(n == null ? '' : String(n))} />` |

`addMenuItem` does `Number(newPrice)` — still fine with a normalized string. `updatePrice(item, newPrice)` receives a number now instead of a string — its body does `Number(newPrice)`, still fine.

- [ ] **Step 3: `.toLocaleString()` → `num`**

- `৳{(item.quantity * Number(item.price)).toLocaleString()}` → `{`৳${num(item.quantity * Number(item.price))}`}` (or import nothing extra — `num` is enough; keep the `৳` prefix literal).
- `৳{totalValue.toLocaleString()}` → `৳{num(totalValue)}`.
- `{totalUnits}` and `{item.quantity}` display cells → `{num(totalUnits)}`, and the qty is inside `NumberInput` so untouched.
- `৳{Number(item.price)}/unit` → `৳{num(Number(item.price))}{t('/unit')}` — add `'/unit': '/একক'` to `BN` (Task 2; cross-task note in commit).

- [ ] **Step 4: Translate strings**

`{t('Daily quantities')}`, `{t('Manage menu')}`, `{t('How many sold today')}`, `{t('Loading…')}`, `{t('No menu items yet — add some under "Manage menu".')}`, table headers `{t('Item')}`/`{t('Qty')}`/`{t('Value')}`, `{t('Total units sold')}`, `{t('Menu value')}`, the `msg` texts (`'Saved.'`, `'Save failed.'`), `{t('Saving…')}` / `{t('Save quantities')}`, `{t('Menu items')}`, `{t('Price (৳)')}`, `{t('Active')}`, `{t('Hide')}`/`{t('Show')}`, `{t('Edit a price and click away from the field to save it.')}`, `{t('Add a new item')}`, `{t('Name')}`, `placeholder={t('e.g. Chicken Roll')}`, `{t('Add item')}`. Leave `item.name` verbatim.

- [ ] **Step 5: Build**

Run: `npm run build && npm test`
Expected: pass.

- [ ] **Step 6: Manual verification**

`npm run dev`, signed in, `/products`:
1. "Daily quantities" tab: type a quantity in Bangla digits → the Value cell updates, totals update. Save → `/api/daily-sales` succeeds (check no error toast; the day must have a `daily_entries` row — the route auto-creates one).
2. "Manage menu" tab: edit a price to `৯৫`, click away → persists (reload shows 95). Add a new item with Bangla price.
3. Toggle BN → all labels/headers/buttons Bangla, all numbers Bangla numerals.

- [ ] **Step 7: Commit**

```bash
git add app/products/page.js lib/i18n.js
git commit -m "Translate Products and swap to NumberInput"
```

---

### Task 9: API route hardening

**Files:**
- Modify: `app/api/entries/route.js`
- Modify: `app/api/daily-sales/route.js`
- Modify: `app/api/products/route.js`

**Interfaces:**
- Consumes: `coerceLocaleNumber` from `@/lib/numerals`.

- [ ] **Step 1: `app/api/entries/route.js`**

Add `import { coerceLocaleNumber } from '@/lib/numerals';`. The POST handler builds `nums` and calls `computeCashSummary` / the INSERT with `Number(x) || 0`. Replace each `Number(x) || 0` for the six body amounts (`totalCounted`, `openingBhangti`, `bazarAdvanceReceived`, `bazarActualCost`, `nextBazarAdvance`, `nextBhangti`) with `(coerceLocaleNumber(x) ?? 0)`. The `isNaN(Number(val))` validation loop: change to `coerceLocaleNumber(val) == null && val !== '' && val != null` → return the `${key} must be a number` error. Keep everything else (audit-log snapshot, upsert SQL) identical.

- [ ] **Step 2: `app/api/daily-sales/route.js`**

The POST loop does `Math.max(0, Number(quantity) || 0)`. Change to `Math.max(0, coerceLocaleNumber(quantity) ?? 0)`. Add the import.

- [ ] **Step 3: `app/api/products/route.js`**

`price` is validated with `isNaN(Number(price))` and stored via `Number(price)`. Add the import; replace with `coerceLocaleNumber(price)` — store `const p = coerceLocaleNumber(price); if (p == null) return 400`. `sortOrder` similarly via `coerceLocaleNumber(sortOrder) ?? 0`.

- [ ] **Step 4: Build + smoke**

Run: `npm run build`. Then `npm run dev` and, signed in, POST a Bangla-digit amount directly to prove the server path:

```bash
# from the worktree, after logging in via the browser and copying the cookie,
# or reuse the smoke pattern: log in, then:
curl -s -b /tmp/soup-cookies.txt -X POST http://localhost:3000/api/entries \
  -H 'Content-Type: application/json' \
  -d '{"entryDate":"2026-09-09","totalCounted":"১৫০০","openingBhangti":"৫০০","bazarActualCost":0,"bazarAdvanceReceived":0,"nextBazarAdvance":0,"nextBhangti":0,"notes":"bn digit test"}'
# expect: {"entry":{...,"total_counted":"1500.00","total_sales":"1000.00",...}}
```

Then delete that test row: `psql "postgres://soupresso@localhost:5544/soupresso" -c "delete from daily_entries where entry_date='2026-09-09';"`

- [ ] **Step 5: Commit**

```bash
git add app/api/entries/route.js app/api/daily-sales/route.js app/api/products/route.js
git commit -m "Defensively parse Bangla/Western digits in API routes"
```

---

### Task 10: Verification sweep

**Files:** whatever the greps flag.

- [ ] **Step 1: Grep gates**

```bash
grep -rn 'type="number"' app/          # expect: none
grep -rn 'toLocaleString(' app/         # expect: none
grep -rn 'toLocaleDateString(' app/     # expect: only inside comments, if any — dashboard/history/entry should route through the hook
grep -rn "const fmt = " app/            # expect: none
```

Fix any straggler: route it through `useLang()` (`taka`/`num`/`dateDisplay`).

- [ ] **Step 2: Unused-key check**

For each key in `BN`, confirm it appears as a `t('…')` call somewhere in `app/` (or is a documented API-label key: the five dashboard `range` labels). Remove any dead key. Confirm no `t('…')` call in `app/` uses a string absent from `BN` (those silently fall back to English — a missed translation). List any and add them.

```bash
# rough helper: list t('...') keys used
grep -rhoE "t\('([^']|\\\\')+'\)" app/ | sed "s/^t('//;s/')$//" | sort -u
```

- [ ] **Step 3: Full suite**

Run: `npm test && npm run build`
Expected: green.

- [ ] **Step 4: Full manual pass (both languages, ~400px viewport)**

`npm run dev`, sign in. In EN then BN:
1. Every screen renders, no console errors, no horizontal scroll.
2. Toggle persists across reloads and across navigation between tabs.
3. Numbers: every visible number flips script on toggle — entry wizard (denoms, calc rows, review, confirm modal), receipts, dashboard KPIs + chart + table, products.
4. Inputs: each of the 9 number fields accepts `১৫০০`-style input and yields the right saved value; English digits still work; blur reformats to grouped digits in the current script.
5. Dates: receipts + dashboard show Bangla digits with English month/weekday names in BN mode.
6. Free text (a note you typed, menu item names) is NOT translated.
7. `<html lang>` attribute follows the toggle (devtools → `<html>` element).

- [ ] **Step 5: Final commit (if the sweep changed anything)**

```bash
git add -A
git commit -m "Bilingual support: verification sweep"
```

---

## Self-Review

**1. Spec coverage**

| Spec item | Task |
|---|---|
| `lib/numerals.js` (parse/coerce/digits/formatNumber/formatTaka) | Task 1 |
| Test runner (`node --test`, no `"type":"module"`) | Task 1 |
| `lib/i18n.js` + full BN dictionary | Task 2 |
| `LangProvider` (localStorage, en-first render, `document.lang`) | Task 3 |
| `lib/dates.js` lang params, English names + Bangla digits | Task 3 |
| `app/layout.js` provider wrap | Task 3 |
| `LangToggle` (top bar + login) | Tasks 4, 5 |
| `NumberInput` | Task 4 (component), Tasks 6/8 (adoption) |
| globals.css toggle + invalid styles | Task 4 |
| Translate shell + login | Task 5 |
| Translate Daily Entry + NumberInput ×6 + numerals | Task 6 |
| Translate Receipts + Dashboard + numerals + dates | Task 7 |
| Translate Products + NumberInput ×3 | Task 8 |
| API route hardening (`coerceLocaleNumber`) | Task 9 |
| Grep gates, unused-key check, both-language manual pass | Task 10 |
| No schema/data change | Global Constraints (no task touches SQL schema or writes migrations) |
| Free-text not translated | Tasks 6/8 (notes, item names left verbatim) |

No gaps.

**2. Placeholder scan**

- Task 1 Step 5 and Task 6 Step 4 flag *conditional* implementation decisions (ICU grouping fallback; confirm-modal sentence structure) with the concrete fallback spelled out. Not open-ended.
- Tasks 6 and 8 add keys to `lib/i18n.js` (`'Carried forward from'`, `'/unit'`) — explicitly called out as cross-task edits with the exact key/value, and `i18n.test.js` stays green.
- No "TBD", no "handle errors", no "write tests for the above" without the test code.

**3. Type/name consistency**

- `useLang()` returns `{ lang, setLang, t, taka, num, digits, dateLong, dateDisplay, dateNice }` — defined Task 3, consumed Tasks 5–8 with exactly those names.
- `NumberInput` prop `onValueChange(n, rawText)` — defined Task 4, called that way in Tasks 6 and 8.
- `coerceLocaleNumber` — defined Task 1, imported in Tasks 3 (via provider it's `formatTaka`/`formatNumber` only — no, provider uses those; `coerceLocaleNumber` is Task 9 only) and Task 9. Consistent.
- `translate(lang, key)` / `t(key)` — `lib/i18n.js` exports `translate`; the provider wraps it as `t`. Pages use `t`. Consistent.
- `formatTaka`/`formatNumber` signatures `(n, lang)` — Task 1 definition; Task 3 provider binds `lang`. Consistent.

Consistent.
