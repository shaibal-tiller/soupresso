import {
  getBalanceSheet,
  getIncomeStatement,
  getAccountStatementByCode,
  getPartnerEquity,
} from "@/lib/reports";
import { ACCOUNT_CODES } from "@/lib/accounts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { formatTaka, formatDate } from "@/lib/format";
import { getLang, t } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n-shared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports — Soupresso Ledger" };

export default async function ReportsPage() {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [balanceSheet, allTimeIncome, monthIncome, payableStatement, receivableStatement, partnerEquity, lang] = await Promise.all([
    getBalanceSheet(),
    getIncomeStatement(),
    getIncomeStatement(startOfMonth),
    getAccountStatementByCode(ACCOUNT_CODES.PAYABLE, 50),
    getAccountStatementByCode(ACCOUNT_CODES.RECEIVABLE, 50),
    getPartnerEquity(),
    getLang(),
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t(lang, "Reports")}</h1>
        <p className="text-sm text-muted-foreground">{t(lang, "Balance sheet, profit & loss, and outstanding balances.")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "Balance Sheet")}</CardTitle>
          <CardDescription>{t(lang, "As of")} {formatDate(now)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div>
            <SectionTitle>{t(lang, "Assets")}</SectionTitle>
            {balanceSheet.assets.map((a) => (
              <LineRow key={a.id} label={a.name} value={a.balance} />
            ))}
            <TotalRow label={t(lang, "Total Assets")} value={balanceSheet.totalAssets} />
          </div>
          <div className="grid gap-4">
            <div>
              <SectionTitle>{t(lang, "Liabilities")}</SectionTitle>
              {balanceSheet.liabilities.map((l) => (
                <LineRow key={l.id} label={l.name} value={l.balance} />
              ))}
              <TotalRow label={t(lang, "Total Liabilities")} value={balanceSheet.totalLiabilities} />
            </div>
            <div>
              <SectionTitle>{t(lang, "Equity")}</SectionTitle>
              {balanceSheet.equity.map((e) => (
                <LineRow key={e.id} label={e.name} value={e.balance} />
              ))}
              <LineRow label={t(lang, "Retained Earnings (cumulative profit)")} value={balanceSheet.retainedEarnings} />
              <TotalRow label={t(lang, "Total Equity")} value={balanceSheet.totalEquityAndRetained} />
            </div>
            <Separator />
            <TotalRow
              label={t(lang, "Total Liabilities + Equity")}
              value={balanceSheet.totalLiabilities + balanceSheet.totalEquityAndRetained}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "Income Statement")}</CardTitle>
          <CardDescription>{t(lang, "This month vs. all-time.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(lang, "Account")}</TableHead>
                  <TableHead className="text-right">{t(lang, "This Month")}</TableHead>
                  <TableHead className="text-right">{t(lang, "All-Time")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium" colSpan={3}>
                    {t(lang, "Income")}
                  </TableCell>
                </TableRow>
                {allTimeIncome.income.map((acc) => {
                  const monthVal = monthIncome.income.find((m) => m.id === acc.id)?.balance ?? 0;
                  return (
                    <TableRow key={acc.id}>
                      <TableCell className="pl-6 text-sm">{acc.name}</TableCell>
                      <TableCell className="text-right">{formatTaka(monthVal)}</TableCell>
                      <TableCell className="text-right">{formatTaka(acc.balance)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/30">
                  <TableCell className="font-medium" colSpan={3}>
                    {t(lang, "Expenses")}
                  </TableCell>
                </TableRow>
                {allTimeIncome.expenses.map((acc) => {
                  const monthVal = monthIncome.expenses.find((m) => m.id === acc.id)?.balance ?? 0;
                  return (
                    <TableRow key={acc.id}>
                      <TableCell className="pl-6 text-sm">{acc.name}</TableCell>
                      <TableCell className="text-right">{formatTaka(monthVal)}</TableCell>
                      <TableCell className="text-right">{formatTaka(acc.balance)}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>{t(lang, "Net Profit")}</TableCell>
                  <TableCell className="text-right">{formatTaka(monthIncome.netProfit)}</TableCell>
                  <TableCell className="text-right">{formatTaka(allTimeIncome.netProfit)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "Accounts Payable")}</CardTitle>
            <CardDescription>{t(lang, "What the business owes, itemized.")}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Payable is a liability: it grows on credit (we owe more), shrinks on debit (we paid). */}
            <StatementTable rows={payableStatement} increaseLabel={t(lang, "Owed")} decreaseLabel={t(lang, "Paid")} increaseSide="credit" lang={lang} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t(lang, "Accounts Receivable")}</CardTitle>
            <CardDescription>{t(lang, "What's owed to the business, itemized.")}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Receivable is an asset: it grows on debit (owed to us), shrinks on credit (collected). */}
            <StatementTable
              rows={receivableStatement}
              increaseLabel={t(lang, "Owed to us")}
              decreaseLabel={t(lang, "Collected")}
              increaseSide="debit"
              lang={lang}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "Partner Equity Summary")}</CardTitle>
          <CardDescription>{t(lang, "Contributions minus withdrawals, per partner.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(lang, "Partner")}</TableHead>
                  <TableHead className="text-right">{t(lang, "Balance")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partnerEquity.map((p) => (
                  <TableRow key={p.partnerId}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-right font-medium">{formatTaka(p.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{children}</h3>;
}

function LineRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span>{label}</span>
      <span className="tabular-nums">{formatTaka(value)}</span>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-t py-2 text-sm font-semibold">
      <span>{label}</span>
      <span className="tabular-nums">{formatTaka(value)}</span>
    </div>
  );
}

function StatementTable({
  rows,
  increaseLabel,
  decreaseLabel,
  increaseSide,
  lang,
}: {
  rows: { entryId: string; date: string; description: string; vendor: string | null; debit: number; credit: number; runningBalance: number }[];
  increaseLabel: string;
  decreaseLabel: string;
  increaseSide: "debit" | "credit";
  lang: Lang;
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{t(lang, "Nothing outstanding.")}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t(lang, "Date")}</TableHead>
            <TableHead>{t(lang, "Description")}</TableHead>
            <TableHead className="text-right">{increaseLabel}</TableHead>
            <TableHead className="text-right">{decreaseLabel}</TableHead>
            <TableHead className="text-right">{t(lang, "Balance")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const increaseValue = increaseSide === "credit" ? row.credit : row.debit;
            const decreaseValue = increaseSide === "credit" ? row.debit : row.credit;
            return (
              <TableRow key={`${row.entryId}-${row.date}`}>
                <TableCell className="whitespace-nowrap text-sm">{formatDate(row.date)}</TableCell>
                <TableCell className="max-w-48 truncate text-sm">
                  {row.description}
                  {row.vendor && <span className="text-muted-foreground"> · {row.vendor}</span>}
                </TableCell>
                <TableCell className="text-right text-sm">{increaseValue > 0 ? formatTaka(increaseValue) : "—"}</TableCell>
                <TableCell className="text-right text-sm">{decreaseValue > 0 ? formatTaka(decreaseValue) : "—"}</TableCell>
                <TableCell className="text-right text-sm font-medium">{formatTaka(row.runningBalance)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
