// Pure math + rules for the Cash in Hand ledger. See
// docs/superpowers/specs/2026-09-25-cash-in-hand-design.md for the full
// design. This file has no DB/fetch calls — API routes own the I/O and call
// these functions, same split as lib/cash-math.js.

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function computeClosingBalance({ openingBalance = 0, dayDelta = 0, adjustmentDelta = 0 } = {}) {
  return round2(Number(openingBalance) + Number(dayDelta) + Number(adjustmentDelta));
}

// A pending day confirms once either the next day's entry exists, or 24h
// have passed since it went pending — whichever comes first.
export function isConfirmEligible({ pendingSince, now = new Date(), hasNextDayEntry = false }) {
  if (hasNextDayEntry) return true;
  const pendingMs = new Date(pendingSince).getTime();
  return now.getTime() - pendingMs >= 24 * 60 * 60 * 1000;
}

// Given ledger rows in ascending entry_date order (plain objects with
// opening_balance/day_delta/adjustment_delta/closing_balance), applies
// `amount` to the row at targetIndex's adjustment_delta, then recomputes
// closing_balance for that row and opening_balance/closing_balance for
// every later row in sequence. Returns a new array; does not mutate input.
export function applyAdjustmentCascade(rows, targetIndex, amount) {
  const next = rows.map((r) => ({ ...r }));
  next[targetIndex].adjustment_delta = round2(Number(next[targetIndex].adjustment_delta) + Number(amount));
  for (let i = targetIndex; i < next.length; i++) {
    if (i > targetIndex) next[i].opening_balance = next[i - 1].closing_balance;
    next[i].closing_balance = computeClosingBalance({
      openingBalance: next[i].opening_balance,
      dayDelta: next[i].day_delta,
      adjustmentDelta: next[i].adjustment_delta,
    });
  }
  return next;
}
