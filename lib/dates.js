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
// JSON (node-postgres parses `date` columns as local midnight in the
// SERVER's timezone, and JSON serialization re-emits that instant in UTC —
// e.g. server-local midnight 2026-09-11 in a UTC+6 timezone becomes
// "2026-09-10T18:00:00.000Z"). For a full timestamp we parse it as the
// absolute instant it names and let `toLocaleDateString` resolve it back to
// a calendar date in the BROWSER's timezone. That recovers the original
// server-local date correctly whenever the browser's UTC offset is at or
// east of the server's (true for this app: Vercel runs UTC, and its users
// are in Asia/Dhaka, UTC+6) — but is not a general fix for every
// server/browser timezone combination. The fully robust fix would have the
// API routes serialize dates as `to_char(col, 'YYYY-MM-DD')` so the wire
// format is an unambiguous calendar date (handled by the branch below);
// that's a larger change than this comment note covers.
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
