"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { savePartnerAction } from "@/app/partners/actions";
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

interface PartnerData {
  id: string;
  name: string;
  phone: string | null;
  sharePercent: number | null;
}

export function PartnerDialog({ partner }: { partner?: PartnerData }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(savePartnerAction, initialState);

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
      <DialogTrigger render={partner ? <Button variant="ghost" size="icon" aria-label={t("Edit partner")} /> : <Button />}>
        {partner ? (
          <Pencil className="h-4 w-4" />
        ) : (
          <>
            <Plus className="h-4 w-4" />
            {t("Add Partner")}
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{partner ? t("Edit Partner") : t("Add Partner")}</DialogTitle>
            <DialogDescription>{t("A dedicated equity account is created automatically for each partner.")}</DialogDescription>
          </DialogHeader>

          {partner && <input type="hidden" name="id" value={partner.id} />}

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">{t("Name")}</Label>
              <Input id="name" name="name" defaultValue={partner?.name} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="phone">{t("Phone (optional)")}</Label>
                <Input id="phone" name="phone" defaultValue={partner?.phone ?? undefined} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sharePercent">{t("Share % (optional)")}</Label>
                <Input
                  id="sharePercent"
                  name="sharePercent"
                  type="number"
                  step="0.001"
                  min="0"
                  max="100"
                  defaultValue={partner?.sharePercent ?? undefined}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t("Saving...") : t("Save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
