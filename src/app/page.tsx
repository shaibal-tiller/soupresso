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
import { Wallet, Scale, TrendingUp, HandCoins, Users, Boxes, Receipt, AlertCircle, ArrowDownToLine, Banknote, Package } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — Soupresso Ledger" };

export default async function DashboardPage() {
  const [summary, dailyTrend, monthly, expenseBreakdown, topItems] = await Promise.all([
    getDashboardSummary(),
    getDailySalesTrend(30),
    getMonthlyComparison(6),
    getExpenseBreakdown(),
    getTopSellingItems(30, 8),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Soupresso cart business — real-time ledger summary.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Liquid Funds" value={summary.totalLiquidFunds} icon={Wallet} hue="amber" hint="Across all cash/bank accounts" />
        <StatCard label="Today's Sales" value={summary.todaySales} icon={TrendingUp} tone="good" hue="green" />
        <StatCard label="Month-to-Date Sales" value={summary.monthToDateSales} icon={Receipt} hue="teal" />
        <StatCard label="Total Assets" value={summary.totalAssets} icon={Boxes} hue="maroon" />
        <StatCard label="Total Liabilities" value={summary.totalLiabilities} icon={Scale} hue="maroon" />
        <StatCard label="Total Equity" value={summary.totalEquity} icon={Users} hue="green" />
        <StatCard
          label="Net Profit (all-time)"
          value={summary.netProfitAllTime}
          icon={HandCoins}
          tone={summary.netProfitAllTime >= 0 ? "good" : "critical"}
          hue="green"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Accounts Payable"
          value={summary.accountsPayable}
          tone={summary.accountsPayable > 0 ? "critical" : "default"}
          icon={AlertCircle}
          hue="maroon"
          hint="What we owe"
        />
        <StatCard
          label="Accounts Receivable"
          value={summary.accountsReceivable}
          tone="good"
          icon={ArrowDownToLine}
          hue="green"
          hint="What's owed to us"
        />
        <StatCard label="Loans Payable" value={summary.loansPayable} icon={Banknote} hue="amber" />
        <StatCard label="Fixed Assets" value={summary.fixedAssets} icon={Package} hue="teal" hint="Cart, equipment, furniture" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily Sales — Last 30 Days</CardTitle>
            <CardDescription>Total collected per day.</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyTrend.length > 0 ? (
              <DailySalesTrendChart data={dailyTrend} />
            ) : (
              <EmptyChart message="No daily sales recorded yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Sales vs. Expenses</CardTitle>
            <CardDescription>Last 6 months.</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyComparisonChart data={monthly} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash & Bank</CardTitle>
            <CardDescription>Balance by account.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.fundSources.length > 0 ? (
              <FundSourceBreakdownChart data={summary.fundSources} />
            ) : (
              <EmptyChart message="No cash/bank accounts yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown (all-time)</CardTitle>
            <CardDescription>Where the money is going, by category.</CardDescription>
          </CardHeader>
          <CardContent>
            {expenseBreakdown.length > 0 ? (
              <ExpenseBreakdownChart data={expenseBreakdown} />
            ) : (
              <EmptyChart message="No expenses recorded yet." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
            <CardDescription>By revenue, last 30 days (approximate).</CardDescription>
          </CardHeader>
          <CardContent>
            {topItems.length > 0 ? (
              <TopItemsChart data={topItems} />
            ) : (
              <EmptyChart message="No itemized sales recorded yet." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Health Summary</CardTitle>
          <CardDescription>Quick equity and profit picture.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <SummaryLine label="Contributed capital (partner investments)" value={summary.contributedEquity} />
          <SummaryLine label="Retained earnings (cumulative profit)" value={summary.retainedEarnings} />
          <SummaryLine label="This month's expenses" value={summary.monthToDateExpense} />
          <SummaryLine label="All-time income" value={summary.totalIncomeAllTime} />
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
