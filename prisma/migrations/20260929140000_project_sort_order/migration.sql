-- 프로젝트 노출 우선순위 (작을수록 위, 같으면 이름순). 기본값 0이라 기존 목록 순서(이름순)는 그대로 유지된다.
-- 컬럼 추가만 하며 기존 데이터 변경 없음. (prisma migrate diff가 섞어 만드는 백오피스 main_menus/sub_menus DROP은 제외)
ALTER TABLE "projects" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
