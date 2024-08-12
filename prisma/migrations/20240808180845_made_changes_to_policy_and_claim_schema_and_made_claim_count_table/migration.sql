/*
  Warnings:

  - You are about to drop the column `desc` on the `Policy` table. All the data in the column will be lost.
  - You are about to drop the column `hospCity` on the `Policy` table. All the data in the column will be lost.
  - You are about to drop the column `hospName` on the `Policy` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[policyNumber]` on the table `Policy` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hospCity` to the `Claim` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hospName` to the `Claim` table without a default value. This is not possible if the table is not empty.
  - Added the required column `patientDob` to the `Policy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `patientName` to the `Policy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `policyNumber` to the `Policy` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Policy" DROP CONSTRAINT "Policy_userId_fkey";

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "hospCity" TEXT NOT NULL,
ADD COLUMN     "hospName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Policy" DROP COLUMN "desc",
DROP COLUMN "hospCity",
DROP COLUMN "hospName",
ADD COLUMN     "emails" TEXT[],
ADD COLUMN     "patientDob" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "patientName" TEXT NOT NULL,
ADD COLUMN     "policyNumber" INTEGER NOT NULL,
ALTER COLUMN "id" DROP DEFAULT;
DROP SEQUENCE "Policy_id_seq";

-- CreateTable
CREATE TABLE "ClaimCount" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "totalClaims" INTEGER NOT NULL,

    CONSTRAINT "ClaimCount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Policy_policyNumber_key" ON "Policy"("policyNumber");
