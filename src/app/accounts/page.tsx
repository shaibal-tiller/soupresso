import { prisma } from "@/lib/db";
import { getAccountBalances } from "@/lib/reports";
import { AccountTable, type AccountRow } from "@/components/accounts/account-table";
import { AccountDialog } from "@/components/accounts/account-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatTaka } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chart of Accounts — Soupresso Ledger" };

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expenses",
};

const TYPE_ORDER = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

export default async function AccountsPage() {
  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({ orderBy: { code: "asc" } }),
    getAccountBalances(),
  ]);

  const balanceMap = new Map(balances.map((b) => [b.id, b.balance]));

  const rows: AccountRow[] = accounts.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    type: a.type,
    description: a.description,
    isSystem: a.isSystem,
    isActive: a.isActive,
    balance: balanceMap.get(a.id) ?? 0,
  }));

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Every entry posts to two accounts here automatically. Core accounts are protected; add custom ones for manual
            adjustments.
          </p>
        </div>
        <AccountDialog />
      </div>

      {TYPE_ORDER.map((type) => {
        const group = rows.filter((r) => r.type === type);
        if (group.length === 0) return null;
        const total = group.reduce((sum, r) => sum + (r.isActive ? r.balance : 0), 0);
        return (
          <Card key={type}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>{TYPE_LABELS[type]}</CardTitle>
                <CardDescription>{group.length} account{group.length === 1 ? "" : "s"}</CardDescription>
              </div>
              <span className="text-lg font-semibold">{formatTaka(total)}</span>
            </CardHeader>
            <CardContent>
              <AccountTable accounts={group} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
