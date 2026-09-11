CREATE TYPE "MessageType" AS ENUM ('DIRECT', 'CALENDAR_INVITATION');

ALTER TABLE "messages"
ADD COLUMN "messageType" "MessageType" NOT NULL DEFAULT 'DIRECT',
ADD COLUMN "calendarEventId" TEXT,
ADD COLUMN "systemPayload" JSONB,
ALTER COLUMN "contentEncrypted" DROP NOT NULL,
ALTER COLUMN "contentIv" DROP NOT NULL,
ALTER COLUMN "viewPasswordHash" DROP NOT NULL;

CREATE INDEX "messages_receiverId_messageType_isRead_idx"
ON "messages"("receiverId", "messageType", "isRead");

CREATE UNIQUE INDEX "messages_calendarEventId_receiverId_key"
ON "messages"("calendarEventId", "receiverId");

ALTER TABLE "messages"
ADD CONSTRAINT "messages_calendarEventId_fkey"
FOREIGN KEY ("calendarEventId") REFERENCES "calendar_events"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
