-- 정기예약 관리(변경) 화면은 관리자 권한으로 업무시간(09:00~19:00) 제한 없이 처리할 수 있어야 하므로,
-- DB 체크 제약도 신청자용 업무시간 상한을 없애고 하루(00:00~24:00) 범위와 시작<종료만 검증하도록 완화한다.
ALTER TABLE "recurring_meeting_reservations" DROP CONSTRAINT "recurring_meeting_minutes_check";
ALTER TABLE "recurring_meeting_reservations" ADD CONSTRAINT "recurring_meeting_minutes_check" CHECK (
  "startMinutes" >= 0 AND "endMinutes" <= 1440 AND "endMinutes" > "startMinutes"
);
