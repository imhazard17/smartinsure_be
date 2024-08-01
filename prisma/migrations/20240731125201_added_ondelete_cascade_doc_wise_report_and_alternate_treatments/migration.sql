-- DropForeignKey
ALTER TABLE "AlternateTreatments" DROP CONSTRAINT "AlternateTreatments_reportId_fkey";

-- DropForeignKey
ALTER TABLE "DocWiseReport" DROP CONSTRAINT "DocWiseReport_reportId_fkey";

-- AddForeignKey
ALTER TABLE "DocWiseReport" ADD CONSTRAINT "DocWiseReport_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlternateTreatments" ADD CONSTRAINT "AlternateTreatments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;
