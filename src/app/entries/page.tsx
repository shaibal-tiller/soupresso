import { prisma } from "@/lib/db";
import { EntryForm } from "@/components/entries/entry-form";
import { EntryTable, type EntryRow } from "@/components/entries/entry-table";
import { QuickPurchasePanel } from "@/components/quick-purchase/quick-purchase-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLang, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entries — Soupresso Ledger" };

export default async function EntriesPage() {
  const [entries, partners, accounts, fundSources, purchaseItems, lang] = await Promise.all([
    prisma.entry.findMany({
      where: { category: { not: "SALES" } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        partner: true,
        journalLines: { include: { account: true } },
      },
    }),
    prisma.partner.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.account.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    prisma.account.findMany({ where: { isActive: true, isFundSource: true }, orderBy: { code: "asc" } }),
    prisma.purchaseItem.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }] }),
    getLang(),
  ]);

  const rows: EntryRow[] = entries.map((e) => {
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

  const fundSourceOptions = fundSources.map((f) => ({ id: f.id, name: f.name }));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">{t(lang, "Entries")}</h1>
        <p className="text-sm text-muted-foreground">
          {t(lang, "Tap what you bought today, or use manual entry for investments, loans, and other one-offs.")}
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="quick">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="quick">{t(lang, "Quick Purchase")}</TabsTrigger>
              <TabsTrigger value="manual">{t(lang, "Manual Entry")}</TabsTrigger>
            </TabsList>
            <TabsContent value="quick" className="pt-4">
              <QuickPurchasePanel
                items={purchaseItems.map((p) => ({ id: p.id, name: p.name, category: p.category, unit: p.unit, isActive: p.isActive }))}
                fundSources={fundSourceOptions}
              />
            </TabsContent>
            <TabsContent value="manual" className="pt-4">
              <p className="mb-4 text-sm text-muted-foreground">
                {t(lang, "For investments, loans, settlements, asset purchases, or anything not on the quick-purchase list.")}
              </p>
              <EntryForm
                partners={partners.map((p) => ({ id: p.id, name: p.name }))}
                accounts={accounts}
                fundSources={fundSourceOptions}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "Recent Entries")}</CardTitle>
          <CardDescription>{t(lang, "Latest 200 entries, newest first.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <EntryTable entries={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
