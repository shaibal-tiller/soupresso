import {
  getDashboardSummary,
  getDailySalesTrend,
  getMonthlyComparison,
  getExpenseBreakdown,
  getTopSellingItems,
} from "@/lib/reports";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  DailySalesTrendChart,
  MonthlyComparisonChart,
  ExpenseBreakdownChart,
  TopItemsChart,
  FundSourceBreakdownChart,
} from "@/components/charts/dashboard-charts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatTaka } from "@/lib/format";
import { getLang, t } from "@/lib/i18n";
import { Wallet, Scale, TrendingUp, HandCoins, Users, Boxes, Receipt, AlertCircle, ArrowDownToLine, Banknote, Package } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — Soupresso Ledger" };

export default async function DashboardPage() {
  const [summary, dailyTrend, monthly, expenseBreakdown, topItems, lang] = await Promise.all([
    getDashboardSummary(),
    getDailySalesTrend(30),
    getMonthlyComparison(6),
    getExpenseBreakdown(),
    getTopSellingItems(30, 8),
    getLang(),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t(lang, "Dashboard")}</h1>
        <p className="text-sm text-muted-foreground">{t(lang, "Soupresso cart business — real-time ledger summary.")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t(lang, "Total Liquid Funds")} value={summary.totalLiquidFunds} icon={Wallet} hue="amber" hint={t(lang, "Across all cash/bank accounts")} />
        <StatCard label={t(lang, "Today's Sales")} value={summary.todaySales} icon={TrendingUp} tone="good" hue="green" />
        <StatCard label={t(lang, "Month-to-Date Sales")} value={summary.monthToDateSales} icon={Receipt} hue="teal" />
        <StatCard label={t(lang, "Total Assets")} value={summary.totalAssets} icon={Boxes} hue="maroon" />
        <StatCard label={t(lang, "Total Liabilities")} value={summary.totalLiabilities} icon={Scale} hue="maroon" />
        <StatCard label={t(lang, "Total Equity")} value={summary.totalEquity} icon={Users} hue="green" />
        <StatCard
          label={t(lang, "Net Profit (all-time)")}
          value={summary.netProfitAllTime}
          icon={HandCoins}
          tone={summary.netProfitAllTime >= 0 ? "good" : "critical"}
          hue="green"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t(lang, "Accounts Payable")}
          value={summary.accountsPayable}
          tone={summary.accountsPayable > 0 ? "critical" : "default"}
          icon={AlertCircle}
          hue="maroon"
          hint={t(lang, "What we owe")}
        />
        <StatCard
          label={t(lang, "Accounts Receivable")}
          value={summary.accountsReceivable}
          tone="good"
          icon={ArrowDownToLine}
          hue="green"
          hint={t(lang, "What's owed to us")}
        />
        <StatCard label={t(lang, "Loans Payable")} value={summary.loansPayable} icon={Banknote} hue="amber" />
        <StatCard label={t(lang, "Fixed Assets")} value={summary.fixedAssets} icon={Package} hue="teal" hint={t(lang, "Cart, equipment, furniture")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "Daily Sales — Last 30 Days")}</CardTitle>
            <CardDescription>{t(lang, "Total collected per day.")}</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyTrend.length > 0 ? (
              <DailySalesTrendChart data={dailyTrend} />
            ) : (
              <EmptyChart message={t(lang, "No daily sales recorded yet.")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "Monthly Sales vs. Expenses")}</CardTitle>
            <CardDescription>{t(lang, "Last 6 months.")}</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyComparisonChart data={monthly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "Cash & Bank")}</CardTitle>
            <CardDescription>{t(lang, "Balance by account.")}</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.fundSources.length > 0 ? (
              <FundSourceBreakdownChart data={summary.fundSources} />
            ) : (
              <EmptyChart message={t(lang, "No cash/bank accounts yet.")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "Expense Breakdown (all-time)")}</CardTitle>
            <CardDescription>{t(lang, "Where the money is going, by category.")}</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length > 0 ? (
              <ExpenseBreakdownChart data={expenseBreakdown} />
            ) : (
              <EmptyChart message={t(lang, "No expenses recorded yet.")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "Top Selling Items")}</CardTitle>
            <CardDescription>{t(lang, "By revenue, last 30 days (approximate).")}</CardDescription>
          </CardHeader>
          <CardContent>
            {topItems.length > 0 ? (
              <TopItemsChart data={topItems} />
            ) : (
              <EmptyChart message={t(lang, "No itemized sales recorded yet.")} />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "Business Health Summary")}</CardTitle>
          <CardDescription>{t(lang, "Quick equity and profit picture.")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <SummaryLine label={t(lang, "Contributed capital (partner investments)")} value={summary.contributedEquity} />
          <SummaryLine label={t(lang, "Retained earnings (cumulative profit)")} value={summary.retainedEarnings} />
          <SummaryLine label={t(lang, "This month's expenses")} value={summary.monthToDateExpense} />
          <SummaryLine label={t(lang, "All-time income")} value={summary.totalIncomeAllTime} />
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{formatTaka(value)}</span>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-muted-foreground">{message}</p>;
}
