import { prisma } from "@/lib/db";
import { DailySaleForm } from "@/components/daily-sales/daily-sale-form";
import { DailySaleTable, type DailySaleRow } from "@/components/daily-sales/daily-sale-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily Sales — Soupresso Ledger" };

export default async function DailySalesPage() {
  const [menuItems, dailySales, fundSources] = await Promise.all([
    prisma.menuItem.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.dailySale.findMany({
      orderBy: { date: "desc" },
      take: 90,
      include: { items: true, fundings: { include: { fundSourceAccount: true } } },
    }),
    prisma.account.findMany({ where: { isActive: true, isFundSource: true }, orderBy: { code: "asc" } }),
  ]);

  const rows: DailySaleRow[] = dailySales.map((d) => ({
    id: d.id,
    date: d.date.toISOString(),
    totalAmount: Number(d.totalAmount),
    itemCount: d.items.length,
    notes: d.notes,
    fundings: d.fundings.map((f) => ({ name: f.fundSourceAccount.name, amount: Number(f.amount) })),
  }));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Daily Sales</h1>
        <p className="text-sm text-muted-foreground">
          Close out each day&apos;s sales here. One record per day — record the cash and bank totals, and optionally the
          item breakdown for analytics.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Today&apos;s Sales</CardTitle>
          <CardDescription>Enter the total collected; item quantities are optional and approximate.</CardDescription>
        </CardHeader>
        <CardContent>
          <DailySaleForm
            menuItems={menuItems.map((m) => ({
              id: m.id,
              name: m.name,
              price: Number(m.price),
              parcelPrice: m.parcelPrice != null ? Number(m.parcelPrice) : null,
            }))}
            fundSources={fundSources.map((f) => ({ id: f.id, name: f.name }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales History</CardTitle>
          <CardDescription>Last 90 days.</CardDescription>
        </CardHeader>
        <CardContent>
          <DailySaleTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
