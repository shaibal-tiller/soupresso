import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient, AccountType, MenuCategory } from "../src/generated/prisma/client";

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CHART_OF_ACCOUNTS: {
  code: string;
  name: string;
  type: AccountType;
  isSystem?: boolean;
  isFundSource?: boolean;
  description?: string;
}[] = [
  // Assets
  {
    code: "1000",
    name: "Cash in Hand",
    type: "ASSET",
    isSystem: true,
    isFundSource: true,
    description: "Physical cash held by the shop",
  },
  {
    code: "1010",
    name: "Bank Account",
    type: "ASSET",
    isSystem: true,
    isFundSource: true,
    description: "Primary bank account",
  },
  { code: "1200", name: "Accounts Receivable", type: "ASSET", isSystem: true, description: "Money owed to the business (credit sales)" },
  { code: "1500", name: "Fixed Assets (Cart, Equipment & Furniture)", type: "ASSET", isSystem: true, description: "Cart, fridge, blender, grinder, bench and other long-lived equipment" },
  // Liabilities
  { code: "2000", name: "Accounts Payable", type: "LIABILITY", isSystem: true, description: "Money the business owes (unpaid purchases/expenses)" },
  { code: "2100", name: "Loans Payable", type: "LIABILITY", isSystem: true, description: "Loans taken by the business" },
  // Equity
  {
    code: "3999",
    name: "Balance Adjustments",
    type: "EQUITY",
    isSystem: true,
    description: "Opening balances and manual balance corrections for cash/bank accounts",
  },
  // Income
  { code: "4000", name: "Sales Income", type: "INCOME", isSystem: true, description: "Daily food sales" },
  { code: "4900", name: "Other Income", type: "INCOME", isSystem: true, description: "Any income outside regular food sales" },
  // Expenses
  { code: "5000", name: "Raw Material & Ingredients (COGS)", type: "EXPENSE", isSystem: true, description: "Vegetables, chicken, spices, sauces, mushroom cans, rolling sheets etc." },
  { code: "5100", name: "Packaging & Disposable Supplies", type: "EXPENSE", isSystem: true, description: "Parcel boxes, foil paper, polythene" },
  { code: "5200", name: "Chef Salary", type: "EXPENSE", isSystem: true },
  { code: "5300", name: "House Rent", type: "EXPENSE", isSystem: true, description: "Chef's house rent" },
  { code: "5400", name: "Utilities", type: "EXPENSE", isSystem: true },
  { code: "5500", name: "Cleaning & Maintenance", type: "EXPENSE", isSystem: true },
  { code: "5900", name: "Other Expense", type: "EXPENSE", isSystem: true },
];

const MENU_ITEMS: {
  name: string;
  price: number;
  parcelPrice?: number;
  category: MenuCategory;
  sortOrder: number;
}[] = [
  { name: "Soup", price: 60, parcelPrice: 70, category: "SOUP", sortOrder: 1 },
  { name: "Meat Box", price: 80, category: "MAIN", sortOrder: 2 },
  { name: "Wonton", price: 10, category: "SNACK", sortOrder: 3 },
  { name: "Taquitos Roll", price: 15, category: "SNACK", sortOrder: 4 },
  { name: "Spring Roll", price: 15, category: "SNACK", sortOrder: 5 },
  { name: "French Fries", price: 60, category: "SNACK", sortOrder: 6 },
];

const PARTNER_COUNT = 15;

async function main() {
  console.log("Seeding chart of accounts...");
  for (const account of CHART_OF_ACCOUNTS) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: { name: account.name, isFundSource: account.isFundSource ?? false, description: account.description },
      create: account,
    });
  }

  console.log("Seeding menu items...");
  for (const item of MENU_ITEMS) {
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.menuItem.create({ data: item });
    }
  }

  console.log("Seeding partners...");
  const existingPartnerCount = await prisma.partner.count();
  if (existingPartnerCount === 0) {
    const sharePercent = (100 / PARTNER_COUNT).toFixed(3);
    for (let i = 1; i <= PARTNER_COUNT; i++) {
      const code = `30${i.toString().padStart(2, "0")}`;
      const name = `Partner ${i}`;
      const equityAccount = await prisma.account.create({
        data: {
          code,
          name: `Owner's Equity - ${name}`,
          type: "EQUITY",
          isSystem: true,
          description: `Capital account for ${name}`,
        },
      });
      await prisma.partner.create({
        data: {
          name,
          sharePercent,
          equityAccountId: equityAccount.id,
        },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
