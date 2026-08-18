"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Settings2, Trash2 } from "lucide-react";
import { togglePurchaseItemActiveAction, deletePurchaseItemAction } from "@/app/entries/purchase-actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { PurchaseItemDialog } from "@/components/quick-purchase/purchase-item-dialog";
import { getPurchaseVisual } from "@/lib/purchase-icon";
import { getPurchaseGroupKey, PURCHASE_GROUP_LABELS } from "@/lib/purchase-group";
import { cn } from "@/lib/utils";
import { itemLabel } from "@/lib/i18n-shared";
import { useLang } from "@/components/language-provider";

export interface PurchaseItemRow {
  id: string;
  name: string;
  nameBn?: string | null;
  category: string;
  unit: string | null;
  isActive: boolean;
}

export function ManageItemsSheet({ items }: { items: PurchaseItemRow[] }) {
  const { t, lang } = useLang();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggle(id: string, next: boolean) {
    startTransition(async () => {
      await togglePurchaseItemActiveAction(id, next);
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t("Remove this item from the picker?"))) return;
    startTransition(async () => {
      await deletePurchaseItemAction(id);
      toast.success(t("Item removed"));
    });
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Settings2 className="h-3.5 w-3.5" />
        {t("Manage items")}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("Purchase Items")}</SheetTitle>
            <SheetDescription>
              {t("The tap-to-add shortlist on the Entries page. Toggle off instead of deleting to keep history intact.")}
            </SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 overflow-y-auto p-4 pt-0">
            <PurchaseItemDialog />
            {items.map((item) => {
              const visual = getPurchaseVisual(item.name, item.category);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border p-2.5",
                    !item.isActive && "opacity-55",
                  )}
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm", visual.badgeClass)}>
                    {visual.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{itemLabel(lang, item.name, item.nameBn)}</div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                        {t(PURCHASE_GROUP_LABELS[getPurchaseGroupKey(item.name, item.category)])}
                      </Badge>
                      {item.unit && <span className="text-[10px] text-muted-foreground">{t("per")} {t(item.unit)}</span>}
                    </div>
                  </div>
                  <Switch checked={item.isActive} disabled={isPending} onCheckedChange={(v) => handleToggle(item.id, v)} />
                  <PurchaseItemDialog item={item} />
                  <Button variant="ghost" size="icon-sm" disabled={isPending} onClick={() => handleDelete(item.id)} aria-label={t("Delete")}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
