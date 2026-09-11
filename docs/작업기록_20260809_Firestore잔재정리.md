# 작업 기록 — Firestore 잔재 정리 및 배포 파이프라인 복구 (2026-08-09)

> 대상 저장소: `mohenz/projectmgmt` · 머지 커밋: `30949f6` (PR #4)
> 프로덕션: https://projectmgmt-tau.vercel.app/

## 0. 배경

`docs/calendar` 설계문서 확인에서 시작해, Firebase→Supabase 전환 이후 남은 잔재를 점검한 결과
**코드·설정 레벨은 이미 정리 완료**였으나 **문서DB(Firestore) 시절의 쿼리 패턴과 스키마 설계가 서버 계층에 남아 있음**을 확인하고 정리했다.
작업 중 **Vercel 배포가 그동안 전부 실패해 왔다**는 사실이 드러나 함께 복구했다.

### 이미 정리되어 있던 것 (확인만)

`firebase-admin` 의존성 없음 · `apphosting.yaml`/`firebase.json`/`firestore.rules`/`.firebaserc` 삭제됨 ·
env에 `GOOGLE_CLOUD_PROJECT`/`FIRESTORE_DATABASE_ID` 없음 · `lib/domain/firestore-model.ts` 제거 ·
`lib/server/db.ts` → `db-pg.ts` 교체 · `/api/health`가 `provider: "postgres"` 반환.
즉 `PMS_캘린더기반_재개발계획서.md` 5장 "Firebase 제거 체크리스트"는 실행 완료 상태였다.

---

## 1. 전체 로드 후 메모리 필터링 → DB 쿼리 이관

Firestore는 LIKE·복합 필터·집계가 불가능해 "전부 읽어서 애플리케이션에서 거른다"가 정석이었고,
그 구조가 Postgres 전환 후에도 남아 `WHERE`/`LIMIT`/`COUNT`를 쓰지 않고 있었다.

| 파일 | 변경 내용 |
|---|---|
| `lib/server/work-management.ts` | `weekId`를 WHERE로 이관(기존: 전체 조회 후 `records.filter()`). 주차·그룹 라벨을 관계 `include`로 가져오고 정렬을 관계 `orderBy`로 전환 → 부가 쿼리 2개 제거. `getPortfolioDashboard`를 `count`/`aggregate(_avg)`/`groupBy(_sum)`으로 전환 |
| `lib/server/items.ts` | `filterItems()` 제거 → `itemWhere()`가 모든 필터를 Prisma WHERE로 생성. 메모리 `slice()` → `count` + `skip`/`take` DB 페이지네이션. `enrich()`의 수동 Map 조인 → `include: { category, group, escalation }`. `getDashboard`를 `count`×4 + `groupBy`×2 + 상위 8건 `take`로 전환 |
| `lib/server/admin.ts` | 사용자 검색을 전체 로드 후 `includes()` → `contains` + `mode:"insensitive"`(ILIKE) |
| `lib/server/calendar.ts` | `where: { projectId }`로 프로젝트 전체 일정을 읽던 것을 기간 조건으로 축소. 검색 필터(키워드·우선순위·그룹·담당자)도 DB로 이관 |
| `lib/domain/business-days.ts` (신규) | 영업일 계산을 도메인 계층으로 분리. `staleCutoff(days)`가 영업일 기반 stale 판정을 `updatedAt < cutoff` SQL 조건으로 변환 |

### 의도적으로 남긴 인메모리 처리

- **반복 일정 전개 후 필터링** (`calendar.ts`): 회차별 예외(override)가 제목·우선순위·그룹을 바꿀 수 있어
  마스터 행 기준으로 DB에서 좁히면 잘못된 결과가 나온다. DB는 안전한 범위만 좁히고(비반복 일정·기간),
  최종 판정은 전개 후 수행한다. 코드에 사유를 주석으로 명시.
- **파생 소스 사전 제외**: 주간실적·이슈에서 파생된 일정은 담당자가 없고 우선순위가 고정(실적 MEDIUM/LOW, 이슈 LOW)이라,
  매칭 불가능한 필터가 들어오면 쿼리 자체를 생략한다.

### 동작 변화 (의도된 것, 인수인계 필요)

1. **이슈·리스크 키워드 검색**: 기존에는 `"제목 설명 담당자"`를 공백으로 이어붙인 문자열에서 검색했으나
   이제 필드별 검색이다. **필드 경계를 걸치는 검색어는 더 이상 매치되지 않는다.**
2. **주간보고/실적/인력변동의 `areaLabel`**: 비활성 업무그룹일 때 `"-"`로 표시되던 것이 실제 라벨로 바뀐다.

---

## 2. 스키마 잔재 정리

마이그레이션: `prisma/migrations/20260809000000_add_actor_foreign_keys/`

- **FK 5개 추가** — 문자열로만 들고 있던 사용자 ID에 참조 무결성 부여
  - `calendar_events.createdBy` / `updatedBy`
  - `weekly_reports.createdBy` / `weekly_progress.createdBy` / `staff_changes.createdBy`
  - 적용 전 라이브 DB에서 고아 참조를 조회해 **전 항목 0건** 확인 후 적용
- **인덱스 추가** — `weekly_progress(weekId, groupId)`
- **하드코딩 제거** — `item_events.actorName`에 무조건 `"PMO 관리자"`가 기록되던 6곳을
  실제 로그인 사용자명으로 교체(`actorNameOf()`). 비정규화 문제가 아니라 잘못된 데이터가 쌓이던 버그였다.

### 남겨둔 항목과 사유

| 항목 | 사유 |
|---|---|
| `CommonCode.groupCode` 비정규화 | 그룹 `code`는 생성 후 수정 불가(`updateGroupSchema`에 code 필드 없음)라 stale 위험이 실재하지 않음. 제거 시 hot path에 조인만 추가됨 |
| `ItemEvent.actorName` / `AuditLog.actorName` | 사건 발생 시점의 이름 스냅샷이 의도된 설계 |
| `Item.ownerUserId` | 어디서도 채워지지 않아 항상 null이고 권한 체크에서만 읽힘. 담당자를 사용자 FK로 갈지 자유 텍스트로 둘지는 **제품 결정 필요** |
| `ItemSequence` | 문서DB식 카운터지만 `$transaction` + `increment`로 안전 동작 중. 네이티브 시퀀스 전환은 `displayId` 연속성 리스크 대비 이득이 적음 |

---

## 3. 배포 파이프라인 복구 (이번 작업의 최대 발견)

배포를 시도하는 과정에서 **GitHub 연동 자동배포가 최근 전부 실패해 왔음**을 확인했다.
Preview뿐 아니라 8/7 프로덕션 커밋(`0807140`, Supabase 전환)의 GitHub 트리거 배포도 실패 상태였다.

당시 프로덕션이 정상 동작했던 것은 `vercel deploy --prod` **CLI 수동 배포**로 올렸기 때문이다
(로컬에는 `lib/generated/prisma` 생성물이 있어 빌드가 성공). 즉 서비스는 살아 있었지만
**GitHub push만으로 배포하는 경로는 계속 끊겨 있었다.**

**원인**: `lib/generated/prisma`가 `.gitignore` 대상이라 저장소에 존재하지 않는데
빌드 과정에 `prisma generate`가 없어 신규 체크아웃에서 모듈 해석에 실패했다.
로컬은 생성물이 남아 있어 성공하고 Vercel만 실패하는 형태였다.

**조치**: `package.json`에 `"postinstall": "prisma generate"` 추가 (커밋 `afddc6c`).
→ Preview 배포 성공 → main 머지 → **GitHub 트리거 프로덕션 배포 성공**(자동배포 경로 첫 성공).

이후로는 CLI 수동 배포 없이 **main push만으로 배포된다.**

---

## 4. 문서 정리

- `docs/PMS_개발환경_아키텍처.md` — 배너가 폐기된 `FIREBASE_FIRESTORE_ARCHITECTURE.md`를
  "현재 기준"으로 가리키던 오류를 `PMS_캘린더기반_재개발계획서.md`로 수정
- `docs/PMS_캘린더기반_재개발계획서.md` — 체크리스트의 문서 배너 항목을 완료 처리
- `prisma/schema.prisma` — 헤더 주석의 Firestore 언급 제거

---

## 5. 테스트

**6개 → 23개** (`npx vitest run` 전체 통과, `tsc --noEmit` 통과)

- `lib/domain/business-days.test.ts` — 주말을 걸치는 경계, 오늘이 주말인 경우,
  `staleCutoff`가 `businessDaysSince`와 정확히 같은 경계를 갖는지 검증
- `lib/server/items.test.ts` — `itemWhere()` 필터 조합 10건.
  특히 "이슈는 확률을 항상 high로 취급" 규칙이 SQL에서도 유지되는지 확인
- `vitest.config.ts` — `@/` alias와 `server-only` 스텁 추가로 서버 계층 순수 함수를 테스트 가능하게 함
  (`@prisma/...` 스코프 패키지가 걸리지 않도록 `@/` 접두사만 치환)

---

## 6. 검증 결과

로컬(`localhost:3020`)과 프로덕션(`projectmgmt-tau.vercel.app`) 양쪽에서 시드 관리자 계정으로
읽기 경로 스모크 테스트를 수행했고 **결과가 완전히 일치**했다.

| 항목 | 결과 |
|---|---|
| `/api/health` | `postgres` 연결 ok (프로덕션 포함) |
| 이슈 목록 | 전체 5 / 미해결 4 / 정체 2 / `probability=high` 3 |
| 확률 특수규칙 | `probability=high`가 이슈 3건 전체 포함, `kind=risk&probability=high`는 0건 |
| 한글 검색 | `q=이슈` → 2건 정확 매치 (ILIKE 한글 정상) |
| stale 판정 | `stale=true` 2건이 응답의 `isStale:true` 2건과 일치 |
| 홈 대시보드 | 리스크 매트릭스 합계가 미해결 건수(4)와 일치, 유형별·에스컬레이션 정렬 정상 |
| 캘린더 | 4개 소스 전부 출력(schedule/progress/next_plan/issue), 우선순위·키워드 필터 정확 |
| SSR 페이지 11개 | 전부 200, 런타임 에러 없음 |

### 미검증 항목

1. **다중 페이지 이동** — 데이터가 5건뿐이고 페이지 크기 하한이 10(기존 코드)이라 2페이지 이상을 만들 수 없었다.
   `skip`/`take` 경계는 데이터 10건 초과 환경에서 확인 필요.
2. **쓰기 경로** — `actorName` 변경(이슈 등록/수정/댓글 시 활동 이력에 로그인 사용자명이 기록되는지)은
   운영 DB에 데이터를 생성하게 되어 수행하지 않았다.

---

## 7. 🔴 후속 조치 (우선순위 순)

### P0 — 보안

**저장소가 public이고, 프로덕션 ADMIN 계정의 비밀번호가 평문으로 커밋되어 있다.**

- `prisma/seed.ts:16` → `const ADMIN_TEMP_PASSWORD = "ChangeMe!2026";`
- 계정: `pmo.admin` / ADMIN 권한(사용자 관리·역할 변경·비밀번호 강제 초기화·감사 로그 전체)
- 프로덕션 URL에는 Vercel Deployment Protection이 걸려 있지 않아 **누구나 로그인 가능한 상태**

조치: ① `pmo.admin` 비밀번호 즉시 변경 → ② seed의 평문 비밀번호를 환경변수로 분리 →
③ 저장소 private 전환 검토 → ④ 프로덕션 접근 보호 정책 결정

### P1

- 위 6장의 **미검증 항목 2건** 확인
- `updateProgress()`가 `writeAuditLog`에 actor를 `null`로 넘겨 주간실적 수정자가 기록되지 않음
  (`lib/server/work-management.ts`) — 함수에 `userId`를 전달하면 해결

### P2

- `Item.ownerUserId` 담당자 모델 확정 (제품 결정)
- 서버 계층 통합 테스트 부재 — 이번에 추가한 것은 순수 함수 단위 테스트뿐

---

## 8. 커밋 이력

| 커밋 | 내용 |
|---|---|
| `d17ce6c` | Firestore 잔재 정리: 메모리 필터링 제거 및 참조 무결성 추가 |
| `afddc6c` | 빌드 시 Prisma Client 생성 추가 |
| `30949f6` | Merge pull request #4 from mohenz/chore/firestore-legacy-cleanup |
