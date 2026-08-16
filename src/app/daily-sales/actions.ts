"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createDailySale, deleteDailySale, type DailySaleItemInput, type DailySaleFundingInput } from "@/lib/ledger";
import type { ActionState } from "@/app/entries/actions";

function revalidateAll() {
  revalidatePath("/daily-sales");
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function createDailySaleAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const dateRaw = formData.get("date");
  const notes = (formData.get("notes") as string) || null;

  if (!dateRaw || typeof dateRaw !== "string") {
    return { success: false, message: "Date is required" };
  }

  const fundSourceAccounts = await prisma.account.findMany({ where: { isActive: true, isFundSource: true } });
  const fundings: DailySaleFundingInput[] = [];
  for (const account of fundSourceAccounts) {
    const amount = Number(formData.get(`fund_${account.id}`) || 0);
    if (amount > 0) fundings.push({ fundSourceAccountId: account.id, amount });
  }
  if (fundings.length === 0) {
    return { success: false, message: "Enter at least one cash/bank amount" };
  }

  const menuItems = await prisma.menuItem.findMany({ where: { isActive: true } });
  const items: DailySaleItemInput[] = [];
  for (const item of menuItems) {
    const regularQty = Number(formData.get(`qty_regular_${item.id}`) || 0);
    const parcelQty = Number(formData.get(`qty_parcel_${item.id}`) || 0);
    if (regularQty > 0) {
      items.push({ menuItemId: item.id, quantity: regularQty, isParcel: false, unitPrice: Number(item.price) });
    }
    if (parcelQty > 0) {
      items.push({
        menuItemId: item.id,
        quantity: parcelQty,
        isParcel: true,
        unitPrice: Number(item.parcelPrice ?? item.price),
      });
    }
  }

  try {
    await createDailySale({
      date: new Date(`${dateRaw}T00:00:00.000Z`),
      fundings,
      notes,
      items,
    });
  } catch (error) {
    const isDuplicateDate =
      typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
    return {
      success: false,
      message: isDuplicateDate
        ? "A daily sales entry already exists for this date. Delete it first to re-enter."
        : error instanceof Error
          ? error.message
          : "Failed to save daily sales",
    };
  }

  revalidateAll();
  return { success: true, message: "Daily sales recorded" };
}

export async function deleteDailySaleAction(id: string): Promise<void> {
  await deleteDailySale(id);
  revalidateAll();
}
