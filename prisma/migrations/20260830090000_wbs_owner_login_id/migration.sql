-- 엑셀 "사용자ID" 컬럼(R&R(실행) 바로 뒤) 추가 — 담당자를 로그인 ID로 확정 지정할 수 있게 한다.
-- ownerNameRaw와 같은 패턴: 매칭 성공 여부와 무관하게 원본 텍스트를 항상 보존한다.
ALTER TABLE "wbs_items" ADD COLUMN "ownerLoginId" TEXT NOT NULL DEFAULT '';
