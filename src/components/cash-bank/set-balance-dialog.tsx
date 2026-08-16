"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Scale } from "lucide-react";
import { setBalanceAction } from "@/app/cash-bank/actions";
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
import { formatTaka } from "@/lib/format";
import type { ActionState } from "@/app/entries/actions";
import { useLang } from "@/components/language-provider";

const initialState: ActionState = { success: false, message: "" };

export function SetBalanceDialog({ account }: { account: { id: string; name: string; balance: number } }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(setBalanceAction, initialState);
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
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label={t("Adjust balance")} />}>
        <Scale className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{t("Adjust Balance")} — {account.name}</DialogTitle>
            <DialogDescription>
              {t("Current ledger balance:")} <span className="font-medium text-foreground">{formatTaka(account.balance)}</span>.{" "}
              {t("Enter what it should actually be (e.g. after counting the cash box) and a correction entry is posted for the difference.")}
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="accountId" value={account.id} />

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="targetBalance">{t("Correct Balance (৳)")}</Label>
                <Input
                  id="targetBalance"
                  name="targetBalance"
                  type="number"
                  step="0.01"
                  defaultValue={account.balance}
                  required
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="date">{t("As Of")}</Label>
                <Input id="date" name="date" type="date" defaultValue={today} required />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">{t("Note (optional)")}</Label>
              <Input id="description" name="description" placeholder={t("e.g. Cash count on 16 Aug")} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving...") : t("Save Correction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
