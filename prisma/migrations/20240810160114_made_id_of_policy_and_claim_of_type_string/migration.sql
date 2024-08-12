/*
  Warnings:

  - The primary key for the `Claim` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Policy` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "Claim" DROP CONSTRAINT "Claim_policyId_fkey";

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_claimId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_claimId_fkey";

-- AlterTable
ALTER TABLE "Claim" DROP CONSTRAINT "Claim_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "policyId" SET DATA TYPE TEXT,
ADD CONSTRAINT "Claim_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Claim_id_seq";

-- AlterTable
ALTER TABLE "Document" ALTER COLUMN "claimId" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Policy" DROP CONSTRAINT "Policy_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Policy_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "claimId" SET DATA TYPE TEXT;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
