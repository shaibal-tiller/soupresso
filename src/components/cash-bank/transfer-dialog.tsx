"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { transferAction } from "@/app/cash-bank/actions";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionState } from "@/app/entries/actions";

const initialState: ActionState = { success: false, message: "" };

interface FundSourceOption {
  id: string;
  name: string;
}

export function TransferDialog({ fundSources }: { fundSources: FundSourceOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(transferAction, initialState);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const labels = useMemo(() => Object.fromEntries(fundSources.map((f) => [f.id, f.name])), [fundSources]);

  useEffect(() => {
    if (state.message) {
      if (state.success) {
        toast.success(state.message);
        setOpen(false);
        setFromId("");
        setToId("");
      } else {
        toast.error(state.message);
      }
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <ArrowLeftRight className="h-4 w-4" />
        Transfer
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Transfer Between Accounts</DialogTitle>
            <DialogDescription>e.g. depositing today&apos;s cash into the bank, or moving bKash to the bank.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="fromAccountId">From</Label>
                <Select name="fromAccountId" value={fromId} onValueChange={(v) => v && setFromId(v)}>
                  <SelectTrigger id="fromAccountId" className="w-full">
                    <SelectValue>{(value: string | null) => (value ? labels[value] : "Select account")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {fundSources.map((f) => (
                      <SelectItem key={f.id} value={f.id} disabled={f.id === toId}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="toAccountId">To</Label>
                <Select name="toAccountId" value={toId} onValueChange={(v) => v && setToId(v)}>
                  <SelectTrigger id="toAccountId" className="w-full">
                    <SelectValue>{(value: string | null) => (value ? labels[value] : "Select account")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {fundSources.map((f) => (
                      <SelectItem key={f.id} value={f.id} disabled={f.id === fromId}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="amount">Amount (৳)</Label>
                <Input id="amount" name="amount" type="number" step="0.01" min="0.01" placeholder="0.00" required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="date">Date</Label>
                <Input id="date" name="date" type="date" defaultValue={today} required />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description">Note (optional)</Label>
              <Input id="description" name="description" placeholder="e.g. Bank deposit" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || !fromId || !toId}>
              {pending ? "Saving..." : "Transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
