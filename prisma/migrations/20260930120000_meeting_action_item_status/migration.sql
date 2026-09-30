-- 회의록 Action Item 진행상태 · 변경 이력 (2026-09-30)
-- 수기 작성: prisma migrate diff가 백오피스 전용 테이블(main_menus/sub_menus) DROP을 끼워 넣으므로 직접 작성한다.

-- CreateEnum
CREATE TYPE "MeetingActionItemStatus" AS ENUM ('WAITING', 'IN_PROGRESS', 'ON_HOLD', 'DONE');

-- AlterTable: 기존 행은 모두 '대기'로 시작
ALTER TABLE "meeting_minute_action_items"
  ADD COLUMN "status" "MeetingActionItemStatus" NOT NULL DEFAULT 'WAITING',
  ADD COLUMN "statusChangedAt" TIMESTAMP(3),
  ADD COLUMN "statusChangedBy" TEXT;

-- CreateTable
CREATE TABLE "meeting_minute_action_item_logs" (
    "id" TEXT NOT NULL,
    "actionItemId" TEXT NOT NULL,
    "fromStatus" "MeetingActionItemStatus",
    "toStatus" "MeetingActionItemStatus" NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_minute_action_item_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_minute_action_items_status_idx" ON "meeting_minute_action_items"("status");
CREATE INDEX "meeting_minute_action_item_logs_actionItemId_createdAt_idx" ON "meeting_minute_action_item_logs"("actionItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "meeting_minute_action_items" ADD CONSTRAINT "meeting_minute_action_items_statusChangedBy_fkey" FOREIGN KEY ("statusChangedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_minute_action_item_logs" ADD CONSTRAINT "meeting_minute_action_item_logs_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "meeting_minute_action_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meeting_minute_action_item_logs" ADD CONSTRAINT "meeting_minute_action_item_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
