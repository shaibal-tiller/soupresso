import { prisma } from "@/lib/db";
import { getAccountBalances } from "@/lib/reports";
import { PartnerTable, type PartnerRow } from "@/components/partners/partner-table";
import { PartnerDialog } from "@/components/partners/partner-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatTaka } from "@/lib/format";
import { getLang, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partners & Equity — Soupresso Ledger" };

export default async function PartnersPage() {
  const [partners, balances, lang] = await Promise.all([
    prisma.partner.findMany({ orderBy: { name: "asc" } }),
    getAccountBalances(),
    getLang(),
  ]);

  const balanceMap = new Map(balances.map((b) => [b.id, b.balance]));

  const rows: PartnerRow[] = partners.map((p) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    sharePercent: p.sharePercent != null ? Number(p.sharePercent) : null,
    isActive: p.isActive,
    balance: balanceMap.get(p.equityAccountId) ?? 0,
  }));

  const totalEquity = rows.reduce((sum, r) => sum + r.balance, 0);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t(lang, "Partners & Equity")}</h1>
          <p className="text-sm text-muted-foreground">
            {t(lang, "Each partner's capital account tracks investments in and withdrawals out, recorded from the Entries page.")}
          </p>
        </div>
        <PartnerDialog />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{t(lang, "All Partners")}</CardTitle>
            <CardDescription>{rows.length} partners</CardDescription>
          </div>
          <span className="text-lg font-semibold">{formatTaka(totalEquity)}</span>
        </CardHeader>
        <CardContent>
          <PartnerTable partners={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
