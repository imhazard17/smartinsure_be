-- CreateTable
CREATE TABLE "Hosp" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,

    CONSTRAINT "Hosp_pkey" PRIMARY KEY ("id")
);
