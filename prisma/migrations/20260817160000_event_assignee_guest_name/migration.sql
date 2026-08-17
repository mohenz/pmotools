-- Allow calendar event assignees who are not registered system users (guest name only).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Replace the (eventId, userId) composite primary key with a surrogate id,
-- since userId must become nullable to support guest assignees.
ALTER TABLE "event_assignees" DROP CONSTRAINT "event_assignees_pkey";
ALTER TABLE "event_assignees" ADD COLUMN "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "event_assignees" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "event_assignees" ADD CONSTRAINT "event_assignees_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "event_assignees" ADD COLUMN "guestName" TEXT;
ALTER TABLE "event_assignees" ALTER COLUMN "userId" DROP NOT NULL;

-- Prevent adding the same registered user twice to an event (NULL userId rows, i.e. guests, are unaffected).
CREATE UNIQUE INDEX "event_assignees_eventId_userId_key" ON "event_assignees"("eventId", "userId");
