const currencyFormatter = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

export function formatTaka(amount: number): string {
  const formatted = currencyFormatter.format(Math.abs(amount));
  return amount < 0 ? `-${formatted}` : formatted;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

export function formatMonth(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export { CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/entry-meta";
