"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { toggleMenuItemActiveAction, deleteMenuItemAction } from "@/app/menu/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MenuItemDialog } from "@/components/menu/menu-item-dialog";
import { getMenuVisual } from "@/lib/menu-icon";
import { cn } from "@/lib/utils";

export interface MenuItemRow {
  id: string;
  name: string;
  price: number;
  parcelPrice: number | null;
  category: string;
  isActive: boolean;
}

export function MenuCardGrid({ items }: { items: MenuItemRow[] }) {
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

  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No menu items yet. Add your first one above.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item) => {
        const visual = getMenuVisual(item.name, item.category);
        return (
          <div
            key={item.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-opacity",
              !item.isActive && "opacity-55",
            )}
          >
            <div className={cn("h-1.5 w-full", visual.accentClass)} />
            <div className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-full text-xl", visual.badgeClass)}>
                  {visual.emoji}
                </div>
                <Switch checked={item.isActive} disabled={isPending} onCheckedChange={(v) => handleToggle(item.id, v)} />
              </div>

              <div className="mt-3">
                <div className="font-heading truncate text-[15px] font-semibold leading-tight">{item.name}</div>
                <Badge variant="outline" className="mt-1 text-[10px] font-normal text-muted-foreground">
                  {item.category}
                </Badge>
              </div>

              <div className="mt-2.5 flex items-baseline gap-1.5">
                <span className="font-heading text-lg font-bold text-brand-maroon">৳{item.price}</span>
                {item.parcelPrice != null && <span className="text-xs text-muted-foreground">/ ৳{item.parcelPrice} parcel</span>}
              </div>

              <div className="mt-3 flex items-center justify-end gap-1 border-t pt-2.5">
                <MenuItemDialog item={item} />
                <Button variant="ghost" size="icon-sm" disabled={isPending} onClick={() => handleDelete(item.id)} aria-label="Delete">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
