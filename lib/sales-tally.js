// Pure reconciliation math for the Sales Tally feature. No DB, no React —
// see docs/superpowers/specs/2026-09-27-sales-tally-design.md.

export const GOOD_THRESHOLD = 50;
export const WARNING_THRESHOLD = 100;

/**
 * quantity sold for one item, given its tracking mode.
 * - production: sum of all logged batch quantities, minus that day's
 *   leftoverQty — unsold pieces were never sold that day, whether or not
 *   they get carried forward to tomorrow's batch list.
 * - bowl_single: the closing single count (doubleCount is ignored).
 * - bowl_double: single + 2*double (two portions sometimes share one bowl).
 */
export function quantitySoldForItem(item) {
  if (item.trackingMode === 'production') {
    const made = (item.entries || []).reduce((sum, e) => sum + Number(e.quantity), 0);
    return Math.max(0, made - Number(item.leftoverQty || 0));
  }
  if (item.trackingMode === 'bowl_double') {
    return Number(item.singleCount || 0) + 2 * Number(item.doubleCount || 0);
  }
  // bowl_single
  return Number(item.singleCount || 0);
}

/** good (<=50 off), warning (<=100 off), or danger (>100 off) — thresholds are on abs(variance). */
export function varianceStatus(variance) {
  const abs = Math.abs(variance);
  if (abs <= GOOD_THRESHOLD) return 'good';
  if (abs <= WARNING_THRESHOLD) return 'warning';
  return 'danger';
}

/**
 * computedTotal = sum(quantitySold(item) * item.price) across all items.
 * actualSales === null means no cash entry exists yet for the date, so
 * variance/status stay null rather than comparing against a fabricated 0.
 */
export function computeReconciliation(items, actualSales) {
  const computedTotal = items.reduce(
    (sum, item) => sum + quantitySoldForItem(item) * Number(item.price),
    0
  );
  if (actualSales == null) {
    return { computedTotal, actualSales: null, variance: null, status: null };
  }
  const variance = computedTotal - Number(actualSales);
  return { computedTotal, actualSales: Number(actualSales), variance, status: varianceStatus(variance) };
}
