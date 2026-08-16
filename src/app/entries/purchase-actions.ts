"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createQuickPurchaseBatch,
  savePurchaseItem,
  setPurchaseItemActive,
  deletePurchaseItem,
  type QuickPurchaseLineInput,
} from "@/lib/ledger";
import { getActorName } from "@/lib/actor";
import type { ActionState } from "@/app/entries/actions";
import type { EntryCategory } from "@/generated/prisma/client";

function revalidateAll() {
  revalidatePath("/entries");
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/accounts");
}

export interface QuickPurchaseActionState {
  success: boolean;
  message: string;
}

const cartLineSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  quantity: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  amount: z.number().positive(),
});

export async function quickPurchaseAction(
  _prevState: QuickPurchaseActionState,
  formData: FormData,
): Promise<QuickPurchaseActionState> {
  const dateRaw = formData.get("date");
  const vendor = (formData.get("vendor") as string) || null;
  const paymentMethod = formData.get("paymentMethod");
  const fundSourceAccountId = (formData.get("fundSourceAccountId") as string) || null;
  const cartRaw = formData.get("cart");

  if (!dateRaw || typeof dateRaw !== "string") {
    return { success: false, message: "Date is required" };
  }
  if (!paymentMethod || typeof paymentMethod !== "string") {
    return { success: false, message: "Choose a payment method" };
  }
  if (!cartRaw || typeof cartRaw !== "string") {
    return { success: false, message: "Add at least one item" };
  }

  let cart: unknown;
  try {
    cart = JSON.parse(cartRaw);
  } catch {
    return { success: false, message: "Invalid basket" };
  }
  const parsed = z.array(cartLineSchema).safeParse(cart);
  if (!parsed.success || parsed.data.length === 0) {
    return { success: false, message: "Add at least one item with an amount" };
  }

  const items: QuickPurchaseLineInput[] = parsed.data.map((line) => ({
    category: line.category as EntryCategory,
    description: line.description,
    quantity: line.quantity ?? null,
    unit: line.unit ?? null,
    amount: line.amount,
  }));

  try {
    const actor = await getActorName();
    await createQuickPurchaseBatch(
      {
        date: new Date(`${dateRaw}T00:00:00.000Z`),
        vendor,
        paymentMethod: paymentMethod as "FUND_SOURCE" | "CREDIT",
        fundSourceAccountId,
        items,
      },
      actor,
    );
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to save purchases" };
  }

  revalidateAll();
  return { success: true, message: `Saved ${items.length} purchase${items.length === 1 ? "" : "s"}` };
}

const purchaseItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1),
  unit: z.string().optional(),
});

export async function savePurchaseItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = purchaseItemSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  try {
    await savePurchaseItem({
      id: data.id || null,
      name: data.name,
      category: data.category as EntryCategory,
      unit: data.unit || null,
    });
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to save item" };
  }

  revalidateAll();
  return { success: true, message: data.id ? "Item updated" : "Item added" };
}

export async function togglePurchaseItemActiveAction(id: string, isActive: boolean): Promise<void> {
  await setPurchaseItemActive(id, isActive);
  revalidateAll();
}

export async function deletePurchaseItemAction(id: string): Promise<void> {
  await deletePurchaseItem(id);
  revalidateAll();
}
