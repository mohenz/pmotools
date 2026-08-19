ALTER TYPE "MessageType" ADD VALUE 'MEETING_INVITATION';

ALTER TABLE "messages"
ADD COLUMN "meetingReservationId" TEXT;

CREATE UNIQUE INDEX "messages_meetingReservationId_receiverId_key"
ON "messages"("meetingReservationId", "receiverId");

ALTER TABLE "messages"
ADD CONSTRAINT "messages_meetingReservationId_fkey"
FOREIGN KEY ("meetingReservationId") REFERENCES "meeting_reservations"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
