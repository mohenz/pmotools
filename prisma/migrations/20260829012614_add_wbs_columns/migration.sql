-- AlterTable
ALTER TABLE "wbs_items" ADD COLUMN     "configStatus" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "weight" DECIMAL(6,2);

-- CreateTable
CREATE TABLE "wbs_assignments" (
    "id" TEXT NOT NULL,
    "wbsItemId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wbs_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wbs_deliverables" (
    "id" TEXT NOT NULL,
    "wbsItemId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "fileUrl" TEXT NOT NULL DEFAULT '',
    "templateUrl" TEXT NOT NULL DEFAULT '',
    "reviewerUserId" TEXT,
    "reviewedAt" DATE,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wbs_deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wbs_assignments_wbsItemId_groupId_key" ON "wbs_assignments"("wbsItemId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "wbs_deliverables_wbsItemId_key" ON "wbs_deliverables"("wbsItemId");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_projectId_date_key" ON "holidays"("projectId", "date");

-- AddForeignKey
ALTER TABLE "wbs_assignments" ADD CONSTRAINT "wbs_assignments_wbsItemId_fkey" FOREIGN KEY ("wbsItemId") REFERENCES "wbs_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_assignments" ADD CONSTRAINT "wbs_assignments_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_assignments" ADD CONSTRAINT "wbs_assignments_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_deliverables" ADD CONSTRAINT "wbs_deliverables_wbsItemId_fkey" FOREIGN KEY ("wbsItemId") REFERENCES "wbs_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wbs_deliverables" ADD CONSTRAINT "wbs_deliverables_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

