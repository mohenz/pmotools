-- 공지사항 작업 알림(배포·점검 안내) — 2026-10-01
-- 수기 작성: prisma migrate diff가 백오피스 전용 테이블(main_menus/sub_menus) DROP을 끼워 넣으므로 직접 작성한다.

-- CreateEnum
CREATE TYPE "WorkNoticeImpact" AS ENUM ('OUTAGE', 'PARTIAL', 'NONE');

-- AlterTable (기존 공지는 모두 일반 공지)
ALTER TABLE "announcements"
  ADD COLUMN "isWorkNotice" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "noticeStartAt" TIMESTAMP(3),
  ADD COLUMN "workStartAt" TIMESTAMP(3),
  ADD COLUMN "workEndAt" TIMESTAMP(3),
  ADD COLUMN "workImpact" "WorkNoticeImpact";

-- CreateIndex
CREATE INDEX "announcements_projectId_isWorkNotice_workEndAt_idx" ON "announcements"("projectId", "isWorkNotice", "workEndAt");
