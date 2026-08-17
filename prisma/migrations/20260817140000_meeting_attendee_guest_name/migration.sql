-- Allow meeting attendees who are not registered system users (guest name only).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Replace the (reservationId, userId) composite primary key with a surrogate id,
-- since userId must become nullable to support guest attendees.
ALTER TABLE "meeting_reservation_attendees" DROP CONSTRAINT "meeting_reservation_attendees_pkey";
ALTER TABLE "meeting_reservation_attendees" ADD COLUMN "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "meeting_reservation_attendees" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "meeting_reservation_attendees" ADD CONSTRAINT "meeting_reservation_attendees_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "meeting_reservation_attendees" ADD COLUMN "guestName" TEXT;
ALTER TABLE "meeting_reservation_attendees" ALTER COLUMN "userId" DROP NOT NULL;

-- Prevent adding the same registered user twice to a reservation (NULL userId rows, i.e. guests, are unaffected).
CREATE UNIQUE INDEX "meeting_reservation_attendees_reservationId_userId_key" ON "meeting_reservation_attendees"("reservationId", "userId");
