-- 지연완료(1,0) / 지연완료일자 / 지연일자 컬럼 추가.
-- 지연일자는 계획종료일 다음날부터 실적종료일까지의 영업일수(주말·공휴일 제외)이며, 실적종료일이 계획종료일보다
-- 늦게 저장될 때만 채워진다(2026-09-05 사용자 확정). 기존에 이미 그렇게 완료된 항목도 같은 규칙으로 백필한다.

ALTER TABLE "wbs_items" ADD COLUMN "isDelayedCompletion" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "wbs_items" ADD COLUMN "delayedCompletionDate" DATE;
ALTER TABLE "wbs_items" ADD COLUMN "delayDays" INTEGER;

WITH delayed AS (
  SELECT
    wi.id,
    wi."actualDueDate" AS completion_date,
    (
      SELECT count(*)::int
      FROM generate_series(wi."dueDate" + INTERVAL '1 day', wi."actualDueDate", INTERVAL '1 day') AS d
      WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
        AND NOT EXISTS (
          SELECT 1 FROM "holidays" h
          WHERE h.date = d::date AND (h."projectId" = wi."projectId" OR h."projectId" IS NULL)
        )
    ) AS business_days
  FROM "wbs_items" wi
  WHERE wi."dueDate" IS NOT NULL AND wi."actualDueDate" IS NOT NULL AND wi."actualDueDate" > wi."dueDate"
)
UPDATE "wbs_items" wi
SET "isDelayedCompletion" = true,
    "delayedCompletionDate" = delayed.completion_date,
    "delayDays" = delayed.business_days
FROM delayed
WHERE wi.id = delayed.id;
