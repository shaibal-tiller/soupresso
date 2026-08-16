// Plain metadata describing entry categories — safe to import from both
// server code (ledger.ts) and client components (forms).

export type EntryCategoryValue =
  | "INVESTMENT"
  | "ASSET_PURCHASE"
  | "RAW_MATERIAL"
  | "PACKAGING_SUPPLIES"
  | "CHEF_SALARY"
  | "RENT"
  | "UTILITY"
  | "CLEANING_MAINTENANCE"
  | "OTHER_EXPENSE"
  | "SALES"
  | "LOAN_RECEIVED"
  | "LOAN_REPAYMENT"
  | "PAYABLE_SETTLEMENT"
  | "RECEIVABLE_COLLECTION"
  | "WITHDRAWAL"
  | "ADJUSTMENT"
  | "BALANCE_ADJUSTMENT"
  | "TRANSFER";

export type PaymentMethodValue = "FUND_SOURCE" | "CREDIT" | "MIXED";

// Categories entered through the general Entries form (Daily Sales has its own dedicated page).
export const ENTRY_FORM_CATEGORIES: { value: EntryCategoryValue; label: string; group: string }[] = [
  { value: "RAW_MATERIAL", label: "Raw Material / Ingredients", group: "Purchases" },
  { value: "PACKAGING_SUPPLIES", label: "Packaging & Supplies", group: "Purchases" },
  { value: "ASSET_PURCHASE", label: "Asset Purchase (cart, fridge, blender...)", group: "Purchases" },
  { value: "CHEF_SALARY", label: "Chef Salary", group: "Recurring Expenses" },
  { value: "RENT", label: "House Rent", group: "Recurring Expenses" },
  { value: "UTILITY", label: "Utility", group: "Recurring Expenses" },
  { value: "CLEANING_MAINTENANCE", label: "Cleaning & Maintenance", group: "Recurring Expenses" },
  { value: "OTHER_EXPENSE", label: "Other Expense", group: "Recurring Expenses" },
  { value: "INVESTMENT", label: "Partner Investment (money in)", group: "Equity & Loans" },
  { value: "WITHDRAWAL", label: "Partner Withdrawal (money out)", group: "Equity & Loans" },
  { value: "LOAN_RECEIVED", label: "Loan Received", group: "Equity & Loans" },
  { value: "LOAN_REPAYMENT", label: "Loan Repayment", group: "Equity & Loans" },
  { value: "PAYABLE_SETTLEMENT", label: "Settle a Payable (pay off what we owed)", group: "Settlements" },
  { value: "RECEIVABLE_COLLECTION", label: "Collect a Receivable (someone paid us back)", group: "Settlements" },
  { value: "ADJUSTMENT", label: "Manual Adjustment (advanced)", group: "Advanced" },
];

export const CREDIT_ELIGIBLE_CATEGORIES: EntryCategoryValue[] = [
  "ASSET_PURCHASE",
  "RAW_MATERIAL",
  "PACKAGING_SUPPLIES",
  "CHEF_SALARY",
  "RENT",
  "UTILITY",
  "CLEANING_MAINTENANCE",
  "OTHER_EXPENSE",
  "SALES",
];

// Categories the Quick Purchase tile picker can post to.
export const QUICK_PURCHASE_CATEGORIES: EntryCategoryValue[] = [
  "RAW_MATERIAL",
  "PACKAGING_SUPPLIES",
  "CLEANING_MAINTENANCE",
  "ASSET_PURCHASE",
  "OTHER_EXPENSE",
];

export const CATEGORIES_REQUIRING_PARTNER: EntryCategoryValue[] = ["INVESTMENT", "WITHDRAWAL"];

export const CATEGORY_REQUIRES_MANUAL_ACCOUNTS: EntryCategoryValue = "ADJUSTMENT";

export function isPaymentMethodAllowed(category: EntryCategoryValue, paymentMethod: PaymentMethodValue): boolean {
  if (paymentMethod === "MIXED") return false;
  if (paymentMethod === "CREDIT") return CREDIT_ELIGIBLE_CATEGORIES.includes(category);
  return true;
}

export const CATEGORY_LABELS: Record<string, string> = {
  INVESTMENT: "Partner Investment",
  ASSET_PURCHASE: "Asset Purchase",
  RAW_MATERIAL: "Raw Material / Ingredients",
  PACKAGING_SUPPLIES: "Packaging & Supplies",
  CHEF_SALARY: "Chef Salary",
  RENT: "House Rent",
  UTILITY: "Utility",
  CLEANING_MAINTENANCE: "Cleaning & Maintenance",
  OTHER_EXPENSE: "Other Expense",
  SALES: "Sales",
  LOAN_RECEIVED: "Loan Received",
  LOAN_REPAYMENT: "Loan Repayment",
  PAYABLE_SETTLEMENT: "Payable Settlement",
  RECEIVABLE_COLLECTION: "Receivable Collection",
  WITHDRAWAL: "Partner Withdrawal",
  ADJUSTMENT: "Manual Adjustment",
  BALANCE_ADJUSTMENT: "Balance Adjustment",
  TRANSFER: "Transfer",
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  FUND_SOURCE: "Pay from account",
  CREDIT: "On Credit (unpaid)",
  MIXED: "Multiple accounts",
};
