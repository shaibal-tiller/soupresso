"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { createFundSourceAction } from "@/app/cash-bank/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ActionState } from "@/app/entries/actions";
import { useLang } from "@/components/language-provider";

const initialState: ActionState = { success: false, message: "" };

export function AddFundSourceDialog() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createFundSourceAction, initialState);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast.success(state.message);
        setOpen(false);
      } else {
        toast.error(state.message);
      }
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" />
        {t("Add Account")}
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{t("Add Cash / Bank Account")}</DialogTitle>
            <DialogDescription>
              {t("For a physical cash box, a bank account, or a mobile banking wallet (bKash, Nagad, Rocket...).")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">{t("Name")}</Label>
              <Input id="name" name="name" placeholder={t("e.g. bKash, City Bank - 4521")} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="openingBalance">{t("Starting Balance (৳)")}</Label>
                <Input id="openingBalance" name="openingBalance" type="number" step="0.01" placeholder="0.00" defaultValue="0" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="date">{t("As Of")}</Label>
                <Input id="date" name="date" type="date" defaultValue={today} required />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "If this account already has money in it, enter the current balance — it's posted against a Balance Adjustments account so your books stay correct without touching profit.",
              )}
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving...") : t("Add Account")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
