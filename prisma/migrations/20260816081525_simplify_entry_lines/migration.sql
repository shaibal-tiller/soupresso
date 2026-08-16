/*
  Warnings:

  - You are about to drop the column `creditAccountId` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `debitAccountId` on the `Entry` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Entry" DROP CONSTRAINT "Entry_creditAccountId_fkey";

-- DropForeignKey
ALTER TABLE "Entry" DROP CONSTRAINT "Entry_debitAccountId_fkey";

-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "creditAccountId",
DROP COLUMN "debitAccountId";
