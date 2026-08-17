"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getLang, t } from "@/lib/i18n";
import type { ActionState } from "@/app/entries/actions";

function revalidateAll() {
  revalidatePath("/partners");
  revalidatePath("/entries");
  revalidatePath("/reports");
  revalidatePath("/accounts");
  revalidatePath("/");
}

const partnerSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  sharePercent: z.string().optional(),
});

export async function savePartnerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const lang = await getLang();
  const raw = Object.fromEntries(formData.entries());
  const parsed = partnerSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, message: t(lang, parsed.error.issues[0]?.message ?? "Invalid input") };
  }
  const data = parsed.data;
  const sharePercent = data.sharePercent ? Number(data.sharePercent) : null;

  try {
    if (data.id) {
      await prisma.partner.update({
        where: { id: data.id },
        data: { name: data.name, phone: data.phone || null, sharePercent },
      });
      const partner = await prisma.partner.findUniqueOrThrow({ where: { id: data.id } });
      await prisma.account.update({
        where: { id: partner.equityAccountId },
        data: { name: `Owner's Equity - ${data.name}` },
      });
    } else {
      const lastAccount = await prisma.account.findFirst({
        where: { code: { startsWith: "30" } },
        orderBy: { code: "desc" },
      });
      const nextNumber = lastAccount ? Number(lastAccount.code) + 1 : 3001;
      const equityAccount = await prisma.account.create({
        data: {
          code: String(nextNumber),
          name: `Owner's Equity - ${data.name}`,
          type: "EQUITY",
          isSystem: true,
          description: `Capital account for ${data.name}`,
        },
      });
      await prisma.partner.create({
        data: { name: data.name, phone: data.phone || null, sharePercent, equityAccountId: equityAccount.id },
      });
    }
  } catch (error) {
    return { success: false, message: t(lang, error instanceof Error ? error.message : "Failed to save partner") };
  }

  revalidateAll();
  return { success: true, message: t(lang, data.id ? "Partner updated" : "Partner added") };
}

export async function togglePartnerActiveAction(id: string, isActive: boolean): Promise<void> {
  await prisma.partner.update({ where: { id }, data: { isActive } });
  revalidateAll();
}
