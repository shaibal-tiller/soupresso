// Safe local-date helpers.
// new Date().toISOString().slice(0,10) is WRONG in any timezone east of UTC —
// it converts to UTC first, which can shift the date back by one day.
// These helpers always use local time, which is what the user means by "today".

import { toLocaleDigits } from './numerals.js';

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toDateStr(date) {
  // Convert a Date object to YYYY-MM-DD using local time, not UTC.
  if (typeof date === 'string') return date.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftDateStr(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00'); // noon avoids DST edge cases
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

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

// `dateVal` here may be a plain `YYYY-MM-DD` string (from a date input, a
// query param, or app-generated via toDateStr) OR a full ISO timestamp
// string as produced when a Postgres `date` column round-trips through
// JSON (node-postgres parses `date` columns as local midnight, and
// `JSON.stringify`/`Date#toJSON` always re-emit that instant in UTC — e.g.
// local midnight 2026-09-11 in Asia/Dhaka, UTC+6, becomes
// "2026-09-10T18:00:00.000Z"). Slicing the first 10 characters of that
// string would grab the UTC calendar date, which is one day behind the
// real local date for any UTC+ timezone — so a full timestamp must be
// parsed as the absolute instant it names, not sliced.
function toLocalDate(dateVal) {
  const s = String(dateVal);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(s + 'T12:00:00'); // noon avoids DST edge cases
  }
  return new Date(s);
}

export function formatDateNice(dateVal, lang) {
  const d = toLocalDate(dateVal);
  if (isNaN(d)) return String(dateVal).slice(0, 10);
  return toLocaleDigits(
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    lang,
  );
}

// Compact, no-year date — dashboard chart labels/tooltips and KPI sub-labels,
// where the year is implied and screen space is tight. Optionally include a
// short weekday (used for the "most recent day" summary).
export function formatDateShort(dateVal, lang, opts = {}) {
  const d = toLocalDate(dateVal);
  if (isNaN(d)) return String(dateVal).slice(0, 10);
  const fmtOpts = { month: 'short', day: 'numeric' };
  if (opts.weekday) fmtOpts.weekday = opts.weekday;
  return toLocaleDigits(d.toLocaleDateString('en-US', fmtOpts), lang);
}
