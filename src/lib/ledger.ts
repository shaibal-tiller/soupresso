import { prisma } from "@/lib/db";
import { ACCOUNT_CODES } from "@/lib/accounts";
import { isPaymentMethodAllowed } from "@/lib/entry-meta";
import type { EntryCategory, PaymentMethod } from "@/generated/prisma/client";

const accountIdCache = new Map<string, string>();

async function getAccountId(code: string): Promise<string> {
  const cached = accountIdCache.get(code);
  if (cached) return cached;
  const account = await prisma.account.findUniqueOrThrow({ where: { code } });
  accountIdCache.set(code, account.id);
  return account.id;
}

function cashSideCode(paymentMethod: PaymentMethod, direction: "in" | "out"): string {
  if (paymentMethod === "CASH") return ACCOUNT_CODES.CASH;
  if (paymentMethod === "BANK") return ACCOUNT_CODES.BANK;
  if (paymentMethod === "CREDIT") {
    return direction === "in" ? ACCOUNT_CODES.RECEIVABLE : ACCOUNT_CODES.PAYABLE;
  }
  throw new Error(`Payment method ${paymentMethod} is not valid for this entry category`);
}

export interface CreateEntryInput {
  date: Date;
  category: EntryCategory;
  description: string;
  vendor?: string | null;
  quantity?: number | null;
  unit?: string | null;
  amount: number;
  paymentMethod: PaymentMethod;
  partnerId?: string | null;
  manualDebitAccountId?: string | null;
  manualCreditAccountId?: string | null;
}

export async function createEntry(input: CreateEntryInput) {
  const amount = input.amount;
  if (!(amount > 0)) throw new Error("Amount must be greater than zero");
  if (!isPaymentMethodAllowed(input.category, input.paymentMethod)) {
    throw new Error(`Payment method ${input.paymentMethod} is not valid for ${input.category}`);
  }

  let debitAccountId: string;
  let creditAccountId: string;

  switch (input.category) {
    case "INVESTMENT": {
      if (!input.partnerId) throw new Error("Partner is required for an investment entry");
      const partner = await prisma.partner.findUniqueOrThrow({ where: { id: input.partnerId } });
      debitAccountId = await getAccountId(cashSideCode(input.paymentMethod, "in"));
      creditAccountId = partner.equityAccountId;
      break;
    }
    case "WITHDRAWAL": {
      if (!input.partnerId) throw new Error("Partner is required for a withdrawal entry");
      const partner = await prisma.partner.findUniqueOrThrow({ where: { id: input.partnerId } });
      debitAccountId = partner.equityAccountId;
      creditAccountId = await getAccountId(cashSideCode(input.paymentMethod, "out"));
      break;
    }
    case "ASSET_PURCHASE":
      debitAccountId = await getAccountId(ACCOUNT_CODES.FIXED_ASSETS);
      creditAccountId = await getAccountId(cashSideCode(input.paymentMethod, "out"));
      break;
    case "RAW_MATERIAL":
      debitAccountId = await getAccountId(ACCOUNT_CODES.RAW_MATERIAL);
      creditAccountId = await getAccountId(cashSideCode(input.paymentMethod, "out"));
      break;
    case "PACKAGING_SUPPLIES":
      debitAccountId = await getAccountId(ACCOUNT_CODES.PACKAGING);
      creditAccountId = await getAccountId(cashSideCode(input.paymentMethod, "out"));
      break;
    case "CHEF_SALARY":
      debitAccountId = await getAccountId(ACCOUNT_CODES.CHEF_SALARY);
      creditAccountId = await getAccountId(cashSideCode(input.paymentMethod, "out"));
      break;
    case "RENT":
      debitAccountId = await getAccountId(ACCOUNT_CODES.RENT);
      creditAccountId = await getAccountId(cashSideCode(input.paymentMethod, "out"));
      break;
    case "UTILITY":
      debitAccountId = await getAccountId(ACCOUNT_CODES.UTILITY);
      creditAccountId = await getAccountId(cashSideCode(input.paymentMethod, "out"));
      break;
    case "CLEANING_MAINTENANCE":
      debitAccountId = await getAccountId(ACCOUNT_CODES.CLEANING);
      creditAccountId = await getAccountId(cashSideCode(input.paymentMethod, "out"));
      break;
    case "OTHER_EXPENSE":
      debitAccountId = await getAccountId(ACCOUNT_CODES.OTHER_EXPENSE);
      creditAccountId = await getAccountId(cashSideCode(input.paymentMethod, "out"));
      break;
    case "SALES":
      debitAccountId = await getAccountId(cashSideCode(input.paymentMethod, "in"));
      creditAccountId = await getAccountId(ACCOUNT_CODES.SALES_INCOME);
      break;
    case "LOAN_RECEIVED":
      debitAccountId = await getAccountId(cashSideCode(input.paymentMethod, "in"));
      creditAccountId = await getAccountId(ACCOUNT_CODES.LOANS_PAYABLE);
      break;
    case "LOAN_REPAYMENT":
      debitAccountId = await getAccountId(ACCOUNT_CODES.LOANS_PAYABLE);
      creditAccountId = await getAccountId(cashSideCode(input.paymentMethod, "out"));
      break;
    case "PAYABLE_SETTLEMENT":
      debitAccountId = await getAccountId(ACCOUNT_CODES.PAYABLE);
      creditAccountId = await getAccountId(cashSideCode(input.paymentMethod, "out"));
      break;
    case "RECEIVABLE_COLLECTION":
      debitAccountId = await getAccountId(cashSideCode(input.paymentMethod, "in"));
      creditAccountId = await getAccountId(ACCOUNT_CODES.RECEIVABLE);
      break;
    case "ADJUSTMENT":
      if (!input.manualDebitAccountId || !input.manualCreditAccountId) {
        throw new Error("Manual entries require both a debit and a credit account");
      }
      if (input.manualDebitAccountId === input.manualCreditAccountId) {
        throw new Error("Debit and credit accounts must be different");
      }
      debitAccountId = input.manualDebitAccountId;
      creditAccountId = input.manualCreditAccountId;
      break;
    default:
      throw new Error(`Unhandled category: ${input.category satisfies never}`);
  }

  return prisma.entry.create({
    data: {
      date: input.date,
      category: input.category,
      description: input.description,
      vendor: input.vendor ?? null,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      amount,
      paymentMethod: input.paymentMethod,
      partnerId: input.partnerId ?? null,
      journalLines: {
        create: [
          { accountId: debitAccountId, debit: amount, credit: 0 },
          { accountId: creditAccountId, debit: 0, credit: amount },
        ],
      },
    },
    include: { journalLines: { include: { account: true } } },
  });
}

export async function deleteEntry(entryId: string) {
  // JournalLine and DailySale rows cascade on delete via the FK.
  return prisma.entry.delete({ where: { id: entryId } });
}

export interface DailySaleItemInput {
  menuItemId: string;
  quantity: number;
  isParcel: boolean;
  unitPrice: number;
}

export interface CreateDailySaleInput {
  date: Date;
  cashAmount: number;
  bankAmount: number;
  notes?: string | null;
  items: DailySaleItemInput[];
}

export async function createDailySale(input: CreateDailySaleInput) {
  const cash = Math.max(0, input.cashAmount);
  const bank = Math.max(0, input.bankAmount);
  const total = cash + bank;
  if (!(total > 0)) throw new Error("Total sales must be greater than zero");

  const [cashAccountId, bankAccountId, salesAccountId] = await Promise.all([
    getAccountId(ACCOUNT_CODES.CASH),
    getAccountId(ACCOUNT_CODES.BANK),
    getAccountId(ACCOUNT_CODES.SALES_INCOME),
  ]);

  const lines: { accountId: string; debit: number; credit: number }[] = [];
  if (cash > 0) lines.push({ accountId: cashAccountId, debit: cash, credit: 0 });
  if (bank > 0) lines.push({ accountId: bankAccountId, debit: bank, credit: 0 });
  lines.push({ accountId: salesAccountId, debit: 0, credit: total });

  const paymentMethod: PaymentMethod = cash > 0 && bank > 0 ? "MIXED" : bank > 0 ? "BANK" : "CASH";
  const dateLabel = input.date.toISOString().slice(0, 10);

  return prisma.$transaction(async (tx) => {
    const entry = await tx.entry.create({
      data: {
        date: input.date,
        category: "SALES",
        description: `Daily sales close-out - ${dateLabel}`,
        amount: total,
        paymentMethod,
        journalLines: { create: lines },
      },
    });

    const dailySale = await tx.dailySale.create({
      data: {
        date: input.date,
        cashAmount: cash,
        bankAmount: bank,
        totalAmount: total,
        notes: input.notes ?? null,
        entryId: entry.id,
        items: {
          create: input.items.map((item) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            isParcel: item.isParcel,
            unitPrice: item.unitPrice,
            lineTotal: item.quantity * item.unitPrice,
          })),
        },
      },
      include: { items: { include: { menuItem: true } } },
    });

    return { entry, dailySale };
  });
}

export async function deleteDailySale(dailySaleId: string) {
  const dailySale = await prisma.dailySale.findUniqueOrThrow({ where: { id: dailySaleId } });
  // Deleting the Entry cascades to the DailySale and DailySaleItem rows.
  return prisma.entry.delete({ where: { id: dailySale.entryId } });
}
