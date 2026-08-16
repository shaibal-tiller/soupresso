"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createDailySaleAction } from "@/app/daily-sales/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { formatTaka } from "@/lib/format";
import type { ActionState } from "@/app/entries/actions";
import { useLang } from "@/components/language-provider";

interface MenuItemOption {
  id: string;
  name: string;
  price: number;
  parcelPrice: number | null;
}

interface FundSourceOption {
  id: string;
  name: string;
}

const initialState: ActionState = { success: false, message: "" };

export function DailySaleForm({ menuItems, fundSources }: { menuItems: MenuItemOption[]; fundSources: FundSourceOption[] }) {
  const { t } = useLang();
  const [state, formAction, pending] = useActionState(createDailySaleAction, initialState);
  const [fundAmounts, setFundAmounts] = useState<Record<string, string>>({});
  const [quantities, setQuantities] = useState<Record<string, { regular: string; parcel: string }>>({});
  const [formKey, setFormKey] = useState(0);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast.success(state.message);
        setFormKey((k) => k + 1);
        setFundAmounts({});
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

  const fundsTotal = Object.values(fundAmounts).reduce((sum, v) => sum + Number(v || 0), 0);
  const diff = fundsTotal - itemsTotal;

  function updateQty(id: string, field: "regular" | "parcel", value: string) {
    setQuantities((prev) => ({ ...prev, [id]: { regular: prev[id]?.regular ?? "", parcel: prev[id]?.parcel ?? "", [field]: value } }));
  }

  return (
    <form key={formKey} action={formAction} className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="date">{t("Date")}</Label>
          <Input id="date" name="date" type="date" defaultValue={today} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="notes">{t("Notes (optional)")}</Label>
          <Input id="notes" name="notes" placeholder={t("Anything worth noting about today's sales")} />
        </div>
      </div>

      <div>
        <Label className="mb-2 block text-base">{t("Amount collected, by account")}</Label>
        {fundSources.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("No cash/bank accounts yet — add one on the Cash & Bank page.")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fundSources.map((f) => (
              <div key={f.id} className="grid gap-1.5">
                <Label htmlFor={`fund_${f.id}`} className="text-sm font-normal text-muted-foreground">
                  {f.name}
                </Label>
                <Input
                  id={`fund_${f.id}`}
                  name={`fund_${f.id}`}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={fundAmounts[f.id] ?? ""}
                  onChange={(e) => setFundAmounts((prev) => ({ ...prev, [f.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-base">{t("Item breakdown (optional, approximate)")}</Label>
          <span className="text-sm text-muted-foreground">
            {t("Items subtotal:")} <span className="font-medium text-foreground">{formatTaka(itemsTotal)}</span>
          </span>
        </div>
        <Card>
          <CardContent className="grid gap-3 pt-4">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-xs font-medium text-muted-foreground sm:grid-cols-[1fr_120px_120px]">
              <span>{t("Item")}</span>
              <span className="text-right">{t("Regular Qty")}</span>
              <span className="text-right">{t("Parcel Qty")}</span>
            </div>
            {menuItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 sm:grid-cols-[1fr_120px_120px]">
                <div>
                  <div className="text-sm font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    ৳{item.price}
                    {item.parcelPrice ? ` / ৳${item.parcelPrice} ${t("parcel")}` : ""}
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
        {fundsTotal > 0 && itemsTotal > 0 && Math.abs(diff) > 0.5 && (
          <p className="mt-2 text-xs text-amber-600">
            {t("Heads up: item subtotal differs from the amount collected by")} {formatTaka(Math.abs(diff))}.{" "}
            {t("That's fine — item breakdown is approximate.")}
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? t("Saving...") : t("Record Daily Sales")}
      </Button>
    </form>
  );
}
