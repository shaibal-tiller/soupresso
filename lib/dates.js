// Safe local-date helpers.
// new Date().toISOString().slice(0,10) is WRONG in any timezone east of UTC —
// it converts to UTC first, which can shift the date back by one day.
// These helpers always use local time, which is what the user means by "today".

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

export function formatDateDisplay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateLong(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatDateNice(dateVal) {
  const isoDatePart = String(dateVal).slice(0, 10);
  const d = new Date(isoDatePart + 'T12:00:00');
  if (isNaN(d)) return isoDatePart;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
