"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { savePurchaseItemAction } from "@/app/entries/purchase-actions";
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
import { QUICK_PURCHASE_CATEGORIES, CATEGORY_LABELS } from "@/lib/entry-meta";
import type { ActionState } from "@/app/entries/actions";

const initialState: ActionState = { success: false, message: "" };

interface PurchaseItemData {
  id: string;
  name: string;
  category: string;
  unit: string | null;
}

export function PurchaseItemDialog({ item }: { item?: PurchaseItemData }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(savePurchaseItemAction, initialState);
  const [category, setCategory] = useState(item?.category ?? "RAW_MATERIAL");

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
      <DialogTrigger render={item ? <Button variant="ghost" size="icon-sm" aria-label="Edit item" /> : <Button size="sm" />}>
        {item ? (
          <Pencil className="h-3.5 w-3.5" />
        ) : (
          <>
            <Plus className="h-4 w-4" />
            Add Item
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{item ? "Edit Item" : "Add Purchase Item"}</DialogTitle>
            <DialogDescription>Shows up as a tap-to-add tile on the Entries page. Prices aren&apos;t stored here since they vary each trip.</DialogDescription>
          </DialogHeader>

          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="category" value={category} />

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="pi-name">Name</Label>
              <Input id="pi-name" name="name" defaultValue={item?.name} placeholder="e.g. Chicken" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="pi-category">Category</Label>
                <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger id="pi-category" className="w-full">
                    <SelectValue>{(value: string | null) => (value ? CATEGORY_LABELS[value] : "Select")}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {QUICK_PURCHASE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="pi-unit">Unit (optional)</Label>
                <Input id="pi-unit" name="unit" defaultValue={item?.unit ?? undefined} placeholder="kg, pc, litre..." />
              </div>
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
