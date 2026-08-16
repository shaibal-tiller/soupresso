"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createFundSource,
  renameFundSource,
  setFundSourceActive,
  setAccountBalance,
  transferBetweenFundSources,
} from "@/lib/ledger";
import { getActorName } from "@/lib/actor";
import type { ActionState } from "@/app/entries/actions";

function revalidateAll() {
  revalidatePath("/cash-bank");
  revalidatePath("/entries");
  revalidatePath("/daily-sales");
  revalidatePath("/reports");
  revalidatePath("/accounts");
  revalidatePath("/");
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  openingBalance: z.string().optional(),
  date: z.string().min(1),
});

export async function createFundSourceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  try {
    const actor = await getActorName();
    await createFundSource(
      {
        name: data.name,
        description: data.description || null,
        openingBalance: data.openingBalance ? Number(data.openingBalance) : 0,
        date: new Date(`${data.date}T00:00:00.000Z`),
      },
      actor,
    );
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to add account" };
  }

  revalidateAll();
  return { success: true, message: "Account added" };
}

const renameSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export async function renameFundSourceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = renameSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  try {
    const actor = await getActorName();
    await renameFundSource(data.accountId, data.name, data.description || null, actor);
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to update account" };
  }

  revalidateAll();
  return { success: true, message: "Account updated" };
}

export async function toggleFundSourceActiveAction(accountId: string, isActive: boolean): Promise<void> {
  const actor = await getActorName();
  await setFundSourceActive(accountId, isActive, actor);
  revalidateAll();
}

const balanceSchema = z.object({
  accountId: z.string().min(1),
  targetBalance: z.coerce.number(),
  date: z.string().min(1),
  description: z.string().optional(),
});

export async function setBalanceAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = balanceSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  try {
    const actor = await getActorName();
    await setAccountBalance(
      {
        accountId: data.accountId,
        targetBalance: data.targetBalance,
        date: new Date(`${data.date}T00:00:00.000Z`),
        description: data.description || null,
      },
      actor,
    );
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to adjust balance" };
  }

  revalidateAll();
  return { success: true, message: "Balance adjusted" };
}

const transferSchema = z.object({
  fromAccountId: z.string().min(1, "Choose a source account"),
  toAccountId: z.string().min(1, "Choose a destination account"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  date: z.string().min(1),
  description: z.string().optional(),
});

export async function transferAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  try {
    const actor = await getActorName();
    await transferBetweenFundSources(
      {
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        amount: data.amount,
        date: new Date(`${data.date}T00:00:00.000Z`),
        description: data.description || null,
      },
      actor,
    );
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "Failed to transfer" };
  }

  revalidateAll();
  return { success: true, message: "Transfer recorded" };
}
