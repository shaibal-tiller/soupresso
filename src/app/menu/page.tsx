import { prisma } from "@/lib/db";
import { MenuCardGrid, type MenuItemRow } from "@/components/menu/menu-card-grid";
import { MenuItemDialog } from "@/components/menu/menu-item-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getLang, t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu — Soupresso Ledger" };

export default async function MenuPage() {
  const [items, lang] = await Promise.all([
    prisma.menuItem.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }] }),
    getLang(),
  ]);

  const rows: MenuItemRow[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    nameBn: i.nameBn,
    price: Number(i.price),
    parcelPrice: i.parcelPrice != null ? Number(i.parcelPrice) : null,
    category: i.category,
    isActive: i.isActive,
  }));

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">{t(lang, "Menu")}</h1>
          <p className="text-sm text-muted-foreground">{t(lang, "Customize prices and items used on the Daily Sales page.")}</p>
        </div>
        <MenuItemDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t(lang, "Menu Items")}</CardTitle>
          <CardDescription>{t(lang, "Toggle items off instead of deleting to keep them out of the Daily Sales picker.")}</CardDescription>
        </CardHeader>
        <CardContent>
          <MenuCardGrid items={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
