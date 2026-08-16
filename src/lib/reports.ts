import { prisma } from "@/lib/db";
import { ACCOUNT_CODES } from "@/lib/accounts";
import type { AccountType } from "@/generated/prisma/client";

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

// ASSET/EXPENSE accounts grow with debits; LIABILITY/EQUITY/INCOME accounts grow with credits.
function normalBalance(type: AccountType, debit: number, credit: number): number {
  if (type === "ASSET" || type === "EXPENSE") return debit - credit;
  return credit - debit;
}

export interface AccountBalance {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  isSystem: boolean;
  balance: number;
}

export async function getAccountBalances(): Promise<AccountBalance[]> {
  const accounts = await prisma.account.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
  });
  const sums = await prisma.journalLine.groupBy({
    by: ["accountId"],
    _sum: { debit: true, credit: true },
  });
  const sumMap = new Map(sums.map((s) => [s.accountId, s]));

  return accounts.map((account) => {
    const sum = sumMap.get(account.id);
    const debit = toNumber(sum?._sum.debit);
    const credit = toNumber(sum?._sum.credit);
    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      isSystem: account.isSystem,
      balance: normalBalance(account.type, debit, credit),
    };
  });
}

export async function getAccountBalanceByCode(code: string): Promise<number> {
  const account = await prisma.account.findUnique({ where: { code } });
  if (!account) return 0;
  const sum = await prisma.journalLine.aggregate({
    where: { accountId: account.id },
    _sum: { debit: true, credit: true },
  });
  return normalBalance(account.type, toNumber(sum._sum.debit), toNumber(sum._sum.credit));
}

export interface DashboardSummary {
  cashInHand: number;
  bankBalance: number;
  totalAssets: number;
  totalLiabilities: number;
  contributedEquity: number;
  retainedEarnings: number;
  totalEquity: number;
  accountsPayable: number;
  accountsReceivable: number;
  loansPayable: number;
  fixedAssets: number;
  totalIncomeAllTime: number;
  totalExpenseAllTime: number;
  netProfitAllTime: number;
  todaySales: number;
  monthToDateSales: number;
  monthToDateExpense: number;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const balances = await getAccountBalances();

  const sumByType = (type: AccountType) =>
    balances.filter((b) => b.type === type).reduce((acc, b) => acc + b.balance, 0);

  const findBalance = (code: string) => balances.find((b) => b.code === code)?.balance ?? 0;

  const totalAssets = sumByType("ASSET");
  const totalLiabilities = sumByType("LIABILITY");
  const contributedEquity = sumByType("EQUITY");
  const totalIncomeAllTime = sumByType("INCOME");
  const totalExpenseAllTime = sumByType("EXPENSE");
  const retainedEarnings = totalIncomeAllTime - totalExpenseAllTime;

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [todaySalesAgg, monthSalesAgg, monthExpenseAgg] = await Promise.all([
    prisma.dailySale.aggregate({
      where: { date: { gte: startOfToday } },
      _sum: { totalAmount: true },
    }),
    prisma.dailySale.aggregate({
      where: { date: { gte: startOfMonth } },
      _sum: { totalAmount: true },
    }),
    prisma.entry.aggregate({
      where: {
        date: { gte: startOfMonth },
        category: {
          in: [
            "RAW_MATERIAL",
            "PACKAGING_SUPPLIES",
            "CHEF_SALARY",
            "RENT",
            "UTILITY",
            "CLEANING_MAINTENANCE",
            "OTHER_EXPENSE",
          ],
        },
      },
      _sum: { amount: true },
    }),
  ]);

  return {
    cashInHand: findBalance(ACCOUNT_CODES.CASH),
    bankBalance: findBalance(ACCOUNT_CODES.BANK),
    totalAssets,
    totalLiabilities,
    contributedEquity,
    retainedEarnings,
    totalEquity: contributedEquity + retainedEarnings,
    accountsPayable: findBalance(ACCOUNT_CODES.PAYABLE),
    accountsReceivable: findBalance(ACCOUNT_CODES.RECEIVABLE),
    loansPayable: findBalance(ACCOUNT_CODES.LOANS_PAYABLE),
    fixedAssets: findBalance(ACCOUNT_CODES.FIXED_ASSETS),
    totalIncomeAllTime,
    totalExpenseAllTime,
    netProfitAllTime: retainedEarnings,
    todaySales: toNumber(todaySalesAgg._sum.totalAmount),
    monthToDateSales: toNumber(monthSalesAgg._sum.totalAmount),
    monthToDateExpense: toNumber(monthExpenseAgg._sum.amount),
  };
}

export interface BalanceSheet {
  assets: AccountBalance[];
  liabilities: AccountBalance[];
  equity: AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  contributedEquity: number;
  retainedEarnings: number;
  totalEquityAndRetained: number;
}

export async function getBalanceSheet(): Promise<BalanceSheet> {
  const balances = await getAccountBalances();
  const assets = balances.filter((b) => b.type === "ASSET");
  const liabilities = balances.filter((b) => b.type === "LIABILITY");
  const equity = balances.filter((b) => b.type === "EQUITY");
  const income = balances.filter((b) => b.type === "INCOME").reduce((a, b) => a + b.balance, 0);
  const expense = balances.filter((b) => b.type === "EXPENSE").reduce((a, b) => a + b.balance, 0);
  const retainedEarnings = income - expense;
  const contributedEquity = equity.reduce((a, b) => a + b.balance, 0);

  return {
    assets,
    liabilities,
    equity,
    totalAssets: assets.reduce((a, b) => a + b.balance, 0),
    totalLiabilities: liabilities.reduce((a, b) => a + b.balance, 0),
    contributedEquity,
    retainedEarnings,
    totalEquityAndRetained: contributedEquity + retainedEarnings,
  };
}

export interface IncomeStatement {
  income: AccountBalance[];
  expenses: AccountBalance[];
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
}

export async function getIncomeStatement(startDate?: Date, endDate?: Date): Promise<IncomeStatement> {
  const accounts = await prisma.account.findMany({
    where: { type: { in: ["INCOME", "EXPENSE"] }, isActive: true },
    orderBy: { code: "asc" },
  });
  const sums = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      entry: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    },
    _sum: { debit: true, credit: true },
  });
  const sumMap = new Map(sums.map((s) => [s.accountId, s]));

  const balances: AccountBalance[] = accounts.map((account) => {
    const sum = sumMap.get(account.id);
    const debit = toNumber(sum?._sum.debit);
    const credit = toNumber(sum?._sum.credit);
    return {
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      isSystem: account.isSystem,
      balance: normalBalance(account.type, debit, credit),
    };
  });

  const income = balances.filter((b) => b.type === "INCOME");
  const expenses = balances.filter((b) => b.type === "EXPENSE");
  const totalIncome = income.reduce((a, b) => a + b.balance, 0);
  const totalExpense = expenses.reduce((a, b) => a + b.balance, 0);

  return { income, expenses, totalIncome, totalExpense, netProfit: totalIncome - totalExpense };
}

export interface DailyTrendPoint {
  date: string;
  totalAmount: number;
  cashAmount: number;
  bankAmount: number;
}

export async function getDailySalesTrend(days = 30): Promise<DailyTrendPoint[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const rows = await prisma.dailySale.findMany({
    where: { date: { gte: since } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    totalAmount: toNumber(r.totalAmount),
    cashAmount: toNumber(r.cashAmount),
    bankAmount: toNumber(r.bankAmount),
  }));
}

export interface MonthlyPoint {
  month: string; // YYYY-MM
  totalSales: number;
  totalExpense: number;
}

export async function getMonthlyComparison(months = 6): Promise<MonthlyPoint[]> {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - (months - 1));
  since.setUTCDate(1);

  const [sales, expenseEntries] = await Promise.all([
    prisma.dailySale.findMany({ where: { date: { gte: since } } }),
    prisma.entry.findMany({
      where: {
        date: { gte: since },
        category: {
          in: [
            "RAW_MATERIAL",
            "PACKAGING_SUPPLIES",
            "CHEF_SALARY",
            "RENT",
            "UTILITY",
            "CLEANING_MAINTENANCE",
            "OTHER_EXPENSE",
          ],
        },
      },
    }),
  ]);

  const map = new Map<string, MonthlyPoint>();
  for (let i = 0; i < months; i++) {
    const d = new Date(since);
    d.setUTCMonth(d.getUTCMonth() + i);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    map.set(key, { month: key, totalSales: 0, totalExpense: 0 });
  }
  for (const s of sales) {
    const key = s.date.toISOString().slice(0, 7);
    const point = map.get(key);
    if (point) point.totalSales += toNumber(s.totalAmount);
  }
  for (const e of expenseEntries) {
    const key = e.date.toISOString().slice(0, 7);
    const point = map.get(key);
    if (point) point.totalExpense += toNumber(e.amount);
  }
  return Array.from(map.values());
}

export interface ExpenseBreakdownPoint {
  accountCode: string;
  accountName: string;
  amount: number;
}

export async function getExpenseBreakdown(startDate?: Date, endDate?: Date): Promise<ExpenseBreakdownPoint[]> {
  const statement = await getIncomeStatement(startDate, endDate);
  return statement.expenses
    .filter((e) => e.balance !== 0)
    .map((e) => ({ accountCode: e.code, accountName: e.name, amount: e.balance }))
    .sort((a, b) => b.amount - a.amount);
}

export interface TopItemPoint {
  menuItemId: string;
  name: string;
  quantitySold: number;
  revenue: number;
}

export async function getTopSellingItems(days = 30, limit = 10): Promise<TopItemPoint[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const items = await prisma.dailySaleItem.findMany({
    where: { dailySale: { date: { gte: since } } },
    include: { menuItem: true },
  });
  const map = new Map<string, TopItemPoint>();
  for (const item of items) {
    const existing = map.get(item.menuItemId) ?? {
      menuItemId: item.menuItemId,
      name: item.menuItem.name,
      quantitySold: 0,
      revenue: 0,
    };
    existing.quantitySold += item.quantity;
    existing.revenue += toNumber(item.lineTotal);
    map.set(item.menuItemId, existing);
  }
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export interface AccountStatementRow {
  entryId: string;
  date: string;
  description: string;
  vendor: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

export async function getAccountStatementByCode(code: string, limit = 100): Promise<AccountStatementRow[]> {
  const account = await prisma.account.findUnique({ where: { code } });
  if (!account) return [];

  const lines = await prisma.journalLine.findMany({
    where: { accountId: account.id },
    include: { entry: true },
    orderBy: [{ entry: { date: "asc" } }, { entry: { createdAt: "asc" } }],
  });

  let running = 0;
  const rows: AccountStatementRow[] = lines.map((line) => {
    const debit = toNumber(line.debit);
    const credit = toNumber(line.credit);
    running += normalBalance(account.type, debit, credit);
    return {
      entryId: line.entryId,
      date: line.entry.date.toISOString(),
      description: line.entry.description,
      vendor: line.entry.vendor,
      debit,
      credit,
      runningBalance: running,
    };
  });

  return rows.slice(-limit).reverse();
}

export interface PartnerEquityRow {
  partnerId: string;
  name: string;
  sharePercent: number | null;
  balance: number;
}

export async function getPartnerEquity(): Promise<PartnerEquityRow[]> {
  const partners = await prisma.partner.findMany({
    include: { equityAccount: true },
    orderBy: { name: "asc" },
  });
  const balances = await getAccountBalances();
  const balanceMap = new Map(balances.map((b) => [b.id, b.balance]));
  return partners.map((p) => ({
    partnerId: p.id,
    name: p.name,
    sharePercent: p.sharePercent ? Number(p.sharePercent) : null,
    balance: balanceMap.get(p.equityAccountId) ?? 0,
  }));
}
