"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getLang, t } from "@/lib/i18n";
import type { ActionState } from "@/app/entries/actions";
import type { AccountType } from "@/generated/prisma/client";

function revalidateAll() {
  revalidatePath("/accounts");
  revalidatePath("/entries");
  revalidatePath("/reports");
  revalidatePath("/");
}

const accountSchema = z.object({
  id: z.string().optional(),
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1),
  description: z.string().optional(),
});

export async function saveAccountAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const lang = await getLang();
  const raw = Object.fromEntries(formData.entries());
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: t(lang, parsed.error.issues[0]?.message ?? "Invalid input") };
  }
  const data = parsed.data;

  try {
    if (data.id) {
      const existing = await prisma.account.findUniqueOrThrow({ where: { id: data.id } });
      if (existing.isSystem) {
        // System accounts keep their type/code fixed since the posting engine depends on them.
        await prisma.account.update({
          where: { id: data.id },
          data: { name: data.name, description: data.description || null },
        });
      } else {
        await prisma.account.update({
          where: { id: data.id },
          data: { code: data.code, name: data.name, type: data.type as AccountType, description: data.description || null },
        });
      }
    } else {
      await prisma.account.create({
        data: {
          code: data.code,
          name: data.name,
          type: data.type as AccountType,
          description: data.description || null,
        },
      });
    }
  } catch (error) {
    return { success: false, message: t(lang, error instanceof Error ? error.message : "Failed to save account") };
  }

  revalidateAll();
  return { success: true, message: t(lang, data.id ? "Account updated" : "Account created") };
}

export async function toggleAccountActiveAction(id: string, isActive: boolean): Promise<{ success: boolean; message: string }> {
  const lang = await getLang();
  const account = await prisma.account.findUniqueOrThrow({ where: { id } });
  if (account.isSystem && !isActive) {
    return { success: false, message: t(lang, "Core accounts used by the posting engine can't be deactivated.") };
  }
  await prisma.account.update({ where: { id }, data: { isActive } });
  revalidateAll();
  return { success: true, message: t(lang, isActive ? "Account activated" : "Account deactivated") };
}
