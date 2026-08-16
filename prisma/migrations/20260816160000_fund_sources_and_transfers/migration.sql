-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EntryCategory" ADD VALUE 'BALANCE_ADJUSTMENT';
ALTER TYPE "EntryCategory" ADD VALUE 'TRANSFER';

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('FUND_SOURCE', 'CREDIT', 'MIXED');
ALTER TABLE "Entry" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING ("paymentMethod"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "isFundSource" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "DailySale" DROP COLUMN "bankAmount",
DROP COLUMN "cashAmount";

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "fundSourceAccountId" TEXT,
ADD COLUMN     "transferToAccountId" TEXT;

-- CreateTable
CREATE TABLE "DailySaleFunding" (
    "id" TEXT NOT NULL,
    "dailySaleId" TEXT NOT NULL,
    "fundSourceAccountId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "DailySaleFunding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailySaleFunding_dailySaleId_idx" ON "DailySaleFunding"("dailySaleId");

-- CreateIndex
CREATE INDEX "DailySaleFunding_fundSourceAccountId_idx" ON "DailySaleFunding"("fundSourceAccountId");

-- CreateIndex
CREATE INDEX "Account_isFundSource_idx" ON "Account"("isFundSource");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_fundSourceAccountId_fkey" FOREIGN KEY ("fundSourceAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_transferToAccountId_fkey" FOREIGN KEY ("transferToAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySaleFunding" ADD CONSTRAINT "DailySaleFunding_dailySaleId_fkey" FOREIGN KEY ("dailySaleId") REFERENCES "DailySale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySaleFunding" ADD CONSTRAINT "DailySaleFunding_fundSourceAccountId_fkey" FOREIGN KEY ("fundSourceAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

