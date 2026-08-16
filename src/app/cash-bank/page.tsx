import { prisma } from "@/lib/db";
import { getAccountBalances } from "@/lib/reports";
import { FundSourceTable, type FundSourceRow } from "@/components/cash-bank/fund-source-table";
import { AddFundSourceDialog } from "@/components/cash-bank/add-fund-source-dialog";
import { TransferDialog } from "@/components/cash-bank/transfer-dialog";
import { EntryTable, type EntryRow } from "@/components/entries/entry-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatTaka } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cash & Bank — Soupresso Ledger" };

export default async function CashBankPage() {
  const [balances, activity] = await Promise.all([
    getAccountBalances(true),
    prisma.entry.findMany({
      where: { category: { in: ["TRANSFER", "BALANCE_ADJUSTMENT"] } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: { partner: true, journalLines: { include: { account: true } } },
    }),
  ]);

  const fundSources: FundSourceRow[] = balances
    .filter((b) => b.isFundSource)
    .map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      balance: b.balance,
      isActive: b.isActive,
      isSystem: b.isSystem,
    }));

  const activeFundSources = fundSources.filter((f) => f.isActive);
  const totalLiquid = activeFundSources.reduce((sum, f) => sum + f.balance, 0);

  const activityRows: EntryRow[] = activity.map((e) => {
    const debitLine = e.journalLines.find((l) => Number(l.debit) > 0);
    const creditLine = e.journalLines.find((l) => Number(l.credit) > 0);
    return {
      id: e.id,
      date: e.date.toISOString(),
      category: e.category,
      description: e.description,
      vendor: e.vendor,
      amount: Number(e.amount),
      paymentMethod: e.paymentMethod,
      partnerName: e.partner?.name ?? null,
      debitAccountName: debitLine?.account.name ?? null,
      creditAccountName: creditLine?.account.name ?? null,
    };
  });

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cash & Bank</h1>
          <p className="text-sm text-muted-foreground">
            Every place money physically sits — cash box, bank accounts, mobile banking. Add as many as you use.
          </p>
        </div>
        <div className="flex gap-2">
          <TransferDialog fundSources={activeFundSources.map((f) => ({ id: f.id, name: f.name }))} />
          <AddFundSourceDialog />
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Total Liquid Funds</CardTitle>
            <CardDescription>Sum of all active cash/bank accounts</CardDescription>
          </div>
          <span className="text-2xl font-semibold tabular-nums">{formatTaka(totalLiquid)}</span>
        </CardHeader>
      </Card>

      <FundSourceTable accounts={fundSources} />

      <Card>
        <CardHeader>
          <CardTitle>Transfers & Balance Adjustments</CardTitle>
          <CardDescription>Money moved between accounts, and manual balance corrections.</CardDescription>
        </CardHeader>
        <CardContent>
          <EntryTable entries={activityRows} />
        </CardContent>
      </Card>
    </div>
  );
}
