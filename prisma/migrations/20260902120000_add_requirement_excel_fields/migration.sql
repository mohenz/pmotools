ALTER TABLE "requirements"
  ADD COLUMN "registrationDate" TIMESTAMP(3),
  ADD COLUMN "finalCheckNote" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "inspectionCriteria" TEXT NOT NULL DEFAULT '';
