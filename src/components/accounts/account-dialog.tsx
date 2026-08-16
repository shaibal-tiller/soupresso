"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { saveAccountAction } from "@/app/accounts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionState } from "@/app/entries/actions";
import { useLang } from "@/components/language-provider";

const TYPES = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

const initialState: ActionState = { success: false, message: "" };

interface AccountData {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string | null;
  isSystem: boolean;
}

export function AccountDialog({ account }: { account?: AccountData }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(saveAccountAction, initialState);
  const [type, setType] = useState(account?.type ?? "EXPENSE");

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
      <DialogTrigger render={account ? <Button variant="ghost" size="icon" aria-label={t("Edit account")} /> : <Button />}>
        {account ? (
          <Pencil className="h-4 w-4" />
        ) : (
          <>
            <Plus className="h-4 w-4" />
            {t("Add Account")}
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{account ? t("Edit Account") : t("Add Account")}</DialogTitle>
            <DialogDescription>
              {account?.isSystem
                ? t("This is a core account used by the posting engine — only its name and description can change.")
                : t("Custom accounts can be used with the Manual Adjustment entry category.")}
            </DialogDescription>
          </DialogHeader>

          {account && <input type="hidden" name="id" value={account.id} />}
          {account?.isSystem && <input type="hidden" name="code" value={account.code} />}
          {account?.isSystem && <input type="hidden" name="type" value={account.type} />}

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="code">{t("Code")}</Label>
                <Input id="code" name="code" defaultValue={account?.code} disabled={account?.isSystem} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="typeSelect">{t("Type")}</Label>
                {account?.isSystem ? (
                  <Input value={account.type} disabled />
                ) : (
                  <>
                    <Select value={type} onValueChange={(value) => value && setType(value)}>
                      <SelectTrigger id="typeSelect" className="w-full">
                        <SelectValue>
                          {(value: string | null) => (value ? t(value.charAt(0) + value.slice(1).toLowerCase()) : t("Select"))}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {TYPES.map((typeValue) => (
                          <SelectItem key={typeValue} value={typeValue}>
                            {t(typeValue.charAt(0) + typeValue.slice(1).toLowerCase())}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <input type="hidden" name="type" value={type} />
                  </>
                )}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="name">{t("Name")}</Label>
              <Input id="name" name="name" defaultValue={account?.name} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">{t("Description (optional)")}</Label>
              <Textarea id="description" name="description" defaultValue={account?.description ?? undefined} rows={2} />
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
