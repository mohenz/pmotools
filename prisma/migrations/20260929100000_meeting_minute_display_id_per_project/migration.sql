-- 회의록 표시 ID(MM-0001)를 프로젝트 안에서만 유일하게 변경 (D-6)
-- 순번이 프로젝트별로 1부터 시작하므로 전역 유일 제약이면 두 번째 프로젝트의 첫 회의록이 저장되지 않는다.
-- 인덱스만 교체하며 데이터 변경은 없다. (prisma migrate diff가 함께 만든 백오피스 main_menus/sub_menus DROP은 제외)

-- DropIndex
DROP INDEX "meeting_minutes_displayId_key";

-- CreateIndex
CREATE UNIQUE INDEX "meeting_minutes_projectId_displayId_key" ON "meeting_minutes"("projectId", "displayId");
