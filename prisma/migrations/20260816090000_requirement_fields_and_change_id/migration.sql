-- AlterTable
ALTER TABLE "requirement_changes" ADD COLUMN     "displayId" TEXT,
ADD COLUMN     "title" TEXT;

-- Backfill existing rows (if any) before enforcing NOT NULL below.
UPDATE "requirement_changes"
SET "displayId" = 'REQ-CHG-LEGACY-' || substr("id", 1, 8),
    "title" = COALESCE(NULLIF("changeReason", ''), '(제목 없음)')
WHERE "displayId" IS NULL;

ALTER TABLE "requirement_changes" ALTER COLUMN "displayId" SET NOT NULL;
ALTER TABLE "requirement_changes" ALTER COLUMN "title" SET NOT NULL;

-- AlterTable
ALTER TABLE "requirements" ADD COLUMN     "categoryCodeId" TEXT,
ADD COLUMN     "divisionCodeId" TEXT,
ADD COLUMN     "importance" "ProbabilityLevel",
ADD COLUMN     "priority" "ProbabilityLevel",
ADD COLUMN     "requestDepartment" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "requirement_change_sequences" (
    "projectId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "requirement_change_sequences_pkey" PRIMARY KEY ("projectId")
);

-- CreateIndex
CREATE UNIQUE INDEX "requirement_changes_displayId_key" ON "requirement_changes"("displayId");

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_divisionCodeId_fkey" FOREIGN KEY ("divisionCodeId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_categoryCodeId_fkey" FOREIGN KEY ("categoryCodeId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_change_sequences" ADD CONSTRAINT "requirement_change_sequences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

