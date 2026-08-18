import { prisma } from "@/lib/db";
import { DailySaleForm } from "@/components/daily-sales/daily-sale-form";
import { DailySaleTable, type DailySaleRow } from "@/components/daily-sales/daily-sale-table";
import { QuickSalePanel } from "@/components/quick-sale/quick-sale-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLang, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily Sales — Soupresso Ledger" };

export default async function DailySalesPage() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [menuItems, dailySales, fundSources, todaySale, lang] = await Promise.all([
    prisma.menuItem.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
    prisma.dailySale.findMany({
      orderBy: { date: "desc" },
      take: 90,
      include: { items: true, fundings: { include: { fundSourceAccount: true } } },
    }),
    prisma.account.findMany({ where: { isActive: true, isFundSource: true }, orderBy: { code: "asc" } }),
    prisma.dailySale.findUnique({ where: { date: today } }),
    getLang(),
  ]);

  const rows: DailySaleRow[] = dailySales.map((d) => ({
    id: d.id,
    date: d.date.toISOString(),
    totalAmount: Number(d.totalAmount),
    itemCount: d.items.length,
    notes: d.notes,
    fundings: d.fundings.map((f) => ({ name: f.fundSourceAccount.name, amount: Number(f.amount) })),
  }));

  const menuItemOptions = menuItems.map((m) => ({
    id: m.id,
    name: m.name,
    nameBn: m.nameBn,
    price: Number(m.price),
    parcelPrice: m.parcelPrice != null ? Number(m.parcelPrice) : null,
    category: m.category,
  }));
  const fundSourceOptions = fundSources.map((f) => ({ id: f.id, name: f.name }));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t(lang, "Daily Sales")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(lang, "Record a sale the moment a customer orders, or close out the whole day in one go.")}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="quick">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="quick">{t(lang, "Quick Sale")}</TabsTrigger>
              <TabsTrigger value="full">{t(lang, "Full Day Entry")}</TabsTrigger>
            </TabsList>
            <TabsContent value="quick" className="pt-4">
              <QuickSalePanel
                menuItems={menuItemOptions}
                fundSources={fundSourceOptions}
                initialTodayTotal={todaySale ? Number(todaySale.totalAmount) : 0}
              />
            </TabsContent>
            <TabsContent value="full" className="grid gap-1.5 pt-4">
              <p className="mb-2 text-sm text-muted-foreground">
                {t(
                  lang,
                  "Enter the whole day's total at once — useful for a quiet day, or backfilling a day you didn't log live. This creates the day's record; if it already exists (e.g. from Quick Sale), delete it first.",
                )}
              </p>
              <DailySaleForm menuItems={menuItemOptions} fundSources={fundSourceOptions} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "Sales History")}</CardTitle>
          <CardDescription>{t(lang, "Last 90 days.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <DailySaleTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
