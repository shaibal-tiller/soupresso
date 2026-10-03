// Expense type per bazar item — see lib/expense-type-map.js for the rules.
import map from './expense-type-map.js';

export const EXPENSE_TYPES = map.types; // ['cost_of_goods', 'operational', 'overhead']

export const EXPENSE_TYPE_LABELS = {
  cost_of_goods: 'Cost of Goods',
  operational: 'Operational',
  overhead: 'Overhead',
};

// [type, subCategory] for an item: its own override, else its category's default, else null.
export function expenseTypeFor(category, name) {
  return map.itemOverrides[name] || map.categoryDefaults[category] || null;
}

export function isExpenseType(v) {
  return EXPENSE_TYPES.includes(v);
}
