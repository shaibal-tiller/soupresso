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
