"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Trash2, ShoppingCart } from "lucide-react";
import { quickSaleAction, type QuickSaleActionState } from "@/app/daily-sales/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { formatTaka } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMenuVisual } from "@/lib/menu-icon";

interface MenuItemOption {
  id: string;
  name: string;
  price: number;
  parcelPrice: number | null;
  category: string;
}

interface FundSourceOption {
  id: string;
  name: string;
}

interface CartLine {
  key: string;
  menuItemId: string;
  name: string;
  isParcel: boolean;
  unitPrice: number;
  quantity: number;
}

const initialState: QuickSaleActionState = { success: false, message: "" };

export function QuickSalePanel({
  menuItems,
  fundSources,
  initialTodayTotal,
}: {
  menuItems: MenuItemOption[];
  fundSources: FundSourceOption[];
  initialTodayTotal: number;
}) {
  const [state, formAction, pending] = useActionState(quickSaleAction, initialState);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [fundSourceId, setFundSourceId] = useState(fundSources[0]?.id ?? "");
  const [todayTotal, setTodayTotal] = useState(initialTodayTotal);

  const lines = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
  const fundSourceLabels = useMemo(() => Object.fromEntries(fundSources.map((f) => [f.id, f.name])), [fundSources]);

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast.success(state.message);
        setCart({});
        if (state.dayTotal != null) setTodayTotal(state.dayTotal);
      } else {
        toast.error(state.message);
      }
    }
  }, [state]);

  function addItem(item: MenuItemOption, isParcel: boolean) {
    const key = `${item.id}-${isParcel}`;
    const unitPrice = isParcel ? (item.parcelPrice ?? item.price) : item.price;
    setCart((prev) => {
      const existing = prev[key];
      return {
        ...prev,
        [key]: existing
          ? { ...existing, quantity: existing.quantity + 1 }
          : { key, menuItemId: item.id, name: item.name, isParcel, unitPrice, quantity: 1 },
      };
    });
  }

  function adjustQty(key: string, delta: number) {
    setCart((prev) => {
      const existing = prev[key];
      if (!existing) return prev;
      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        const { [key]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [key]: { ...existing, quantity: nextQty } };
    });
  }

  function handleSubmit(formData: FormData) {
    if (lines.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    if (!fundSourceId) {
      toast.error("Choose how the customer paid");
      return;
    }
    const cartPayload = lines.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity, isParcel: l.isParcel }));
    formData.set("cart", JSON.stringify(cartPayload));
    formData.set("fundSourceAccountId", fundSourceId);
    formAction(formData);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-brand-amber to-brand-amber-deep px-4 py-3 text-white shadow-sm">
        <span className="text-sm font-medium opacity-90">Today&apos;s sales so far</span>
        <span className="font-heading text-xl font-bold tabular-nums">{formatTaka(todayTotal)}</span>
      </div>

      <div>
        <Label className="mb-2 block text-sm text-muted-foreground">Tap an item to add it to the order</Label>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {menuItems.map((item) => {
            const visual = getMenuVisual(item.name, item.category);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => addItem(item, false)}
                className="group relative flex flex-col items-start gap-1 overflow-hidden rounded-2xl border bg-card p-3 text-left shadow-sm transition-all active:scale-[0.97] active:bg-muted hover:shadow-md"
              >
                <div className={cn("absolute inset-x-0 top-0 h-1.5", visual.accentClass)} />
                <div className={cn("mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg", visual.badgeClass)}>
                  {visual.emoji}
                </div>
                <span className="font-heading mt-1 text-sm font-semibold leading-tight">{item.name}</span>
                <span className="text-xs font-medium text-brand-maroon">৳{item.price}</span>
                {item.parcelPrice != null && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      addItem(item, true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        addItem(item, true);
                      }
                    }}
                    className="mt-0.5 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    Parcel ৳{item.parcelPrice}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-sm">
              <ShoppingCart className="h-4 w-4" />
              Current Order
            </Label>
            <span className="text-sm font-medium tabular-nums">{formatTaka(cartTotal)}</span>
          </div>

          {lines.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No items yet — tap something above.</p>
          ) : (
            <div className="grid gap-2">
              {lines.map((line) => (
                <div key={line.key} className="flex items-center justify-between gap-2 rounded-xl border px-3 py-2">
                  <div className="min-w-0">
                    <div className="font-heading truncate text-sm font-semibold">
                      {line.name}
                      {line.isParcel && <span className="font-sans font-normal text-muted-foreground"> (parcel)</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ৳{line.unitPrice} × {line.quantity} = {formatTaka(line.unitPrice * line.quantity)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustQty(line.key, -1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
                    <Button type="button" variant="outline" size="icon-sm" onClick={() => adjustQty(line.key, 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setCart((prev) => {
                        const { [line.key]: _removed, ...rest } = prev;
                        return rest;
                      })}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="quickSaleFundSource">Customer paid with</Label>
            {fundSources.length === 0 ? (
              <p className="text-xs text-muted-foreground">No cash/bank accounts yet — add one on the Cash &amp; Bank page.</p>
            ) : (
              <Select value={fundSourceId} onValueChange={(v) => v && setFundSourceId(v)}>
                <SelectTrigger id="quickSaleFundSource" className="w-full">
                  <SelectValue>{(value: string | null) => (value ? fundSourceLabels[value] : "Select account")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {fundSources.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <form action={handleSubmit}>
            <Button
              type="submit"
              disabled={pending || lines.length === 0 || !fundSourceId}
              className={cn("w-full", lines.length > 0 && "sticky bottom-20 md:static")}
            >
              {pending ? "Recording..." : `Record Order — ${formatTaka(cartTotal)}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
