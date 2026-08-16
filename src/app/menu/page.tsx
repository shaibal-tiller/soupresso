import { prisma } from "@/lib/db";
import { MenuTable, type MenuItemRow } from "@/components/menu/menu-table";
import { MenuItemDialog } from "@/components/menu/menu-item-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata = { title: "Menu — Soupresso Ledger" };

export default async function MenuPage() {
  const items = await prisma.menuItem.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }] });

  const rows: MenuItemRow[] = items.map((i) => ({
    id: i.id,
    name: i.name,
    price: Number(i.price),
    parcelPrice: i.parcelPrice != null ? Number(i.parcelPrice) : null,
    category: i.category,
    isActive: i.isActive,
  }));

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
          <p className="text-sm text-muted-foreground">Customize prices and items used on the Daily Sales page.</p>
        </div>
        <MenuItemDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Menu Items</CardTitle>
          <CardDescription>Toggle items off instead of deleting to keep them out of the Daily Sales picker.</CardDescription>
        </CardHeader>
        <CardContent>
          <MenuTable items={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
