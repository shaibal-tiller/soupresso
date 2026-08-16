"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createEntry, deleteEntry } from "@/lib/ledger";
import { getActorName } from "@/lib/actor";
import type { EntryCategory, PaymentMethod } from "@/generated/prisma/client";

export interface ActionState {
  success: boolean;
  message: string;
}

const entrySchema = z.object({
  date: z.string().min(1, "Date is required"),
  category: z.string().min(1),
  description: z.string().min(1, "Description is required"),
  vendor: z.string().optional(),
  quantity: z.string().optional(),
  unit: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paymentMethod: z.string().min(1),
  fundSourceAccountId: z.string().optional(),
  partnerId: z.string().optional(),
  manualDebitAccountId: z.string().optional(),
  manualCreditAccountId: z.string().optional(),
});

function revalidateAll() {
  revalidatePath("/entries");
  revalidatePath("/");
  revalidatePath("/reports");
  revalidatePath("/accounts");
  revalidatePath("/partners");
}

export async function createEntryAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = entrySchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  try {
    const actor = await getActorName();
    await createEntry(
      {
        date: new Date(`${data.date}T00:00:00.000Z`),
        category: data.category as EntryCategory,
        description: data.description,
        vendor: data.vendor || null,
        quantity: data.quantity ? Number(data.quantity) : null,
        unit: data.unit || null,
        amount: data.amount,
        paymentMethod: data.paymentMethod as PaymentMethod,
        fundSourceAccountId: data.fundSourceAccountId || null,
        partnerId: data.partnerId || null,
        manualDebitAccountId: data.manualDebitAccountId || null,
        manualCreditAccountId: data.manualCreditAccountId || null,
      },
      actor,
    );
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to create entry" };
  }

  revalidateAll();
  return { success: true, message: "Entry saved" };
}

export async function deleteEntryAction(id: string): Promise<void> {
  const actor = await getActorName();
  await deleteEntry(id, actor);
  revalidateAll();
}
