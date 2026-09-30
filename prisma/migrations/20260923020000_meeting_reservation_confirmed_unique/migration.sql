-- 정기예약 변경 시 기존 인스턴스를 취소(CANCELLED)하고 같은 (recurringId, startAt)로
-- 새 인스턴스를 다시 만드는 흐름이 유니크 제약을 위반하던 문제를 해결한다.
-- 유일성을 status='CONFIRMED'인 행에만 적용되는 부분 유니크 인덱스로 좁힌다.
DROP INDEX "meeting_reservations_recurringId_startAt_key";
CREATE UNIQUE INDEX "meeting_reservations_recurringId_startAt_confirmed_key" ON "meeting_reservations"("recurringId", "startAt") WHERE "status" = 'CONFIRMED';
CREATE INDEX "meeting_reservations_recurringId_startAt_idx" ON "meeting_reservations"("recurringId", "startAt");
