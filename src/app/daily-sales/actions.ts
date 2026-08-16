"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createDailySale,
  deleteDailySale,
  addQuickSale,
  type DailySaleItemInput,
  type DailySaleFundingInput,
} from "@/lib/ledger";
import { getActorName } from "@/lib/actor";
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
    const actor = await getActorName();
    await createDailySale(
      {
        date: new Date(`${dateRaw}T00:00:00.000Z`),
        fundings,
        notes,
        items,
      },
      actor,
    );
  } catch (error) {
    const isDuplicateDate =
      typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
    return {
      success: false,
      message: isDuplicateDate
        ? "A daily sales entry already exists for this date. Use Quick Sale to add more, or delete it first to re-enter."
        : error instanceof Error
          ? error.message
          : "Failed to save daily sales",
    };
  }

  revalidateAll();
  return { success: true, message: "Daily sales recorded" };
}

export async function deleteDailySaleAction(id: string): Promise<void> {
  const actor = await getActorName();
  await deleteDailySale(id, actor);
  revalidateAll();
}

export interface QuickSaleActionState {
  success: boolean;
  message: string;
  dayTotal?: number;
}

export async function quickSaleAction(_prevState: QuickSaleActionState, formData: FormData): Promise<QuickSaleActionState> {
  const fundSourceAccountId = formData.get("fundSourceAccountId");
  const cartRaw = formData.get("cart");

  if (!fundSourceAccountId || typeof fundSourceAccountId !== "string") {
    return { success: false, message: "Choose how the customer paid" };
  }
  if (!cartRaw || typeof cartRaw !== "string") {
    return { success: false, message: "Add at least one item" };
  }

  let cart: { menuItemId: string; quantity: number; isParcel: boolean }[];
  try {
    cart = JSON.parse(cartRaw);
  } catch {
    return { success: false, message: "Invalid order" };
  }
  if (!Array.isArray(cart) || cart.length === 0) {
    return { success: false, message: "Add at least one item" };
  }

  const menuItemIds = cart.map((c) => c.menuItemId);
  const menuItems = await prisma.menuItem.findMany({ where: { id: { in: menuItemIds } } });
  const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

  const items: DailySaleItemInput[] = [];
  for (const line of cart) {
    const menuItem = menuItemMap.get(line.menuItemId);
    if (!menuItem || !(line.quantity > 0)) continue;
    items.push({
      menuItemId: menuItem.id,
      quantity: line.quantity,
      isParcel: !!line.isParcel,
      unitPrice: Number(line.isParcel ? (menuItem.parcelPrice ?? menuItem.price) : menuItem.price),
    });
  }
  if (items.length === 0) {
    return { success: false, message: "Add at least one item" };
  }

  try {
    const actor = await getActorName();
    const today = new Date();
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const dailySale = await addQuickSale({ date, fundSourceAccountId, items }, actor);
    revalidateAll();
    return { success: true, message: "Order recorded", dayTotal: Number(dailySale.totalAmount) };
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to record order" };
  }
}
