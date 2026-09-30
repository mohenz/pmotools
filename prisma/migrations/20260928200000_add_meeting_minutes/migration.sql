-- 회의록 1단계: 회의록·참석자·내용행·Action Item·순번 테이블 신규 추가 (기존 테이블 변경 없음)
-- CreateEnum
CREATE TYPE "MeetingAttendeeSide" AS ENUM ('CUSTOMER', 'VENDOR');

-- CreateEnum
CREATE TYPE "MeetingMinuteSection" AS ENUM ('CONTENT', 'DECISION', 'NOTE');

-- CreateTable
CREATE TABLE "meeting_minute_sequences" (
    "projectId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "meeting_minute_sequences_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "meeting_minutes" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" DATE NOT NULL,
    "sessions" JSONB NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "authorName" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "meeting_minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_minute_attendees" (
    "id" TEXT NOT NULL,
    "minuteId" TEXT NOT NULL,
    "side" "MeetingAttendeeSide" NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "meeting_minute_attendees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_minute_entries" (
    "id" TEXT NOT NULL,
    "minuteId" TEXT NOT NULL,
    "section" "MeetingMinuteSection" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "remark" TEXT NOT NULL DEFAULT '',
    "plannedSchedule" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "meeting_minute_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_minute_action_items" (
    "id" TEXT NOT NULL,
    "minuteId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "assigneeId" TEXT,
    "assigneeName" TEXT NOT NULL DEFAULT '',
    "dueDate" DATE,

    CONSTRAINT "meeting_minute_action_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meeting_minutes_displayId_key" ON "meeting_minutes"("displayId");

-- CreateIndex
CREATE INDEX "meeting_minutes_projectId_archivedAt_meetingDate_idx" ON "meeting_minutes"("projectId", "archivedAt", "meetingDate");

-- CreateIndex
CREATE INDEX "meeting_minute_attendees_minuteId_idx" ON "meeting_minute_attendees"("minuteId");

-- CreateIndex
CREATE INDEX "meeting_minute_entries_minuteId_section_idx" ON "meeting_minute_entries"("minuteId", "section");

-- CreateIndex
CREATE INDEX "meeting_minute_action_items_minuteId_idx" ON "meeting_minute_action_items"("minuteId");

-- CreateIndex
CREATE INDEX "meeting_minute_action_items_assigneeId_idx" ON "meeting_minute_action_items"("assigneeId");

-- AddForeignKey
ALTER TABLE "meeting_minute_sequences" ADD CONSTRAINT "meeting_minute_sequences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minutes" ADD CONSTRAINT "meeting_minutes_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minute_attendees" ADD CONSTRAINT "meeting_minute_attendees_minuteId_fkey" FOREIGN KEY ("minuteId") REFERENCES "meeting_minutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minute_attendees" ADD CONSTRAINT "meeting_minute_attendees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minute_entries" ADD CONSTRAINT "meeting_minute_entries_minuteId_fkey" FOREIGN KEY ("minuteId") REFERENCES "meeting_minutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minute_action_items" ADD CONSTRAINT "meeting_minute_action_items_minuteId_fkey" FOREIGN KEY ("minuteId") REFERENCES "meeting_minutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_minute_action_items" ADD CONSTRAINT "meeting_minute_action_items_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

