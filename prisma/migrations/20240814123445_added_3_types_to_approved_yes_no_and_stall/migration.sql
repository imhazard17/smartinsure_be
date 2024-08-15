/*
  Warnings:

  - You are about to drop the column `estimatedExpenses` on the `Report` table. All the data in the column will be lost.
  - The `approved` column on the `Report` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ApprovedType" AS ENUM ('YES', 'NO', 'STALL');

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "estimatedExpenses",
DROP COLUMN "approved",
ADD COLUMN     "approved" "ApprovedType" NOT NULL DEFAULT 'STALL';
