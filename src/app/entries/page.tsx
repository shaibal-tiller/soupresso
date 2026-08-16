import { prisma } from "@/lib/db";
import { EntryForm } from "@/components/entries/entry-form";
import { EntryTable, type EntryRow } from "@/components/entries/entry-table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entries — Soupresso Ledger" };

export default async function EntriesPage() {
  const [entries, partners, accounts, fundSources] = await Promise.all([
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

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entries</h1>
        <p className="text-sm text-muted-foreground">
          Record every purchase, expense, investment, loan, or settlement as a single entry. Daily food sales are recorded on the
          Daily Sales page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Entry</CardTitle>
          <CardDescription>Pick a category — the correct ledger accounts are posted automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <EntryForm
            partners={partners.map((p) => ({ id: p.id, name: p.name }))}
            accounts={accounts}
            fundSources={fundSources.map((f) => ({ id: f.id, name: f.name }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Entries</CardTitle>
          <CardDescription>Latest 200 entries, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          <EntryTable entries={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
