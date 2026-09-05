// The exact cash-reconciliation logic, in one place so the entry form
// (live preview) and the API (source of truth on save) can never disagree.
//
// Terminology, deliberately precise:
//   - "Total Sales" is total_counted minus opening_bhangti. That's it —
//     not revenue, not profit. It's gross cash collected today.
//   - "Bazar variance" is actual_cost minus advance_received. Positive
//     means the chef needs more money; negative means the chef returns
//     the difference to the box.
//   - "Cash taken home" is what's left after settling the bazar variance
//     and setting aside tomorrow's bazar advance and bhangti float.

export function computeCashSummary({
  totalCounted = 0,
  openingBhangti = 0,
  bazarAdvanceReceived = 0,
  bazarActualCost = 0,
  nextBazarAdvance = 0,
  nextBhangti = 0,
} = {}) {
  const totalSales = round2(totalCounted - openingBhangti);
  const bazarVariance = round2(bazarActualCost - bazarAdvanceReceived);
  const cashTakenHome = round2(
    totalCounted - bazarVariance - nextBazarAdvance - nextBhangti
  );

  return {
    totalSales,
    bazarVariance,
    cashTakenHome,
    // A negative bazarVariance means the chef returns money to the box.
    bazarVarianceLabel:
      bazarVariance > 0
        ? `Give chef extra: ${bazarVariance.toFixed(2)}`
        : bazarVariance < 0
        ? `Chef returns: ${Math.abs(bazarVariance).toFixed(2)}`
        : 'Exact — no variance',
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
