-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "ThemeMode" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "OpenMethod" AS ENUM ('phased', 'big_bang');

-- CreateEnum
CREATE TYPE "ProjectGrade" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('WORK_MODULE', 'COMPANY');

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('issue', 'risk');

-- CreateEnum
CREATE TYPE "ProbabilityLevel" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('registered', 'in_progress', 'resolved', 'on_hold');

-- CreateEnum
CREATE TYPE "ItemEventType" AS ENUM ('created', 'comment', 'status_changed', 'level_changed', 'edited', 'archived');

-- CreateEnum
CREATE TYPE "WeekStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('join', 'leave');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('meeting', 'milestone', 'work', 'other');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ExceptionType" AS ENUM ('MODIFIED', 'DELETED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "email" TEXT,
    "department" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "theme" "ThemeMode" NOT NULL DEFAULT 'SYSTEM',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "openMethod" "OpenMethod" NOT NULL DEFAULT 'phased',
    "startDate" DATE,
    "endDate" DATE,
    "firstOpenDate" DATE,
    "secondOpenDate" DATE,
    "goLiveDate" DATE,
    "description" TEXT NOT NULL DEFAULT '',
    "customerName" TEXT NOT NULL DEFAULT '',
    "vendorName" TEXT NOT NULL DEFAULT '',
    "customerPm" TEXT NOT NULL DEFAULT '',
    "customerPmoCount" INTEGER NOT NULL DEFAULT 0,
    "vendorPm" TEXT NOT NULL DEFAULT '',
    "vendorPmoCount" INTEGER NOT NULL DEFAULT 0,
    "projectGrade" "ProjectGrade" NOT NULL DEFAULT 'B',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "staleBusinessDays" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "groupType" "GroupType" NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_map" (
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "user_group_map_pkey" PRIMARY KEY ("userId","groupId")
);

-- CreateTable
CREATE TABLE "common_code_groups" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "common_code_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "common_codes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupCode" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "common_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "categoryCodeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "probability" "ProbabilityLevel" NOT NULL,
    "impact" "ProbabilityLevel" NOT NULL,
    "exposureText" TEXT,
    "ownerText" TEXT,
    "ownerUserId" TEXT,
    "escalationCodeId" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'registered',
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_sequences" (
    "projectId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "item_sequences_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "item_events" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "eventType" "ItemEventType" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "body" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weeks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "WeekStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "achievements" TEXT NOT NULL DEFAULT '',
    "nextPlan" TEXT NOT NULL DEFAULT '',
    "issues" TEXT NOT NULL DEFAULT '',
    "decisions" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_progress" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "planDetail" TEXT NOT NULL DEFAULT '',
    "planTargetDate" DATE,
    "actualDetail" TEXT NOT NULL DEFAULT '',
    "actualDate" DATE,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "nextPlan" TEXT NOT NULL DEFAULT '',
    "nextTargetDate" DATE,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_changes" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "changeType" "ChangeType" NOT NULL,
    "currentCount" INTEGER NOT NULL,
    "nextCount" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "eventType" "CalendarEventType" NOT NULL DEFAULT 'other',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "groupId" TEXT,
    "location" TEXT NOT NULL DEFAULT '',
    "memo" TEXT NOT NULL DEFAULT '',
    "recurrenceRule" TEXT,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_exceptions" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "exceptionDate" DATE NOT NULL,
    "type" "ExceptionType" NOT NULL,
    "overrideData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_assignees" (
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "event_assignees_pkey" PRIMARY KEY ("eventId","userId")
);

-- CreateTable
CREATE TABLE "event_group_tags" (
    "eventId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "event_group_tags_pkey" PRIMARY KEY ("eventId","groupId")
);

-- CreateTable
CREATE TABLE "event_attachments" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "contentEncrypted" TEXT NOT NULL,
    "contentIv" TEXT NOT NULL,
    "viewPasswordHash" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderMinutesBefore" INTEGER NOT NULL DEFAULT 60,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "targetTable" TEXT,
    "targetId" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_userId_key" ON "users"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_projectId_userId_key" ON "project_members"("projectId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE UNIQUE INDEX "groups_projectId_groupType_code_key" ON "groups"("projectId", "groupType", "code");

-- CreateIndex
CREATE UNIQUE INDEX "common_code_groups_projectId_code_key" ON "common_code_groups"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "common_codes_groupId_code_key" ON "common_codes"("groupId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "items_displayId_key" ON "items"("displayId");

-- CreateIndex
CREATE INDEX "items_projectId_status_idx" ON "items"("projectId", "status");

-- CreateIndex
CREATE INDEX "items_projectId_archivedAt_idx" ON "items"("projectId", "archivedAt");

-- CreateIndex
CREATE INDEX "item_events_itemId_createdAt_idx" ON "item_events"("itemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "weeks_projectId_weekKey_key" ON "weeks"("projectId", "weekKey");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_reports_weekId_groupId_key" ON "weekly_reports"("weekId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_changes_weekId_groupId_changeType_key" ON "staff_changes"("weekId", "groupId", "changeType");

-- CreateIndex
CREATE INDEX "calendar_events_projectId_startAt_endAt_idx" ON "calendar_events"("projectId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "calendar_events_projectId_isMilestone_idx" ON "calendar_events"("projectId", "isMilestone");

-- CreateIndex
CREATE UNIQUE INDEX "event_exceptions_eventId_exceptionDate_key" ON "event_exceptions"("eventId", "exceptionDate");

-- CreateIndex
CREATE INDEX "messages_receiverId_isRead_idx" ON "messages"("receiverId", "isRead");

-- CreateIndex
CREATE INDEX "audit_logs_targetTable_targetId_createdAt_idx" ON "audit_logs"("targetTable", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_projectId_createdAt_idx" ON "audit_logs"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_map" ADD CONSTRAINT "user_group_map_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_map" ADD CONSTRAINT "user_group_map_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "common_code_groups" ADD CONSTRAINT "common_code_groups_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "common_codes" ADD CONSTRAINT "common_codes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "common_codes" ADD CONSTRAINT "common_codes_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "common_code_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_categoryCodeId_fkey" FOREIGN KEY ("categoryCodeId") REFERENCES "common_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_escalationCodeId_fkey" FOREIGN KEY ("escalationCodeId") REFERENCES "common_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_sequences" ADD CONSTRAINT "item_sequences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_events" ADD CONSTRAINT "item_events_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_events" ADD CONSTRAINT "item_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weeks" ADD CONSTRAINT "weeks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_progress" ADD CONSTRAINT "weekly_progress_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_progress" ADD CONSTRAINT "weekly_progress_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_changes" ADD CONSTRAINT "staff_changes_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_changes" ADD CONSTRAINT "staff_changes_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_exceptions" ADD CONSTRAINT "event_exceptions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assignees" ADD CONSTRAINT "event_assignees_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assignees" ADD CONSTRAINT "event_assignees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_group_tags" ADD CONSTRAINT "event_group_tags_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_group_tags" ADD CONSTRAINT "event_group_tags_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_attachments" ADD CONSTRAINT "event_attachments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
