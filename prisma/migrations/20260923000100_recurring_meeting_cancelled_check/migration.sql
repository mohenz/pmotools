-- CANCELLED 상태가 기존 review 상태 체크 제약을 위반하지 않도록 조건을 추가한다.
ALTER TABLE "recurring_meeting_reservations" DROP CONSTRAINT "recurring_meeting_review_check";
ALTER TABLE "recurring_meeting_reservations" ADD CONSTRAINT "recurring_meeting_review_check" CHECK (
  (status = 'PENDING' AND "reviewedBy" IS NULL AND "reviewedAt" IS NULL AND "rejectReason" IS NULL)
  OR (status = 'APPROVED' AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "rejectReason" IS NULL)
  OR (status = 'REJECTED' AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "rejectReason" IS NOT NULL)
  OR (status = 'CANCELLED')
);
