-- CreateTable
CREATE TABLE "meeting_reservation_attendees" (
    "reservationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_reservation_attendees_pkey" PRIMARY KEY ("reservationId","userId")
);

-- CreateIndex
CREATE INDEX "meeting_reservation_attendees_userId_createdAt_idx" ON "meeting_reservation_attendees"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "meeting_reservation_attendees" ADD CONSTRAINT "meeting_reservation_attendees_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "meeting_reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_reservation_attendees" ADD CONSTRAINT "meeting_reservation_attendees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
