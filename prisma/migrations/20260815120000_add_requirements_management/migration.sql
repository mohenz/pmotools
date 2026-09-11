-- CreateEnum
CREATE TYPE "RequirementAcceptance" AS ENUM ('pending', 'accepted', 'rejected', 'deferred');

-- CreateEnum
CREATE TYPE "RequirementEventType" AS ENUM ('created', 'edited', 'archived', 'change_requested', 'change_approved', 'change_rejected');

-- CreateEnum
CREATE TYPE "RequirementChangeStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "ownerUserId" TEXT,
    "basis" TEXT NOT NULL DEFAULT '',
    "precondition" TEXT NOT NULL DEFAULT '',
    "resolution" TEXT NOT NULL DEFAULT '',
    "acceptanceStatus" "RequirementAcceptance" NOT NULL DEFAULT 'pending',
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_sequences" (
    "projectId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "requirement_sequences_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "requirement_events" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "eventType" "RequirementEventType" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "body" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_changes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "changeReason" TEXT NOT NULL,
    "proposedTitle" TEXT,
    "proposedContent" TEXT,
    "proposedBasis" TEXT,
    "proposedPrecondition" TEXT,
    "proposedResolution" TEXT,
    "proposedAcceptance" "RequirementAcceptance",
    "status" "RequirementChangeStatus" NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,

    CONSTRAINT "requirement_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "requirements_displayId_key" ON "requirements"("displayId");

-- CreateIndex
CREATE INDEX "requirements_projectId_archivedAt_idx" ON "requirements"("projectId", "archivedAt");

-- CreateIndex
CREATE INDEX "requirements_projectId_acceptanceStatus_idx" ON "requirements"("projectId", "acceptanceStatus");

-- CreateIndex
CREATE INDEX "requirement_events_requirementId_createdAt_idx" ON "requirement_events"("requirementId", "createdAt");

-- CreateIndex
CREATE INDEX "requirement_changes_projectId_status_idx" ON "requirement_changes"("projectId", "status");

-- CreateIndex
CREATE INDEX "requirement_changes_requirementId_requestedAt_idx" ON "requirement_changes"("requirementId", "requestedAt");

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_sequences" ADD CONSTRAINT "requirement_sequences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_events" ADD CONSTRAINT "requirement_events_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_events" ADD CONSTRAINT "requirement_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_changes" ADD CONSTRAINT "requirement_changes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_changes" ADD CONSTRAINT "requirement_changes_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_changes" ADD CONSTRAINT "requirement_changes_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_changes" ADD CONSTRAINT "requirement_changes_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

