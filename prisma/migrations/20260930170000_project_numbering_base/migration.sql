-- 프로젝트 번호 시작점 자동 발번 (2026-09-30)
-- 전역 유일 표시 ID 7종(WBS-·WL-·REQ-·REQ-CHG-·ISU-·MT-·DT-)은 순번을 프로젝트별로 세므로 프로젝트마다 10만 단위 구간을 나눈다.
-- 수기 작성: prisma migrate diff가 백오피스 전용 테이블(main_menus/sub_menus) DROP을 끼워 넣으므로 직접 작성한다.

-- 1. 컬럼
ALTER TABLE "projects" ADD COLUMN "numberingBase" INTEGER;
CREATE UNIQUE INDEX "projects_numberingBase_key" ON "projects"("numberingBase");

-- 2. 기존 프로젝트 시작점 기록·빈 순번 보충 (docs/번호시작점_자동발번_설계및작업계획_20260930.md 2-2)
DO $$
DECLARE
  seq_tables text[] := ARRAY['wbs_item_sequences','work_log_sequences','requirement_sequences','requirement_change_sequences','issue_sequences','management_task_sequences','pmo_delayed_task_sequences'];
  t text;
  r RECORD;
  used int;
  next_base int;
BEGIN
  -- 프로젝트별 7개 순번 최댓값
  CREATE TEMP TABLE _nb (id text PRIMARY KEY, mx int NOT NULL) ON COMMIT DROP;
  INSERT INTO _nb SELECT id, 0 FROM "projects";
  FOREACH t IN ARRAY seq_tables LOOP
    EXECUTE format('UPDATE _nb SET mx = GREATEST(_nb.mx, s.value) FROM %I s WHERE s."projectId" = _nb.id', t);
  END LOOP;

  -- 규칙 1: 최댓값이 10만 이상이면 그 블록을 시작점으로(같은 블록에 둘 이상이면 큰 쪽만 — 나머지는 NULL로 남겨 보고)
  UPDATE "projects" p SET "numberingBase" = b.base
  FROM (SELECT id, (mx / 100000) * 100000 AS base, row_number() OVER (PARTITION BY mx / 100000 ORDER BY mx DESC) AS rn FROM _nb WHERE mx >= 100000) b
  WHERE p.id = b.id AND b.rn = 1;

  -- 규칙 2: 1부터 발급해 온(최댓값 1~99,999) 프로젝트가 하나뿐이면 시작점 0
  IF (SELECT count(*) FROM _nb WHERE mx > 0 AND mx < 100000) = 1 THEN
    UPDATE "projects" SET "numberingBase" = 0 WHERE id = (SELECT id FROM _nb WHERE mx > 0 AND mx < 100000);
  END IF;

  -- 규칙 3: 번호를 하나도 발급하지 않은 프로젝트는 생성 순서대로 다음 빈 블록을 배정
  FOR r IN SELECT p.id FROM "projects" p JOIN _nb n ON n.id = p.id WHERE n.mx = 0 AND p."numberingBase" IS NULL ORDER BY p."createdAt", p.id LOOP
    SELECT GREATEST(COALESCE((SELECT max("numberingBase") FROM "projects"), 0), (SELECT max(mx) FROM _nb)) INTO used;
    next_base := (used / 100000) * 100000 + 100000;
    UPDATE "projects" SET "numberingBase" = next_base WHERE id = r.id;
    UPDATE _nb SET mx = next_base WHERE id = r.id;
  END LOOP;

  -- 규칙 4: 시작점이 있는 프로젝트의 빈 순번(행 없음 또는 0)을 시작점으로 채운다(0 블록은 채울 필요 없음)
  FOREACH t IN ARRAY seq_tables LOOP
    EXECUTE format(
      'INSERT INTO %1$I ("projectId", value) SELECT id, "numberingBase" FROM "projects" WHERE "numberingBase" > 0
       ON CONFLICT ("projectId") DO UPDATE SET value = EXCLUDED.value WHERE %1$I.value = 0', t);
  END LOOP;

  -- 판단하지 못한 프로젝트 보고(관리자 확인 필요)
  FOR r IN SELECT p.code, n.mx FROM "projects" p JOIN _nb n ON n.id = p.id WHERE p."numberingBase" IS NULL LOOP
    RAISE WARNING 'numberingBase 미지정: 프로젝트 % (순번 최댓값 %) — 관리자 확인 필요', r.code, r.mx;
  END LOOP;
END $$;
