-- 정기예약 관리 화면에서 변경/삭제를 지원하기 위해 CANCELLED 상태를 추가한다.
ALTER TYPE "RecurringMeetingStatus" ADD VALUE 'CANCELLED';
