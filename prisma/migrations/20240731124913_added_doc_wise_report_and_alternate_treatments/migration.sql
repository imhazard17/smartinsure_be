/*
  Warnings:

  - You are about to drop the column `documentWiseSummary` on the `Report` table. All the data in the column will be lost.
  - Changed the type of `estimatedExpenses` on the `Report` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Report" DROP COLUMN "documentWiseSummary",
DROP COLUMN "estimatedExpenses",
ADD COLUMN     "estimatedExpenses" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "DocWiseReport" (
    "id" SERIAL NOT NULL,
    "text" JSONB NOT NULL,
    "reportId" INTEGER NOT NULL,

    CONSTRAINT "DocWiseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlternateTreatments" (
    "id" SERIAL NOT NULL,
    "text" JSONB NOT NULL,
    "reportId" INTEGER NOT NULL,

    CONSTRAINT "AlternateTreatments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocWiseReport_reportId_key" ON "DocWiseReport"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "AlternateTreatments_reportId_key" ON "AlternateTreatments"("reportId");

-- AddForeignKey
ALTER TABLE "DocWiseReport" ADD CONSTRAINT "DocWiseReport_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlternateTreatments" ADD CONSTRAINT "AlternateTreatments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
