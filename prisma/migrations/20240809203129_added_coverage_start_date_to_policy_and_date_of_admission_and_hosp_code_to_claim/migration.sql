/*
  Warnings:

  - You are about to drop the column `userId` on the `Policy` table. All the data in the column will be lost.
  - You are about to drop the `ClaimCount` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `dateOfAdmission` to the `Claim` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hospCode` to the `Claim` table without a default value. This is not possible if the table is not empty.
  - Added the required column `coverageStartDate` to the `Policy` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "dateOfAdmission" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "hospCode" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Policy" DROP COLUMN "userId",
ADD COLUMN     "coverageStartDate" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "ClaimCount";
