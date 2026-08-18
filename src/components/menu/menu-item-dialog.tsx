"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { saveMenuItemAction } from "@/app/menu/actions";
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
import { useLang } from "@/components/language-provider";

const CATEGORIES = ["SOUP", "MAIN", "SNACK", "DRINK", "OTHER"];

const initialState: ActionState = { success: false, message: "" };

interface MenuItemData {
  id: string;
  name: string;
  nameBn?: string | null;
  price: number;
  parcelPrice: number | null;
  category: string;
}

export function MenuItemDialog({ item }: { item?: MenuItemData }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(saveMenuItemAction, initialState);
  const [category, setCategory] = useState(item?.category ?? "OTHER");

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
      <DialogTrigger render={item ? <Button variant="ghost" size="icon" aria-label={t("Edit item")} /> : <Button />}>
        {item ? (
          <Pencil className="h-4 w-4" />
        ) : (
          <>
            <Plus className="h-4 w-4" />
            {t("Add Menu Item")}
          </>
        )}
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>{item ? t("Edit Menu Item") : t("Add Menu Item")}</DialogTitle>
            <DialogDescription>{t("Prices are used only for the Daily Sales item breakdown.")}</DialogDescription>
          </DialogHeader>

          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="category" value={category} />

          <div className="grid gap-4 py-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">{t("Name")}</Label>
              <Input id="name" name="name" defaultValue={item?.name} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="name-bn">{t("Bangla Name (optional)")}</Label>
              <Input id="name-bn" name="nameBn" defaultValue={item?.nameBn ?? undefined} placeholder="যেমন মোমো" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="price">{t("Price (৳)")}</Label>
                <Input id="price" name="price" type="number" step="0.01" min="0.01" defaultValue={item?.price} required />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="parcelPrice">{t("Parcel Price (optional)")}</Label>
                <Input id="parcelPrice" name="parcelPrice" type="number" step="0.01" min="0" defaultValue={item?.parcelPrice ?? undefined} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="categorySelect">{t("Category")}</Label>
              <Select value={category} onValueChange={(value) => value && setCategory(value)}>
                <SelectTrigger id="categorySelect" className="w-full">
                  <SelectValue>
                    {(value: string | null) => (value ? t(value.charAt(0) + value.slice(1).toLowerCase()) : t("Select"))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(c.charAt(0) + c.slice(1).toLowerCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
