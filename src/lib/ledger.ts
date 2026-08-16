import { prisma } from "@/lib/db";
import { ACCOUNT_CODES } from "@/lib/accounts";
import { isPaymentMethodAllowed, CATEGORY_LABELS } from "@/lib/entry-meta";
import { formatTaka } from "@/lib/format";
import type { AccountType, EntryCategory, PaymentMethod, Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

const accountIdCache = new Map<string, string>();

async function getAccountId(code: string): Promise<string> {
  const cached = accountIdCache.get(code);
  if (cached) return cached;
  const account = await prisma.account.findUniqueOrThrow({ where: { code } });
  accountIdCache.set(code, account.id);
  return account.id;
}

function toNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : value.toNumber();
}

function normalBalance(type: AccountType, debit: number, credit: number): number {
  if (type === "ASSET" || type === "EXPENSE") return debit - credit;
  return credit - debit;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

// ---------------------------------------------------------------------------
// Audit log — every mutating function below writes one of these, in the same
// transaction as the change it describes, so the trail can never drift from
// the data (and survives even if the underlying record is later deleted).
// ---------------------------------------------------------------------------

interface AuditInput {
  actor: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string;
  entityId: string;
  summary: string;
  amount?: number | null;
  detail?: unknown;
}

async function logAudit(tx: Tx, input: AuditInput) {
  await tx.auditLog.create({
    data: {
      actor: input.actor || "Unknown",
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      amount: input.amount ?? null,
      detail: input.detail === undefined ? undefined : (JSON.parse(JSON.stringify(input.detail)) as Prisma.InputJsonValue),
    },
  });
}

function entrySnapshot(entry: {
  date: Date;
  category: string;
  description: string;
  vendor: string | null;
  amount: Prisma.Decimal | number;
  paymentMethod: string;
}) {
  return {
    date: entry.date.toISOString().slice(0, 10),
    category: entry.category,
    description: entry.description,
    vendor: entry.vendor,
    amount: toNumber(entry.amount),
    paymentMethod: entry.paymentMethod,
  };
}

/** Resolves the "other side" of an entry: either the chosen fund source account, or Payable/Receivable when paid on credit. */
async function resolveFundOrCreditAccountId(
  paymentMethod: PaymentMethod,
  fundSourceAccountId: string | null | undefined,
  direction: "in" | "out",
): Promise<string> {
  if (paymentMethod === "CREDIT") {
    return getAccountId(direction === "in" ? ACCOUNT_CODES.RECEIVABLE : ACCOUNT_CODES.PAYABLE);
  }
  if (paymentMethod === "FUND_SOURCE") {
    if (!fundSourceAccountId) throw new Error("Choose which cash/bank account this uses");
    const account = await prisma.account.findUnique({ where: { id: fundSourceAccountId } });
    if (!account || !account.isFundSource || !account.isActive) {
      throw new Error("Choose a valid, active cash/bank account");
    }
    return account.id;
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
  fundSourceAccountId?: string | null;
  partnerId?: string | null;
  manualDebitAccountId?: string | null;
  manualCreditAccountId?: string | null;
}

export async function createEntry(input: CreateEntryInput, actor: string) {
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
      debitAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "in");
      creditAccountId = partner.equityAccountId;
      break;
    }
    case "WITHDRAWAL": {
      if (!input.partnerId) throw new Error("Partner is required for a withdrawal entry");
      const partner = await prisma.partner.findUniqueOrThrow({ where: { id: input.partnerId } });
      debitAccountId = partner.equityAccountId;
      creditAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "out");
      break;
    }
    case "ASSET_PURCHASE":
      debitAccountId = await getAccountId(ACCOUNT_CODES.FIXED_ASSETS);
      creditAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "out");
      break;
    case "RAW_MATERIAL":
      debitAccountId = await getAccountId(ACCOUNT_CODES.RAW_MATERIAL);
      creditAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "out");
      break;
    case "PACKAGING_SUPPLIES":
      debitAccountId = await getAccountId(ACCOUNT_CODES.PACKAGING);
      creditAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "out");
      break;
    case "CHEF_SALARY":
      debitAccountId = await getAccountId(ACCOUNT_CODES.CHEF_SALARY);
      creditAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "out");
      break;
    case "RENT":
      debitAccountId = await getAccountId(ACCOUNT_CODES.RENT);
      creditAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "out");
      break;
    case "UTILITY":
      debitAccountId = await getAccountId(ACCOUNT_CODES.UTILITY);
      creditAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "out");
      break;
    case "CLEANING_MAINTENANCE":
      debitAccountId = await getAccountId(ACCOUNT_CODES.CLEANING);
      creditAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "out");
      break;
    case "OTHER_EXPENSE":
      debitAccountId = await getAccountId(ACCOUNT_CODES.OTHER_EXPENSE);
      creditAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "out");
      break;
    case "SALES":
      debitAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "in");
      creditAccountId = await getAccountId(ACCOUNT_CODES.SALES_INCOME);
      break;
    case "LOAN_RECEIVED":
      debitAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "in");
      creditAccountId = await getAccountId(ACCOUNT_CODES.LOANS_PAYABLE);
      break;
    case "LOAN_REPAYMENT":
      debitAccountId = await getAccountId(ACCOUNT_CODES.LOANS_PAYABLE);
      creditAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "out");
      break;
    case "PAYABLE_SETTLEMENT":
      debitAccountId = await getAccountId(ACCOUNT_CODES.PAYABLE);
      creditAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "out");
      break;
    case "RECEIVABLE_COLLECTION":
      debitAccountId = await resolveFundOrCreditAccountId(input.paymentMethod, input.fundSourceAccountId, "in");
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
    case "BALANCE_ADJUSTMENT":
    case "TRANSFER":
      throw new Error(`${input.category} entries must be created via their dedicated functions`);
    default:
      throw new Error(`Unhandled category: ${input.category satisfies never}`);
  }

  return prisma.$transaction(async (tx) => {
    const entry = await tx.entry.create({
      data: {
        date: input.date,
        category: input.category,
        description: input.description,
        vendor: input.vendor ?? null,
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        amount,
        paymentMethod: input.paymentMethod,
        fundSourceAccountId: input.paymentMethod === "FUND_SOURCE" ? input.fundSourceAccountId : null,
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

    await logAudit(tx, {
      actor,
      action: "CREATE",
      entityType: "Entry",
      entityId: entry.id,
      summary: `${CATEGORY_LABELS[entry.category] ?? entry.category} ${formatTaka(amount)} — ${entry.description}`,
      amount,
      detail: entrySnapshot(entry),
    });

    return entry;
  });
}

export async function deleteEntry(entryId: string, actor: string) {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.entry.findUniqueOrThrow({
      where: { id: entryId },
      include: { journalLines: { include: { account: true } }, partner: true },
    });

    await logAudit(tx, {
      actor,
      action: "DELETE",
      entityType: "Entry",
      entityId: entry.id,
      summary: `Deleted: ${CATEGORY_LABELS[entry.category] ?? entry.category} ${formatTaka(toNumber(entry.amount))} — ${entry.description}`,
      amount: toNumber(entry.amount),
      detail: {
        ...entrySnapshot(entry),
        partnerName: entry.partner?.name ?? null,
        lines: entry.journalLines.map((l) => ({
          account: l.account.name,
          debit: toNumber(l.debit),
          credit: toNumber(l.credit),
        })),
      },
    });

    // JournalLine and DailySale rows cascade on delete via the FK.
    await tx.entry.delete({ where: { id: entryId } });
    return entry;
  });
}

// ---------------------------------------------------------------------------
// Cash & Bank: fund source accounts, opening/adjusted balances, transfers
// ---------------------------------------------------------------------------

export interface CreateFundSourceInput {
  name: string;
  description?: string | null;
  openingBalance?: number | null;
  date: Date;
}

export async function createFundSource(input: CreateFundSourceInput, actor: string) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  const lastAccount = await prisma.account.findFirst({
    where: { code: { startsWith: "10" } },
    orderBy: { code: "desc" },
  });
  const nextNumber = lastAccount ? Number(lastAccount.code) + 1 : 1020;

  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.account.create({
      data: {
        code: String(nextNumber),
        name,
        type: "ASSET",
        isSystem: false,
        isFundSource: true,
        description: input.description || null,
      },
    });
    await logAudit(tx, {
      actor,
      action: "CREATE",
      entityType: "Account",
      entityId: created.id,
      summary: `Added cash/bank account: ${created.name}`,
      detail: { code: created.code, name: created.name },
    });
    return created;
  });

  const openingBalance = input.openingBalance ?? 0;
  if (openingBalance !== 0) {
    await setAccountBalance(
      {
        accountId: account.id,
        targetBalance: openingBalance,
        date: input.date,
        description: `Opening balance - ${name}`,
      },
      actor,
    );
  }

  return account;
}

export async function renameFundSource(accountId: string, name: string, description: string | null, actor: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required");

  return prisma.$transaction(async (tx) => {
    const before = await tx.account.findUniqueOrThrow({ where: { id: accountId } });
    const updated = await tx.account.update({ where: { id: accountId }, data: { name: trimmed, description } });
    await logAudit(tx, {
      actor,
      action: "UPDATE",
      entityType: "Account",
      entityId: accountId,
      summary: before.name === trimmed ? `Updated account: ${trimmed}` : `Renamed account: ${before.name} → ${trimmed}`,
      detail: { before: { name: before.name, description: before.description }, after: { name: trimmed, description } },
    });
    return updated;
  });
}

export async function setFundSourceActive(accountId: string, isActive: boolean, actor: string) {
  return prisma.$transaction(async (tx) => {
    const updated = await tx.account.update({ where: { id: accountId }, data: { isActive } });
    await logAudit(tx, {
      actor,
      action: "UPDATE",
      entityType: "Account",
      entityId: accountId,
      summary: `${isActive ? "Activated" : "Deactivated"} account: ${updated.name}`,
      detail: { isActive },
    });
    return updated;
  });
}

export interface SetAccountBalanceInput {
  accountId: string;
  targetBalance: number;
  date: Date;
  description?: string | null;
}

/** Posts a correction so the account's ledger balance matches `targetBalance` (used for opening balances and cash-count corrections). */
export async function setAccountBalance(input: SetAccountBalanceInput, actor: string) {
  const account = await prisma.account.findUniqueOrThrow({ where: { id: input.accountId } });

  const sum = await prisma.journalLine.aggregate({
    where: { accountId: account.id },
    _sum: { debit: true, credit: true },
  });
  const currentBalance = normalBalance(account.type, toNumber(sum._sum.debit), toNumber(sum._sum.credit));
  const delta = round2(input.targetBalance - currentBalance);
  if (delta === 0) throw new Error("That account's balance is already correct — no adjustment needed");

  const balanceAdjustmentsAccountId = await getAccountId(ACCOUNT_CODES.BALANCE_ADJUSTMENTS);
  const amount = Math.abs(delta);
  const accountIsDebitNormal = account.type === "ASSET" || account.type === "EXPENSE";
  const increasing = delta > 0;

  let debitAccountId: string;
  let creditAccountId: string;
  if (accountIsDebitNormal === increasing) {
    debitAccountId = account.id;
    creditAccountId = balanceAdjustmentsAccountId;
  } else {
    debitAccountId = balanceAdjustmentsAccountId;
    creditAccountId = account.id;
  }

  return prisma.$transaction(async (tx) => {
    const entry = await tx.entry.create({
      data: {
        date: input.date,
        category: "BALANCE_ADJUSTMENT",
        description: input.description || `Balance adjustment - ${account.name}`,
        amount,
        paymentMethod: "FUND_SOURCE",
        fundSourceAccountId: account.id,
        journalLines: {
          create: [
            { accountId: debitAccountId, debit: amount, credit: 0 },
            { accountId: creditAccountId, debit: 0, credit: amount },
          ],
        },
      },
      include: { journalLines: { include: { account: true } } },
    });

    await logAudit(tx, {
      actor,
      action: "CREATE",
      entityType: "Entry",
      entityId: entry.id,
      summary: `Balance adjustment: ${account.name} ${increasing ? "+" : "-"}${formatTaka(amount)} (now ${formatTaka(input.targetBalance)})`,
      amount,
      detail: { ...entrySnapshot(entry), accountName: account.name, newBalance: input.targetBalance },
    });

    return entry;
  });
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: Date;
  description?: string | null;
}

export async function transferBetweenFundSources(input: TransferInput, actor: string) {
  if (!(input.amount > 0)) throw new Error("Amount must be greater than zero");
  if (input.fromAccountId === input.toAccountId) throw new Error("Choose two different accounts to transfer between");

  const [fromAccount, toAccount] = await Promise.all([
    prisma.account.findUniqueOrThrow({ where: { id: input.fromAccountId } }),
    prisma.account.findUniqueOrThrow({ where: { id: input.toAccountId } }),
  ]);
  if (!fromAccount.isFundSource || !toAccount.isFundSource) {
    throw new Error("Both accounts must be cash/bank accounts");
  }

  return prisma.$transaction(async (tx) => {
    const entry = await tx.entry.create({
      data: {
        date: input.date,
        category: "TRANSFER",
        description: input.description || `Transfer: ${fromAccount.name} → ${toAccount.name}`,
        amount: input.amount,
        paymentMethod: "FUND_SOURCE",
        fundSourceAccountId: fromAccount.id,
        transferToAccountId: toAccount.id,
        journalLines: {
          create: [
            { accountId: toAccount.id, debit: input.amount, credit: 0 },
            { accountId: fromAccount.id, debit: 0, credit: input.amount },
          ],
        },
      },
      include: { journalLines: { include: { account: true } } },
    });

    await logAudit(tx, {
      actor,
      action: "CREATE",
      entityType: "Entry",
      entityId: entry.id,
      summary: `Transfer ${formatTaka(input.amount)}: ${fromAccount.name} → ${toAccount.name}`,
      amount: input.amount,
      detail: { ...entrySnapshot(entry), from: fromAccount.name, to: toAccount.name },
    });

    return entry;
  });
}

// ---------------------------------------------------------------------------
// Daily sales (end-of-day close-out, plus live per-order entry)
// ---------------------------------------------------------------------------

export interface DailySaleItemInput {
  menuItemId: string;
  quantity: number;
  isParcel: boolean;
  unitPrice: number;
}

export interface DailySaleFundingInput {
  fundSourceAccountId: string;
  amount: number;
}

export interface CreateDailySaleInput {
  date: Date;
  fundings: DailySaleFundingInput[];
  notes?: string | null;
  items: DailySaleItemInput[];
}

export async function createDailySale(input: CreateDailySaleInput, actor: string) {
  const fundings = input.fundings.filter((f) => f.amount > 0);
  const total = round2(fundings.reduce((sum, f) => sum + f.amount, 0));
  if (!(total > 0)) throw new Error("Enter at least one cash/bank amount greater than zero");

  const salesAccountId = await getAccountId(ACCOUNT_CODES.SALES_INCOME);

  const lines: { accountId: string; debit: number; credit: number }[] = fundings.map((f) => ({
    accountId: f.fundSourceAccountId,
    debit: f.amount,
    credit: 0,
  }));
  lines.push({ accountId: salesAccountId, debit: 0, credit: total });

  const paymentMethod: PaymentMethod = fundings.length > 1 ? "MIXED" : "FUND_SOURCE";
  const dateLabel = input.date.toISOString().slice(0, 10);

  return prisma.$transaction(async (tx) => {
    const entry = await tx.entry.create({
      data: {
        date: input.date,
        category: "SALES",
        description: `Daily sales close-out - ${dateLabel}`,
        amount: total,
        paymentMethod,
        fundSourceAccountId: fundings.length === 1 ? fundings[0].fundSourceAccountId : null,
        journalLines: { create: lines },
      },
    });

    const dailySale = await tx.dailySale.create({
      data: {
        date: input.date,
        totalAmount: total,
        notes: input.notes ?? null,
        entryId: entry.id,
        fundings: {
          create: fundings.map((f) => ({ fundSourceAccountId: f.fundSourceAccountId, amount: f.amount })),
        },
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
      include: { items: { include: { menuItem: true } }, fundings: { include: { fundSourceAccount: true } } },
    });

    await logAudit(tx, {
      actor,
      action: "CREATE",
      entityType: "DailySale",
      entityId: dailySale.id,
      summary: `Daily sales recorded for ${dateLabel}: ${formatTaka(total)} (${input.items.length} item lines)`,
      amount: total,
      detail: { date: dateLabel, total, items: input.items.length, fundings: fundings.length },
    });

    return { entry, dailySale };
  });
}

export async function deleteDailySale(dailySaleId: string, actor: string) {
  return prisma.$transaction(async (tx) => {
    const dailySale = await tx.dailySale.findUniqueOrThrow({ where: { id: dailySaleId } });
    const dateLabel = dailySale.date.toISOString().slice(0, 10);

    await logAudit(tx, {
      actor,
      action: "DELETE",
      entityType: "DailySale",
      entityId: dailySale.id,
      summary: `Deleted daily sales record for ${dateLabel}: ${formatTaka(toNumber(dailySale.totalAmount))}`,
      amount: toNumber(dailySale.totalAmount),
      detail: { date: dateLabel, total: toNumber(dailySale.totalAmount) },
    });

    // Deleting the Entry cascades to the DailySale, DailySaleFunding and DailySaleItem rows.
    await tx.entry.delete({ where: { id: dailySale.entryId } });
    return dailySale;
  });
}

/**
 * Records a single customer order as it happens, appending to (or creating)
 * that day's DailySale so the till stays live throughout the day instead of
 * only being closed out once at the end.
 */
export interface QuickSaleInput {
  date: Date;
  fundSourceAccountId: string;
  items: DailySaleItemInput[];
}

export async function addQuickSale(input: QuickSaleInput, actor: string) {
  if (input.items.length === 0) throw new Error("Add at least one item");
  const amount = round2(input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  if (!(amount > 0)) throw new Error("Order total must be greater than zero");

  const fundSource = await prisma.account.findUnique({ where: { id: input.fundSourceAccountId } });
  if (!fundSource || !fundSource.isFundSource || !fundSource.isActive) {
    throw new Error("Choose a valid, active cash/bank account");
  }
  const salesAccountId = await getAccountId(ACCOUNT_CODES.SALES_INCOME);
  const dateLabel = input.date.toISOString().slice(0, 10);

  return prisma.$transaction(async (tx) => {
    let dailySale = await tx.dailySale.findUnique({ where: { date: input.date } });
    let isNewDay = false;

    if (!dailySale) {
      isNewDay = true;
      const entry = await tx.entry.create({
        data: {
          date: input.date,
          category: "SALES",
          description: `Daily sales close-out - ${dateLabel}`,
          amount,
          paymentMethod: "FUND_SOURCE",
          fundSourceAccountId: fundSource.id,
          journalLines: {
            create: [
              { accountId: fundSource.id, debit: amount, credit: 0 },
              { accountId: salesAccountId, debit: 0, credit: amount },
            ],
          },
        },
      });
      dailySale = await tx.dailySale.create({
        data: {
          date: input.date,
          totalAmount: amount,
          entryId: entry.id,
          fundings: { create: [{ fundSourceAccountId: fundSource.id, amount }] },
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
      });
    } else {
      await tx.journalLine.createMany({
        data: [
          { entryId: dailySale.entryId, accountId: fundSource.id, debit: amount, credit: 0 },
          { entryId: dailySale.entryId, accountId: salesAccountId, debit: 0, credit: amount },
        ],
      });
      await tx.entry.update({ where: { id: dailySale.entryId }, data: { amount: { increment: amount } } });

      const existingFunding = await tx.dailySaleFunding.findFirst({
        where: { dailySaleId: dailySale.id, fundSourceAccountId: fundSource.id },
      });
      if (existingFunding) {
        await tx.dailySaleFunding.update({ where: { id: existingFunding.id }, data: { amount: { increment: amount } } });
      } else {
        await tx.dailySaleFunding.create({ data: { dailySaleId: dailySale.id, fundSourceAccountId: fundSource.id, amount } });
      }

      await tx.dailySaleItem.createMany({
        data: input.items.map((item) => ({
          dailySaleId: dailySale!.id,
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          isParcel: item.isParcel,
          unitPrice: item.unitPrice,
          lineTotal: item.quantity * item.unitPrice,
        })),
      });

      dailySale = await tx.dailySale.update({ where: { id: dailySale.id }, data: { totalAmount: { increment: amount } } });
    }

    await logAudit(tx, {
      actor,
      action: isNewDay ? "CREATE" : "UPDATE",
      entityType: "DailySale",
      entityId: dailySale.id,
      summary: `Order recorded: ${formatTaka(amount)} via ${fundSource.name} (${input.items.length} item${input.items.length === 1 ? "" : "s"})`,
      amount,
      detail: {
        date: dateLabel,
        fundSource: fundSource.name,
        items: input.items.length,
        orderTotal: amount,
        dayTotal: toNumber(dailySale.totalAmount),
      },
    });

    return dailySale;
  });
}
