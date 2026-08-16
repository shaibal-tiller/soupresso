"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { renameFundSourceAction } from "@/app/cash-bank/actions";
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

const initialState: ActionState = { success: false, message: "" };

export function EditFundSourceDialog({
  account,
}: {
  account: { id: string; name: string; description: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(renameFundSourceAction, initialState);

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
      <DialogTrigger render={<Button variant="ghost" size="icon" aria-label="Edit account" />}>
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Renaming doesn&apos;t affect its balance or history.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="accountId" value={account.id} />

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={account.name} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" name="description" defaultValue={account.description ?? undefined} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
