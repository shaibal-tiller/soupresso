// The three expense types (plus a residual) as the Expenses page and Expense Gallery show them.
// A line's expenseType comes from its bazar item (Manage Items); 'Other' = untagged or unitemized.
export const GROUP_ORDER = ['Cost of Goods', 'Operational', 'Overhead', 'Other'];
// Colors validated for categorical use (CVD-separated, >=3:1 contrast); the residual is a neutral, not a hue.
export const GROUP_COLORS = { 'Cost of Goods': '#C1502E', Operational: '#3B6FB6', Overhead: '#1F8C5A', Other: '#9C9080' };
export const TYPE_TO_GROUP = { cost_of_goods: 'Cost of Goods', operational: 'Operational', overhead: 'Overhead' };

export function emptyGroupTotals() {
  return Object.fromEntries(GROUP_ORDER.map((g) => [g, 0]));
}

export function groupFor(line) {
  return TYPE_TO_GROUP[line?.expenseType] || 'Other';
}
