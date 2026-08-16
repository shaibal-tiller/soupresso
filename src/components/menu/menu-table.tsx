"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { toggleMenuItemActiveAction, deleteMenuItemAction } from "@/app/menu/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MenuItemDialog } from "@/components/menu/menu-item-dialog";

export interface MenuItemRow {
  id: string;
  name: string;
  price: number;
  parcelPrice: number | null;
  category: string;
  isActive: boolean;
}

export function MenuTable({ items }: { items: MenuItemRow[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, next: boolean) {
    startTransition(async () => {
      await toggleMenuItemActiveAction(id, next);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Remove this menu item?")) return;
    startTransition(async () => {
      const result = await deleteMenuItemAction(id);
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Parcel Price</TableHead>
            <TableHead>Active</TableHead>
            <TableHead className="w-20" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{item.category}</Badge>
              </TableCell>
              <TableCell className="text-right">৳{item.price}</TableCell>
              <TableCell className="text-right">{item.parcelPrice != null ? `৳${item.parcelPrice}` : "—"}</TableCell>
              <TableCell>
                <Switch checked={item.isActive} disabled={isPending} onCheckedChange={(v) => handleToggle(item.id, v)} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <MenuItemDialog item={item} />
                  <Button variant="ghost" size="icon" disabled={isPending} onClick={() => handleDelete(item.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
