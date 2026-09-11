-- 실적시작일·실적종료일 추가 — 엑셀 47개 컬럼 서식(다운로드/업로드)에는 없는, 웹 화면 전용 커스텀 컬럼이다.
-- 기존 startDate·dueDate(계획시작일·계획종료일)는 그대로 두고 실제 진행 시작·완료일을 별도로 기록한다.
ALTER TABLE "wbs_items" ADD COLUMN "actualStartDate" DATE;
ALTER TABLE "wbs_items" ADD COLUMN "actualDueDate" DATE;
