ALTER TABLE "requirements"
ADD COLUMN "businessMajorCategory" TEXT NOT NULL DEFAULT '',
ADD COLUMN "businessMiddleCategory" TEXT NOT NULL DEFAULT '',
ADD COLUMN "businessMinorCategory" TEXT NOT NULL DEFAULT '',
ADD COLUMN "addedAfterConfirmation" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';
