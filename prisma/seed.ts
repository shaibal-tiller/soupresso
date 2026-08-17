import "dotenv/config";
import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import ws from "ws";
import { PrismaClient, AccountType, MenuCategory, EntryCategory } from "../src/generated/prisma/client";

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
  { code: "5250", name: "Staff Food & Allowance", type: "EXPENSE", isSystem: true, description: "Meals and allowances for staff, separate from base salary" },
  { code: "5300", name: "House Rent", type: "EXPENSE", isSystem: true, description: "Chef's house rent" },
  { code: "5400", name: "Utilities", type: "EXPENSE", isSystem: true },
  { code: "5500", name: "Cleaning & Maintenance", type: "EXPENSE", isSystem: true },
  { code: "5900", name: "Other Expense", type: "EXPENSE", isSystem: true },
];

// Mobile banking wallets — not protected system accounts, so the user can freely
// rename, deactivate, or add more of these (e.g. a second bKash number) via the
// Cash & Bank page.
const MOBILE_MONEY_ACCOUNTS: { code: string; name: string; description?: string }[] = [
  { code: "1010", name: "bKash" },
  { code: "1020", name: "Rocket" },
  { code: "1030", name: "Nagad" },
];

const MENU_ITEMS: {
  name: string;
  price: number;
  parcelPrice?: number;
  category: MenuCategory;
  sortOrder: number;
}[] = [
  { name: "Soup", price: 60, parcelPrice: 70, category: "SOUP", sortOrder: 1 },
  { name: "Chicken Meat Box", price: 80, category: "MAIN", sortOrder: 2 },
  { name: "Momo", price: 15, category: "SNACK", sortOrder: 3 },
  { name: "Chicken Wonton", price: 10, category: "SNACK", sortOrder: 4 },
  { name: "Taquitos", price: 15, category: "SNACK", sortOrder: 5 },
  { name: "Spring Roll", price: 15, category: "SNACK", sortOrder: 6 },
  { name: "French Fries", price: 60, category: "SNACK", sortOrder: 7 },
  { name: "Nachos", price: 100, category: "SNACK", sortOrder: 8 },
];

// Common purchase items — tap-to-add shortlist for the Entries page, built
// from what the shop actually buys day to day.
const PURCHASE_ITEMS: { name: string; category: EntryCategory; unit: string; sortOrder: number }[] = [
  // Raw material / ingredients (raw spices, processed spices, vegetables, and
  // cooking essentials all post to the same Raw Material account — the finer
  // shopping groups shown in the Quick Purchase picker are inferred from the
  // item name in src/lib/purchase-group.ts, not stored separately).
  { name: "Chicken", category: "RAW_MATERIAL", unit: "kg", sortOrder: 1 },
  { name: "Onion", category: "RAW_MATERIAL", unit: "kg", sortOrder: 2 },
  { name: "Ginger", category: "RAW_MATERIAL", unit: "kg", sortOrder: 3 },
  { name: "Garlic", category: "RAW_MATERIAL", unit: "kg", sortOrder: 4 },
  { name: "Cooking Oil", category: "RAW_MATERIAL", unit: "litre", sortOrder: 5 },
  { name: "Egg", category: "RAW_MATERIAL", unit: "pc", sortOrder: 6 },
  { name: "Mushroom", category: "RAW_MATERIAL", unit: "kg", sortOrder: 7 },
  { name: "Green Chili", category: "RAW_MATERIAL", unit: "kg", sortOrder: 8 },
  { name: "Dried Chili", category: "RAW_MATERIAL", unit: "kg", sortOrder: 9 },
  { name: "Chili Powder", category: "RAW_MATERIAL", unit: "kg", sortOrder: 10 },
  { name: "Spices / Masala", category: "RAW_MATERIAL", unit: "kg", sortOrder: 11 },
  { name: "Salt", category: "RAW_MATERIAL", unit: "kg", sortOrder: 12 },
  { name: "Sugar", category: "RAW_MATERIAL", unit: "kg", sortOrder: 13 },
  { name: "Lemon", category: "RAW_MATERIAL", unit: "pc", sortOrder: 14 },
  { name: "Spring Onion", category: "RAW_MATERIAL", unit: "kg", sortOrder: 15 },
  { name: "Carrot", category: "RAW_MATERIAL", unit: "kg", sortOrder: 16 },
  { name: "Potato", category: "RAW_MATERIAL", unit: "kg", sortOrder: 17 },
  { name: "Eggplant", category: "RAW_MATERIAL", unit: "kg", sortOrder: 18 },
  { name: "Cheese", category: "RAW_MATERIAL", unit: "kg", sortOrder: 19 },
  { name: "Tortilla Chips", category: "RAW_MATERIAL", unit: "kg", sortOrder: 20 },
  { name: "Momo / Wonton Wrapper", category: "RAW_MATERIAL", unit: "pack", sortOrder: 21 },
  { name: "Cold Drink", category: "RAW_MATERIAL", unit: "pc", sortOrder: 22 },
  // Raw spices (new)
  { name: "Turmeric", category: "RAW_MATERIAL", unit: "kg", sortOrder: 30 },
  { name: "Cumin", category: "RAW_MATERIAL", unit: "kg", sortOrder: 31 },
  { name: "Coriander Seed", category: "RAW_MATERIAL", unit: "kg", sortOrder: 32 },
  { name: "Bay Leaf", category: "RAW_MATERIAL", unit: "pack", sortOrder: 33 },
  { name: "Cardamom", category: "RAW_MATERIAL", unit: "kg", sortOrder: 34 },
  { name: "Cinnamon", category: "RAW_MATERIAL", unit: "kg", sortOrder: 35 },
  // Processed spices & sauces (new)
  { name: "Ginger-Garlic Paste", category: "RAW_MATERIAL", unit: "kg", sortOrder: 36 },
  { name: "Soy Sauce", category: "RAW_MATERIAL", unit: "litre", sortOrder: 37 },
  { name: "Chili Sauce", category: "RAW_MATERIAL", unit: "litre", sortOrder: 38 },
  { name: "Vinegar", category: "RAW_MATERIAL", unit: "litre", sortOrder: 39 },
  { name: "Curry Powder", category: "RAW_MATERIAL", unit: "kg", sortOrder: 40 },
  // Vegetables (new)
  { name: "Cabbage", category: "RAW_MATERIAL", unit: "kg", sortOrder: 41 },
  { name: "Capsicum", category: "RAW_MATERIAL", unit: "kg", sortOrder: 42 },
  { name: "Tomato", category: "RAW_MATERIAL", unit: "kg", sortOrder: 43 },
  { name: "Cucumber", category: "RAW_MATERIAL", unit: "kg", sortOrder: 44 },
  // Cooking essentials (new)
  { name: "Milk", category: "RAW_MATERIAL", unit: "litre", sortOrder: 45 },
  { name: "Butter", category: "RAW_MATERIAL", unit: "kg", sortOrder: 46 },
  { name: "Rice", category: "RAW_MATERIAL", unit: "kg", sortOrder: 47 },
  { name: "Flour / Maida", category: "RAW_MATERIAL", unit: "kg", sortOrder: 48 },
  // Packaging & supplies
  { name: "Soup Bowl", category: "PACKAGING_SUPPLIES", unit: "pc", sortOrder: 50 },
  { name: "Parcel Box", category: "PACKAGING_SUPPLIES", unit: "pc", sortOrder: 51 },
  { name: "Nachos Tray", category: "PACKAGING_SUPPLIES", unit: "pc", sortOrder: 52 },
  { name: "Poly Bag", category: "PACKAGING_SUPPLIES", unit: "pack", sortOrder: 53 },
  { name: "Foil Paper", category: "PACKAGING_SUPPLIES", unit: "roll", sortOrder: 54 },
  { name: "Plate & Spoon", category: "PACKAGING_SUPPLIES", unit: "pack", sortOrder: 55 },
  { name: "Napkin / Tissue", category: "PACKAGING_SUPPLIES", unit: "pack", sortOrder: 56 },
  // Cooking wares & kitchen equipment (new — posts to Fixed Assets)
  { name: "Karai / Wok", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 60 },
  { name: "Frying Pan", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 61 },
  { name: "Cooking Pot (Dekchi)", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 62 },
  { name: "Gas Cylinder", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 63 },
  { name: "Gas Stove / Burner", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 64 },
  { name: "Knife", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 65 },
  { name: "Cutting Board", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 66 },
  { name: "Serving Plate", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 67 },
  { name: "Ladle / Spatula", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 68 },
  // Furniture (new — posts to Fixed Assets)
  { name: "Chair", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 70 },
  { name: "Table", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 71 },
  { name: "Mora (Stool)", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 72 },
  { name: "Moi (Ladder)", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 73 },
  { name: "Shelf / Rack", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 74 },
  // Electronics & appliances (new — posts to Fixed Assets)
  { name: "Fridge", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 80 },
  { name: "Light / Bulb", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 81 },
  { name: "Camera (CCTV)", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 82 },
  { name: "Router", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 83 },
  { name: "Blender", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 84 },
  { name: "Grinder", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 85 },
  { name: "Beater", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 86 },
  { name: "Mixer", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 87 },
  { name: "Fan", category: "ASSET_PURCHASE", unit: "pc", sortOrder: 88 },
  // Cleaning & maintenance (new)
  { name: "Detergent", category: "CLEANING_MAINTENANCE", unit: "pack", sortOrder: 90 },
  { name: "Dish Soap", category: "CLEANING_MAINTENANCE", unit: "litre", sortOrder: 91 },
  { name: "Sponge / Scrubber", category: "CLEANING_MAINTENANCE", unit: "pack", sortOrder: 92 },
  { name: "Broom", category: "CLEANING_MAINTENANCE", unit: "pc", sortOrder: 93 },
  { name: "Trash Bags", category: "CLEANING_MAINTENANCE", unit: "pack", sortOrder: 94 },
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

  console.log("Seeding mobile money accounts...");
  for (const account of MOBILE_MONEY_ACCOUNTS) {
    await prisma.account.upsert({
      where: { code: account.code },
      update: {},
      create: {
        code: account.code,
        name: account.name,
        type: "ASSET",
        isSystem: false,
        isFundSource: true,
        description: account.description,
      },
    });
  }

  console.log("Seeding menu items...");
  for (const item of MENU_ITEMS) {
    const existing = await prisma.menuItem.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.menuItem.create({ data: item });
    }
  }

  console.log("Seeding purchase items...");
  for (const item of PURCHASE_ITEMS) {
    const existing = await prisma.purchaseItem.findFirst({ where: { name: item.name } });
    if (!existing) {
      await prisma.purchaseItem.create({ data: item });
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
