-- 이슈관리 전면 개편: 기존 이슈·리스크(Item, 확률×영향 매트릭스)를 완전히 대체한다.
-- 필드 구조가 호환되지 않아(확률×영향 ↔ 중요도/우선순위, Track ↔ 이슈구분) 데이터는 이관하지 않고
-- 새 issues 테이블로 새로 시작한다(2026-09-04 사용자 승인: "기존의 이슈/리스크관리를 대체하는 요청").
-- 기존 category/escalation_level 공통코드 그룹은 운영 데이터라 삭제하지 않고 미사용 상태로 남겨둔다.

-- 0) 기존 이슈·리스크 테이블 제거 (FK 의존 순서: item_events -> items -> item_sequences)
DROP TABLE "item_events";
DROP TABLE "items";
DROP TABLE "item_sequences";

DROP TYPE "ItemKind";
DROP TYPE "ItemStatus";
DROP TYPE "ItemEventType";
-- ProbabilityLevel(상/중/하)은 requirements.priority/importance가 계속 사용하므로 유지하고
-- 신규 Issue.importance/priority도 그대로 재사용한다.

-- 1) 신규 enum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'CLOSED');
CREATE TYPE "IssueEventType" AS ENUM ('CREATED', 'EDITED', 'STATUS_CHANGED', 'ARCHIVED');

-- 2) 신규 테이블
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "displayId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "projectId" TEXT NOT NULL,
    "categoryCodeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "importance" "ProbabilityLevel" NOT NULL,
    "priority" "ProbabilityLevel" NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "occurredAt" DATE NOT NULL,
    "dueAt" DATE,
    "ownerUserId" TEXT,
    "ownerName" TEXT,
    "responseContent" TEXT NOT NULL DEFAULT '',
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "reportLineCodeId" TEXT,
    "remark" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "issue_sequences" (
    "projectId" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "issue_sequences_pkey" PRIMARY KEY ("projectId")
);

CREATE TABLE "issue_events" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "eventType" "IssueEventType" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "body" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "issues_displayId_key" ON "issues"("displayId");
CREATE INDEX "issues_projectId_status_idx" ON "issues"("projectId", "status");
CREATE INDEX "issues_projectId_archivedAt_idx" ON "issues"("projectId", "archivedAt");
CREATE INDEX "issue_events_issueId_createdAt_idx" ON "issue_events"("issueId", "createdAt");

ALTER TABLE "issues" ADD CONSTRAINT "issues_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_categoryCodeId_fkey" FOREIGN KEY ("categoryCodeId") REFERENCES "common_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_reportLineCodeId_fkey" FOREIGN KEY ("reportLineCodeId") REFERENCES "common_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "issues" ADD CONSTRAINT "issues_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "issue_sequences" ADD CONSTRAINT "issue_sequences_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_events" ADD CONSTRAINT "issue_events_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_events" ADD CONSTRAINT "issue_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3) 프로젝트별 이슈구분/보고라인 공통코드 시딩 (20260830080000 마이그레이션의 프로젝트별 시딩 패턴을 따름)
INSERT INTO "common_code_groups" ("id", "projectId", "code", "label", "description", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", 'issue_type', '이슈구분', '이슈관리 이슈구분 공통코드', 1, true, true, now(), now()
FROM "projects" p
WHERE NOT EXISTS (SELECT 1 FROM "common_code_groups" g WHERE g."projectId" = p."id" AND g."code" = 'issue_type');

INSERT INTO "common_code_groups" ("id", "projectId", "code", "label", "description", "sortOrder", "isActive", "isSystem", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", 'report_line', '보고라인', '이슈관리 에스컬레이션 보고라인 공통코드', 2, true, true, now(), now()
FROM "projects" p
WHERE NOT EXISTS (SELECT 1 FROM "common_code_groups" g WHERE g."projectId" = p."id" AND g."code" = 'report_line');

INSERT INTO "common_codes" ("id", "projectId", "groupId", "groupCode", "code", "label", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), g."projectId", g."id", g."code", types.type_code, types.type_label, types.sort_order, true, now(), now()
FROM "common_code_groups" g
CROSS JOIN (VALUES
  ('scope', '범위', 0),
  ('schedule', '일정', 1),
  ('resource', '자원', 2),
  ('quality', '품질', 3),
  ('communication', '소통', 4)
) AS types(type_code, type_label, sort_order)
WHERE g."code" = 'issue_type'
  AND NOT EXISTS (SELECT 1 FROM "common_codes" c WHERE c."groupId" = g."id" AND c."code" = types.type_code);

INSERT INTO "common_codes" ("id", "projectId", "groupId", "groupCode", "code", "label", "sortOrder", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), g."projectId", g."id", g."code", lines.line_code, lines.line_label, lines.sort_order, true, now(), now()
FROM "common_code_groups" g
CROSS JOIN (VALUES
  ('team_lead', '팀장', 0),
  ('division_head', '사업부장', 1),
  ('ceo', '대표이사', 2),
  ('client_pmo', '고객사PMO', 3),
  ('client_team_lead', '고객사팀장', 4),
  ('client_executive', '고객사임원', 5)
) AS lines(line_code, line_label, sort_order)
WHERE g."code" = 'report_line'
  AND NOT EXISTS (SELECT 1 FROM "common_codes" c WHERE c."groupId" = g."id" AND c."code" = lines.line_code);

-- 4) 메뉴 표시설정(menu_preferences)의 키를 items -> issues로 이관 (라벨/노출 설정 유지)
UPDATE "menu_preferences"
SET "menuKey" = 'issues'
WHERE "menuKey" = 'items'
  AND NOT EXISTS (SELECT 1 FROM "menu_preferences" mp2 WHERE mp2."projectId" = "menu_preferences"."projectId" AND mp2."menuKey" = 'issues');
