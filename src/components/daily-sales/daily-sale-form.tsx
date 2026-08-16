"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createDailySaleAction } from "@/app/daily-sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { formatTaka } from "@/lib/format";
import type { ActionState } from "@/app/entries/actions";

interface MenuItemOption {
  id: string;
  name: string;
  price: number;
  parcelPrice: number | null;
}

const initialState: ActionState = { success: false, message: "" };

export function DailySaleForm({ menuItems }: { menuItems: MenuItemOption[] }) {
  const [state, formAction, pending] = useActionState(createDailySaleAction, initialState);
  const [cashAmount, setCashAmount] = useState("");
  const [bankAmount, setBankAmount] = useState("");
  const [quantities, setQuantities] = useState<Record<string, { regular: string; parcel: string }>>({});
  const [formKey, setFormKey] = useState(0);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast.success(state.message);
        setFormKey((k) => k + 1);
        setCashAmount("");
        setBankAmount("");
        setQuantities({});
      } else {
        toast.error(state.message);
      }
    }
  }, [state]);

  const itemsTotal = menuItems.reduce((sum, item) => {
    const q = quantities[item.id];
    if (!q) return sum;
    const regular = Number(q.regular || 0) * item.price;
    const parcel = Number(q.parcel || 0) * (item.parcelPrice ?? item.price);
    return sum + regular + parcel;
  }, 0);

  const cashBankTotal = Number(cashAmount || 0) + Number(bankAmount || 0);
  const diff = cashBankTotal - itemsTotal;

  function updateQty(id: string, field: "regular" | "parcel", value: string) {
    setQuantities((prev) => ({ ...prev, [id]: { regular: prev[id]?.regular ?? "", parcel: prev[id]?.parcel ?? "", [field]: value } }));
  }

  return (
    <form key={formKey} action={formAction} className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cashAmount">Cash Collected (৳)</Label>
          <Input
            id="cashAmount"
            name="cashAmount"
            type="number"
            step="0.01"
            min="0"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bankAmount">Bank / Mobile Banking (৳)</Label>
          <Input
            id="bankAmount"
            name="bankAmount"
            type="number"
            step="0.01"
            min="0"
            value={bankAmount}
            onChange={(e) => setBankAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Anything worth noting about today's sales" />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-base">Item breakdown (optional, approximate)</Label>
          <span className="text-sm text-muted-foreground">
            Items subtotal: <span className="font-medium text-foreground">{formatTaka(itemsTotal)}</span>
          </span>
        </div>
        <Card>
          <CardContent className="grid gap-3 pt-4">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-xs font-medium text-muted-foreground sm:grid-cols-[1fr_120px_120px]">
              <span>Item</span>
              <span className="text-right">Regular Qty</span>
              <span className="text-right">Parcel Qty</span>
            </div>
            {menuItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 sm:grid-cols-[1fr_120px_120px]">
                <div>
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    ৳{item.price}
                    {item.parcelPrice ? ` / ৳${item.parcelPrice} parcel` : ""}
                  </div>
                </div>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  name={`qty_regular_${item.id}`}
                  className="w-20 justify-self-end sm:w-full"
                  placeholder="0"
                  value={quantities[item.id]?.regular ?? ""}
                  onChange={(e) => updateQty(item.id, "regular", e.target.value)}
                />
                {item.parcelPrice != null ? (
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    name={`qty_parcel_${item.id}`}
                    className="w-20 justify-self-end sm:w-full"
                    placeholder="0"
                    value={quantities[item.id]?.parcel ?? ""}
                    onChange={(e) => updateQty(item.id, "parcel", e.target.value)}
                  />
                ) : (
                  <input type="hidden" name={`qty_parcel_${item.id}`} value="0" />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        {cashBankTotal > 0 && itemsTotal > 0 && Math.abs(diff) > 0.5 && (
          <p className="mt-2 text-xs text-amber-600">
            Heads up: item subtotal differs from cash+bank total by {formatTaka(Math.abs(diff))}. That&apos;s fine — item
            breakdown is approximate.
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Saving..." : "Record Daily Sales"}
      </Button>
    </form>
  );
}
