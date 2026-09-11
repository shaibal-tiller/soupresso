// The exact cash-reconciliation logic, in one place so the entry form
// (live preview) and the API (source of truth on save) can never disagree.
//
// Terminology, deliberately precise:
//   - "Bazar variance" is actual_cost minus advance_received. Positive means
//     the chef needed extra money for bazar; negative means he has unspent
//     advance to return. A positive variance can be settled two different
//     ways, and it matters which:
//       (a) the chef took the extra cash directly OUT OF THE BOX himself,
//           at some point before the box gets counted. By the time you
//           count, that cash has already left, so it must be added BACK
//           when computing sales — otherwise it silently reads as lower
//           sales, when it was really an expense.
//       (b) the chef paid the extra out of his OWN POCKET and is reimbursed
//           FROM THE BOX as part of closing (today, after the count). The
//           box was untouched by the purchase itself, so sales need no
//           adjustment — but the reimbursement is paid out of what you just
//           counted, so it reduces cash taken home. This is the default
//           (`bazarTakenFromBox = 0`) — unchanged from how this app always
//           worked.
//     `bazarTakenFromBox` tells the two apart: it's how much of a positive
//     variance the chef already took from the box himself; the remainder
//     (`toReimburse`) is what's paid to him from the box now.
//   - A negative variance (chef returns unspent advance) is cash that's
//     physically in the box by the time you count it, but didn't come from
//     today's sales — so it's subtracted, same as always.
//   - "Total Sales" = total_counted - opening_bhangti + salesAdjustment,
//     where salesAdjustment is `bazarTakenFromBox` (case a) or the full
//     (negative) variance (the return case) — never the reimbursed-from-box
//     portion, which never touched the box before counting.
//   - "Cash taken home" = total_counted - toReimburse - next_bazar_advance
//     - next_bhangti. `toReimburse` is 0 whenever variance <= 0.

export function computeCashSummary({
  totalCounted = 0,
  openingBhangti = 0,
  bazarAdvanceReceived = 0,
  bazarActualCost = 0,
  bazarTakenFromBox = 0,
  nextBazarAdvance = 0,
  nextBhangti = 0,
} = {}) {
  const bazarVariance = round2(bazarActualCost - bazarAdvanceReceived);
  const takenFromBox = bazarVariance > 0
    ? round2(Math.min(Math.max(0, bazarTakenFromBox), bazarVariance))
    : 0;
  const toReimburse = bazarVariance > 0 ? round2(bazarVariance - takenFromBox) : 0;
  const salesAdjustment = bazarVariance > 0 ? takenFromBox : bazarVariance;
  const totalSales = round2(totalCounted - openingBhangti + salesAdjustment);
  const cashTakenHome = round2(totalCounted - toReimburse - nextBazarAdvance - nextBhangti);

  return {
    totalSales,
    bazarVariance,
    takenFromBox,
    toReimburse,
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
