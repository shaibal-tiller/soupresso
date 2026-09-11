// The exact cash-reconciliation logic, in one place so the entry form
// (live preview) and the API (source of truth on save) can never disagree.
//
// Terminology, deliberately precise:
//   - "Bazar variance" is actual_cost minus advance_received. Positive means
//     the chef needed extra money for bazar and was topped up from the box
//     (today or as part of closing); negative means the chef returned unspent
//     advance to the box. Either way, that movement is a chef-settlement, not
//     a sale.
//   - "Total Sales" is total_counted minus opening_bhangti, adjusted by
//     bazar_variance so a chef top-up/return never inflates or deflates the
//     reported sales figure: total_counted - opening_bhangti + bazar_variance.
//     Not revenue, not profit — gross cash collected today, net of the
//     chef-settlement noise.
//   - "Cash taken home" is simply what's left in the box now, minus what's
//     set aside for tomorrow's bazar advance and bhangti float. It does not
//     need to account for bazar_variance separately — total_counted already
//     reflects however that settlement happened.

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

export function denominationTotal(denominations) {
  if (!denominations) return 0;
  return Object.entries(denominations).reduce(
    (sum, [note, qty]) => sum + Number(note) * (Number(qty) || 0),
    0
  );
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export const STANDARD_DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
