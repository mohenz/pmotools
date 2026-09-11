-- CreateEnum
CREATE TYPE "MeetingRoomType" AS ENUM ('LARGE', 'SMALL');

-- CreateEnum
CREATE TYPE "MeetingReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RecurringMeetingPattern" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "RecurringMeetingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MeetingChangeAction" AS ENUM ('CREATE', 'CANCEL', 'EXTEND', 'SHORTEN');

-- CreateTable
CREATE TABLE "meeting_rooms" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roomType" "MeetingRoomType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "floor" TEXT,
    "equipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_reservations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recurringId" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "MeetingReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_meeting_reservations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "patternType" "RecurringMeetingPattern" NOT NULL,
    "patternDetail" JSONB NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "RecurringMeetingStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_meeting_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meeting_reservation_change_logs" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "MeetingChangeAction" NOT NULL,
    "beforeStart" TIMESTAMP(3),
    "beforeEnd" TIMESTAMP(3),
    "afterStart" TIMESTAMP(3),
    "afterEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_reservation_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_rooms_projectId_isActive_deletedAt_idx" ON "meeting_rooms"("projectId", "isActive", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_rooms_projectId_name_key" ON "meeting_rooms"("projectId", "name");

-- CreateIndex
CREATE INDEX "meeting_reservations_projectId_startAt_endAt_idx" ON "meeting_reservations"("projectId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "meeting_reservations_roomId_startAt_idx" ON "meeting_reservations"("roomId", "startAt");

-- CreateIndex
CREATE INDEX "meeting_reservations_userId_startAt_idx" ON "meeting_reservations"("userId", "startAt");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_reservations_recurringId_startAt_key" ON "meeting_reservations"("recurringId", "startAt");

-- CreateIndex
CREATE INDEX "recurring_meeting_reservations_projectId_status_createdAt_idx" ON "recurring_meeting_reservations"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "recurring_meeting_reservations_roomId_periodStart_periodEnd_idx" ON "recurring_meeting_reservations"("roomId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "meeting_reservation_change_logs_reservationId_createdAt_idx" ON "meeting_reservation_change_logs"("reservationId", "createdAt");

-- AddForeignKey
ALTER TABLE "meeting_rooms" ADD CONSTRAINT "meeting_rooms_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reservations" ADD CONSTRAINT "meeting_reservations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reservations" ADD CONSTRAINT "meeting_reservations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "meeting_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reservations" ADD CONSTRAINT "meeting_reservations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reservations" ADD CONSTRAINT "meeting_reservations_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "recurring_meeting_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_meeting_reservations" ADD CONSTRAINT "recurring_meeting_reservations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_meeting_reservations" ADD CONSTRAINT "recurring_meeting_reservations_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "meeting_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_meeting_reservations" ADD CONSTRAINT "recurring_meeting_reservations_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_meeting_reservations" ADD CONSTRAINT "recurring_meeting_reservations_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reservation_change_logs" ADD CONSTRAINT "meeting_reservation_change_logs_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "meeting_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reservation_change_logs" ADD CONSTRAINT "meeting_reservation_change_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Meeting room domain integrity and race-safe overlap protection.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "meeting_rooms"
  ADD CONSTRAINT "meeting_rooms_capacity_check" CHECK ("capacity" > 0);

ALTER TABLE "meeting_reservations"
  ADD CONSTRAINT "meeting_reservations_time_check" CHECK ("endAt" > "startAt"),
  ADD CONSTRAINT "meeting_reservations_no_overlap"
  EXCLUDE USING GIST (
    "roomId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  ) WHERE ("status" = 'CONFIRMED');

ALTER TABLE "recurring_meeting_reservations"
  ADD CONSTRAINT "recurring_meeting_minutes_check"
    CHECK ("startMinutes" >= 540 AND "endMinutes" <= 1140 AND "endMinutes" > "startMinutes"),
  ADD CONSTRAINT "recurring_meeting_period_check" CHECK ("periodEnd" >= "periodStart"),
  ADD CONSTRAINT "recurring_meeting_review_check" CHECK (
    ("status" = 'PENDING' AND "reviewedBy" IS NULL AND "reviewedAt" IS NULL AND "rejectReason" IS NULL)
    OR ("status" = 'APPROVED' AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "rejectReason" IS NULL)
    OR ("status" = 'REJECTED' AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "rejectReason" IS NOT NULL)
  );
