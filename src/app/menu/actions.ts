"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ActionState } from "@/app/entries/actions";
import type { MenuCategory } from "@/generated/prisma/client";

function revalidateAll() {
  revalidatePath("/menu");
  revalidatePath("/daily-sales");
}

const menuItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  price: z.coerce.number().positive("Price must be greater than zero"),
  parcelPrice: z.string().optional(),
  category: z.string().min(1),
});

export async function saveMenuItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = menuItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const parcelPrice = data.parcelPrice ? Number(data.parcelPrice) : null;

  try {
    if (data.id) {
      await prisma.menuItem.update({
        where: { id: data.id },
        data: { name: data.name, price: data.price, parcelPrice, category: data.category as MenuCategory },
      });
    } else {
      const maxSort = await prisma.menuItem.aggregate({ _max: { sortOrder: true } });
      await prisma.menuItem.create({
        data: {
          name: data.name,
          price: data.price,
          parcelPrice,
          category: data.category as MenuCategory,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        },
      });
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to save menu item" };
  }

  revalidateAll();
  return { success: true, message: data.id ? "Menu item updated" : "Menu item added" };
}

export async function toggleMenuItemActiveAction(id: string, isActive: boolean): Promise<void> {
  await prisma.menuItem.update({ where: { id }, data: { isActive } });
  revalidateAll();
}

export async function deleteMenuItemAction(id: string): Promise<{ success: boolean; message: string }> {
  const usageCount = await prisma.dailySaleItem.count({ where: { menuItemId: id } });
  if (usageCount > 0) {
    await prisma.menuItem.update({ where: { id }, data: { isActive: false } });
    revalidateAll();
    return { success: true, message: "Item has sales history, so it was deactivated instead of deleted." };
  }
  await prisma.menuItem.delete({ where: { id } });
  revalidateAll();
  return { success: true, message: "Menu item deleted" };
}
