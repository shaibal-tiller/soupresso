"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2, ShoppingBasket } from "lucide-react";
import { quickPurchaseAction, type QuickPurchaseActionState } from "@/app/entries/purchase-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTaka, PAYMENT_METHOD_LABELS } from "@/lib/format";
import { isPaymentMethodAllowed, type PaymentMethodValue } from "@/lib/entry-meta";
import { getPurchaseVisual } from "@/lib/purchase-icon";
import { cn } from "@/lib/utils";
import { ManageItemsSheet } from "@/components/quick-purchase/manage-items-sheet";

export interface PurchaseItemOption {
  id: string;
  name: string;
  category: string;
  unit: string | null;
  isActive: boolean;
}

interface FundSourceOption {
  id: string;
  name: string;
}

interface CartLine {
  key: string;
  purchaseItemId: string;
  name: string;
  category: string;
  unit: string | null;
  quantity: string;
  amount: string;
}

const initialState: QuickPurchaseActionState = { success: false, message: "" };
const PAYMENT_METHODS: PaymentMethodValue[] = ["FUND_SOURCE", "CREDIT"];

export function QuickPurchasePanel({
  items,
  fundSources,
}: {
  items: PurchaseItemOption[];
  fundSources: FundSourceOption[];
}) {
  const [state, formAction, pending] = useActionState(quickPurchaseAction, initialState);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [vendor, setVendor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("FUND_SOURCE");
  const [fundSourceId, setFundSourceId] = useState(fundSources[0]?.id ?? "");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const activeItems = useMemo(() => items.filter((i) => i.isActive), [items]);

  const lines = useMemo(() => Object.values(cart), [cart]);
  const cartTotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const fundSourceLabels = useMemo(() => Object.fromEntries(fundSources.map((f) => [f.id, f.name])), [fundSources]);
  const needsFundSource = paymentMethod === "FUND_SOURCE";

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast.success(state.message);
        setCart({});
        setVendor("");
      } else {
        toast.error(state.message);
      }
    }
  }, [state]);

  function toggleItem(item: PurchaseItemOption) {
    setCart((prev) => {
      if (prev[item.id]) {
        const { [item.id]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [item.id]: {
          key: item.id,
          purchaseItemId: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          quantity: "",
          amount: "",
        },
      };
    });
  }

  function updateLine(key: string, field: "quantity" | "amount", value: string) {
    setCart((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], [field]: value } } : prev));
  }

  function removeLine(key: string) {
    setCart((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function handleSubmit(formData: FormData) {
    const cartPayload = lines
      .filter((l) => Number(l.amount) > 0)
      .map((l) => ({
        category: l.category,
        description: l.name,
        quantity: l.quantity ? Number(l.quantity) : null,
        unit: l.unit,
        amount: Number(l.amount),
      }));
    if (cartPayload.length === 0) {
      toast.error("Add an amount for at least one item");
      return;
    }
    if (needsFundSource && !fundSourceId) {
      toast.error("Choose which cash/bank account this uses");
      return;
    }
    formData.set("cart", JSON.stringify(cartPayload));
    formData.set("paymentMethod", paymentMethod);
    if (needsFundSource) formData.set("fundSourceAccountId", fundSourceId);
    formAction(formData);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm text-muted-foreground">Tap what you bought today</Label>
        <ManageItemsSheet items={items} />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {activeItems.map((item) => {
          const visual = getPurchaseVisual(item.name, item.category);
          const selected = !!cart[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleItem(item)}
              className={cn(
                "group relative flex flex-col items-center gap-1 overflow-hidden rounded-xl border bg-card p-2.5 text-center shadow-sm transition-all active:scale-[0.97]",
                selected ? "border-brand-amber ring-2 ring-brand-amber/40" : "hover:shadow-md",
              )}
            >
              <div className={cn("absolute inset-x-0 top-0 h-1", visual.accentClass)} />
              <div className={cn("mt-1 flex h-9 w-9 items-center justify-center rounded-full text-base", visual.badgeClass)}>
                {visual.emoji}
              </div>
              <span className="font-heading text-xs font-semibold leading-tight">{item.name}</span>
              {item.unit && <span className="text-[10px] text-muted-foreground">per {item.unit}</span>}
            </button>
          );
        })}
      </div>

      {activeItems.length === 0 && (
        <p className="text-sm text-muted-foreground">No purchase items yet — add some from &quot;Manage items&quot;.</p>
      )}

      <Card>
        <CardContent className="grid gap-3 pt-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-sm">
              <ShoppingBasket className="h-4 w-4" />
              Today&apos;s Basket
            </Label>
            <span className="text-sm font-medium tabular-nums">{formatTaka(cartTotal)}</span>
          </div>

          {lines.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No items yet — tap something above.</p>
          ) : (
            <div className="grid gap-2">
              {lines.map((line) => (
                <div key={line.key} className="grid grid-cols-[1fr_72px_100px_auto] items-center gap-2 rounded-lg border px-2.5 py-2 sm:grid-cols-[1fr_88px_120px_auto]">
                  <div className="min-w-0">
                    <div className="font-heading truncate text-sm font-semibold">{line.name}</div>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={line.unit ?? "qty"}
                    value={line.quantity}
                    onChange={(e) => updateLine(line.key, "quantity", e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="৳ amount"
                    value={line.amount}
                    onChange={(e) => updateLine(line.key, "amount", e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeLine(line.key)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="qp-date">Date</Label>
              <Input id="qp-date" name="date" type="date" defaultValue={today} required form="quick-purchase-form" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qp-vendor">Vendor (optional)</Label>
              <Input
                id="qp-vendor"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Karwan Bazar"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="qp-payment">Payment Method</Label>
              <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v as PaymentMethodValue)}>
                <SelectTrigger id="qp-payment" className="w-full">
                  <SelectValue>{(value: string | null) => (value ? PAYMENT_METHOD_LABELS[value] : "Select")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.filter((pm) => isPaymentMethodAllowed("RAW_MATERIAL", pm)).map((pm) => (
                    <SelectItem key={pm} value={pm}>
                      {PAYMENT_METHOD_LABELS[pm]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {needsFundSource && (
            <div className="grid gap-1.5">
              <Label htmlFor="qp-fund">Cash / Bank Account</Label>
              <Select value={fundSourceId} onValueChange={(v) => v && setFundSourceId(v)}>
                <SelectTrigger id="qp-fund" className="w-full">
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
            </div>
          )}

          <form id="quick-purchase-form" action={handleSubmit}>
            <input type="hidden" name="vendor" value={vendor} />
            <Button type="submit" disabled={pending || lines.length === 0} className="w-full sm:w-auto">
              {pending ? "Saving..." : `Save ${lines.length || ""} Purchase${lines.length === 1 ? "" : "s"} — ${formatTaka(cartTotal)}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
