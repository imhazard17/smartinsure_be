/*
  Warnings:

  - You are about to drop the column `url` on the `Document` table. All the data in the column will be lost.
  - Added the required column `originalName` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" DROP COLUMN "url",
ADD COLUMN     "originalName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "notes" DROP NOT NULL,
ALTER COLUMN "approved" DROP NOT NULL;
