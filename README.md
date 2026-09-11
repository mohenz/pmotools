# Project Tool

## 원클릭 설치 (새 PC)

저장소를 새 Windows PC에 클론한 뒤 `setup.cmd`를 더블클릭하면 Node.js·PostgreSQL 18 설치(winget, 없을 때만)부터 로컬 DB 생성, `npm install`, 마이그레이션, 시드 데이터, 개발 서버 실행까지 한 번에 끝납니다. 재실행해도 안전합니다(이미 끝난 단계는 건너뜀). 자세한 옵션은 `scripts/setup-new-pc.ps1` 상단 주석 참고.

시드 데이터 대신 **프로덕션 실데이터를 그대로** 로컬로 가져오려면 `scripts/migrate-prod-to-local.ps1`을 쓴다 — 절차는 `docs/프로덕션DB_로컬마이그레이션_가이드.md` 참고.

## 로컬 실행

회의실 예약 기능은 프로젝트 전용 PostgreSQL 18(`localhost:55432`)을 사용합니다.

```powershell
npm run db:local:start
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

`http://localhost:3020/meetrooms`에서 이용할 수 있습니다. DB 상태 확인과 중지는 각각 `npm run db:local:status`, `npm run db:local:stop`을 사용합니다.

프로젝트 이슈·리스크와 PMO 업무를 통합 관리하는 웹 애플리케이션입니다.

> Firebase(Firestore)에서 Supabase(PostgreSQL) + Prisma로 데이터·인증을 전환 완료했습니다.
> 자세한 내용은 `docs/PMS_캘린더기반_재개발계획서.md` 참고. 다음 단계는 캘린더 고도화(반복일정/마일스톤/다중담당자 등)입니다.

## 현재 구현

- Supabase PostgreSQL + Prisma 기반 서버 데이터 저장
- Auth.js(Credentials) 기반 로그인/회원가입/비밀번호 변경, 세션 기반 역할(ADMIN/OPERATOR/MEMBER) 접근 제어
- 프로젝트, 사용자, 그룹(조직/업무그룹), 이슈·리스크, 업무 이력, 감사 로그 스키마
- 서버 기반 대시보드 집계와 3영업일 정체 판정
- 전체 목록 검색/필터
- 이슈·리스크 등록 API와 화면
- 에스컬레이션 레벨 서버 계산
- 대시보드 지표·매트릭스·유형별 현황에서 조건별 목록 이동
- 목록 페이지네이션, 상세 조회, CSV 내보내기
- 기본 정보, 상태, 에스컬레이션 레벨 변경
- 코멘트와 전체 변경 이력
- 낙관적 잠금을 통한 동시 수정 충돌 방지
- 운영자 이상 권한의 항목 보관 처리
- 코드 그룹 마스터와 그룹별 소속 코드 통합 관리
- 유형·에스컬레이션 레벨 시스템 그룹 설정, 업무그룹(Track)은 그룹(Groups) 테이블로 통합 관리
- 에스컬레이션 최소 점수, 표시 순서, 활성 상태 관리
- 등록일 요일 표기와 고위험 행 강조
- 프로젝트 주차 생성과 주간보고 입력·조회·인쇄
- 주간실적, 공정률 및 목표일 지연 자동 판정
- 인력 투입·철수와 금주·차주 합계 관리
- 통합 프로젝트 현황과 월간·주간·일간 캘린더
- 프로젝트 일정 등록·수정 및 목표일·이슈 통합 조회
- 주간보고·실적·인력변동 Excel용 CSV 내보내기
- 프로젝트정보 설정: 오픈 방식, 수행기간, 오픈일정, 발주·수행 조직, PMO 인원과 프로젝트 등급 관리

## 로컬 실행

```powershell
npm.cmd install
npm.cmd run local
```

- 웹: `http://127.0.0.1:3020`
- 공통코드 설정: `http://127.0.0.1:3020/settings/common-codes`
- 상태 확인: `http://127.0.0.1:3020/api/health`
- 최초 로그인 후 반드시 비밀번호를 변경하세요. seed 계정은 `prisma/seed.ts` 참고.

로컬 DB는 `setup.cmd`가 자동으로 구성합니다(`.env`의 `DATABASE_URL`이 로컬 PostgreSQL을 가리킴). 수동으로 구성하려면 `npm run db:local:start`로 로컬 Postgres를 띄운 뒤 `.env`에 `DATABASE_URL="postgresql://johndoe:randompassword@localhost:55432/mydb?schema=public"`을 넣으세요. 프로덕션 Supabase 값이 필요하면(배포 검증 등) `vercel env pull .env.local`을 별도로 사용하되, `.env`의 로컬 `DATABASE_URL`이 우선 적용됩니다.

## 주요 명령

```powershell
npm.cmd run local
npm.cmd run dev
npm.cmd run lint
npm.cmd test
npm.cmd run build
npx prisma migrate deploy   # 스키마 변경 시(이 프로젝트는 migrate dev 대신 항상 deploy 사용)
npx tsx prisma/seed.ts   # 데모 데이터 시드
```

## 다음 개발 범위

- 캘린더 고도화: 우선순위/마일스톤, 반복일정(RRULE), 다중 담당자·그룹 태깅, 년간/모바일 Agenda 뷰
- 엑셀 업/다운로드, 첨부파일(Supabase Storage), 쪽지 기능
- Supabase Connection Pooling·RLS·백업(PITR) 운영 정책 확정
