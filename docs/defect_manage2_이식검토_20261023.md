# defect_manage2 분석 및 pmotools 이식 검토

- 작성일: 2026-10-23
- 대상: `D:\workspace\defect_manage2` (GitHub `mohenz/defect_manage2`, 최신 커밋 `71bcf46 Prepare Supabase and Vercel deployment`)
- 목적: defect_manage2의 결함관리 기능을 pmotools로 이식하는 방법을 검토한다.
- 상태: **검토 문서.** 코드와 DB는 변경하지 않았다. 아래 5장의 결정 사항이 정해지기 전에는 구현에 착수하지 않는다.
- 분석 범위: README, `docs/functional_specification.md`, `docs/db_schema.md`, `local/schema.sql`, `backend/*.js`, `js/` 구조와 주요 모듈(목록·대시보드·조치자 현황), 외부 연동 위젯·확장 프로그램 문서, `project_control`의 상태 파일. 프런트 전체 코드를 줄 단위로 검증한 것은 아니며, 각 화면의 동작은 코드·문서에서 읽은 내용이다.

---

## 1. defect_manage2 개요

### 1.1 구성

| 영역 | 내용 |
|---|---|
| 프런트엔드 | HTML + 바닐라 JS 단일 화면 앱. `js/app.js` 2,029줄, `js/modules/`(form 567, dashboard 497, admin-settings 410, auth 240, list 196, assignee-status 181, admin 164), `js/services/`, Chart.js |
| 백엔드 | Node.js + Express. `backend/app.js` 343줄, `auth.js` 137, `defect-writes.js` 111, `users.js` 66, `public-assets.js` 20, `server.js` 48 |
| DB | PostgreSQL. 기본 로컬 `127.0.0.1:54323`, DB `defect_manage2`. Supabase PostgreSQL은 `DATABASE_URL`로 지원 |
| 배포 | 로컬 Node 서버, Vercel(정적 + Express Function), 내부 서버 포팅 가이드 보유 |
| 테스트 | 단위 22건(SQL test double), PostgreSQL 통합 3건, Playwright e2e |
| 외부 연동 | html2canvas 캡처 위젯(`docs/defectflow_report_widget_latest.js` 794줄), 모바일 간편 위젯(192줄), `docs/bug-reporter.js`(418줄), Chrome 확장 `extension/defectflow-reporter`(MV3), 테스트 벤치 페이지(`test_view/`) |

### 1.2 DB 테이블 (7개, `local/schema.sql` 기준)

| 테이블 | 주요 컬럼 | 비고 |
|---|---|---|
| `users` | `user_id` BIGINT, `email` 유일, `password`(bcrypt), `name`, `department`, `role`, `status`(사용/사용중지), `needs_password_reset` | 로그인 ID는 이메일 |
| `defects` | `defect_id` BIGINT, `title`, `test_type`, `severity`, `priority`, `status`, `steps_to_repro`, `menu_name`, `screen_name`, `screen_url`, `screenshot`(TEXT: URL 또는 base64 data URL), `defect_identification`, `env_info`, `creator`, `assignee`, `action_comment`, `action_due_date`, `action_start`, `action_end`, `is_deleted`('Y'/'N'), `created_at`, `updated_at` | 사람은 **이름 문자열**로 저장 |
| `common_codes` | `group_code`, `code_value`, `code_name`, `color`, `sort_order`, `is_active` | 그룹: STATUS, SEVERITY, PRIORITY, TEST_TYPE, SCREEN_PATH 등 |
| `app_settings` | `key`, `value`(JSONB) | `global_config`에 활성 테스트구분 목록 |
| `defect_history` | `defect_id`, `action`, `status_before`, `status_after`, `changed_data`(JSONB), `changed_by` | 생성·수정·삭제 시 같은 트랜잭션으로 기록. 스크린샷 원문은 복사하지 않음 |
| `defect_save_error_logs` | `client_log_id`, `operation`, `stage`, `error_type`, `message`, `runtime_context`, `payload_summary` 등 | 외부 연동 저장 실패 원인 추적용 |
| `auth_sessions` | `token_hash`, `user_id`, `expires_at` | 세션 8시간, HttpOnly 쿠키 |

### 1.3 API (`/api/*`)

- 결함: `GET /defects`(페이징·필터, pageSize 최대 200), `GET /defects/:id`, `GET /defects/summary`(통계용 전체), `GET /defects/export`, `GET /defects/action-recheck`(관리자·조치자), `POST /defects`, `PUT /defects/:id`, `DELETE /defects/:id`(관리자, 논리 삭제)
- 공통코드: `GET/POST/DELETE /common-codes`(쓰기는 관리자)
- 설정: `GET/PUT /settings/global`
- 오류 로그: `GET`(관리자)/`POST /error-logs`
- 인증·사용자: `POST /auth/login`, `/signup`, `/logout`, `GET /auth/me`, `GET/POST/PUT/DELETE /users`, `POST /users/reset-password`
- 변경 요청은 `Origin`·`Sec-Fetch-Site` 검사와 JSON 콘텐츠 타입을 요구한다.

### 1.4 기능

1. **인증·권한:** 역할 테스터·조치자·관리자. 가입 시 테스터·조치자만 선택. 최초 로그인 비밀번호 변경 강제.
2. **결함 등록·수정:** 제목 5자 이상, 화면 URL은 http/https만, 이미지는 png/jpeg/webp/gif data URL 또는 URL. 등록 시 상태는 `Open`, 등록자는 로그인 사용자 이름.
3. **권한 규칙(서버):** 테스터는 조치 정보(담당자, 상태, 결함식별, 조치내용·예정일·시작·종료)를 등록·변경할 수 없고, 심각도는 관리자나 등록자 본인만 변경할 수 있다. 삭제는 관리자만.
4. **목록:** 결함 ID, 테스트구분, 심각도, 상태(`조치 미완료` 프리셋 포함), 결함식별, 등록자, 기간 등 복합 필터. 10페이지 단위 페이징. 결함 번호 복사. CSV(UTF-8 BOM) 다운로드. 조치예정일 열.
5. **대시보드:** 등록자별·심각도별 표, 심각도별 조치 현황, 상태별 가로 스택 바, 조치 미완료 카드(클릭 시 목록 이동), 조치완료율. 요약 데이터는 1000건 단위로 끝까지 조회.
6. **조치자 현황:** 조치자별 상태별 건수, 완료 건수, 완료율, 미배정 행.
7. **조치 재확인:** 상태가 완료(`Closed`·`Resolved`·`Staging`)인데 결함식별·조치내용이 모두 빈 결함 목록.
8. **관리:** 공통코드(코드 추가·삭제), 활성 테스트구분 설정, 사용자 관리(역할·부서·상태·비밀번호 초기화), 저장 오류 로그 조회, 사용자 매뉴얼(앱 안 렌더링).
9. **외부 연동:** 테스트 대상 사이트에 위젯을 붙이면 버튼 하나로 화면을 캡처해 등록 팝업(전용 폼, 사이드바 없음)을 열고 URL·제목·UserAgent를 자동 전달한다. Chrome 확장은 현재 탭을 캡처해 `?mode=standalone#register` 탭을 연다. 두 방식 모두 등록 탭의 서버 인증 쿠키를 사용한다.

### 1.5 이식에 영향을 주는 특징

- 한 프로젝트만 전제한다(프로젝트 개념 없음).
- 결함과 사람의 관계가 **이름 문자열**(`creator`, `assignee`)이고, 같은 이름·미등록 이름 처리 규칙이 없다. 문서(`db_schema.md`)에도 "사용자명 기반 관계는 별도 승인된 데이터 매핑 전까지 유지"로 적혀 있다.
- ID가 `Date.now()`/난수 BIGINT다.
- 캡처 이미지가 base64로 `TEXT` 컬럼과 요청 본문(JSON 30MB 제한)에 들어간다.
- 상태는 영문 문자열이며 전이 규칙은 없고 권한 검사만 있다.
- 사용자·세션·로그인이 자체 구현이다.

---

## 2. pmotools와의 대응

| defect_manage2 | pmotools에서 재사용할 자산 | 비고 |
|---|---|---|
| 사용자·역할 | `User`, `UserRole`(SUPER_ADMIN/ADMIN/OPERATOR/MEMBER), 프로젝트 구성원, 직무 권한 | 둘 다 `bcryptjs` 사용 → 비밀번호 해시 이관 가능(재설정 강제 여부는 정책 결정) |
| 공통코드 | `CommonCodeGroup`/`CommonCode`(프로젝트별 가능) | 그룹 5개를 시드로 생성 |
| 결함 이력 | `writeAuditLog`, 단위테스트의 INSERT 전용 이력 패턴 | |
| 캡처 이미지 | `lib/server/ut-evidence-storage.ts`(파일 저장, 20MB 제한, png/jpg/gif/webp 등 허용) | 디스크 저장 전제 |
| 목록·페이징·엑셀 | `UtPagination`, `exceljs`(`buildUtSheetWorkbook`) | CSV 대신 xlsx |
| 통계 화면 | `mp-ut/stats`(방금 만든 표·막대 구성) | 대시보드·조치자 현황의 패턴 |
| 프로젝트 범위 | `getMpScope`, `MpLayout`, 메뉴 노출 설정(`menu-preferences`) | |
| Chrome 확장 | `extension/`(WBS용) | 결함 캡처용은 별개로 필요 |

겹치는 기존 기능: `ut_defects`(단위테스트 결함: 등록 → 조치완료 → 검증완료/재조치)와 `Issue`(이슈·리스크 관리). defect_manage2는 **통합·선오픈·3자 테스트 단계의 결함**이라 범위가 다르다.

---

## 3. 이식 방안

### 방안 A — pmotools에 새 모듈로 재구현 (권장)

- 새 모델(`Defect`, `DefectHistory`)과 `/mp-defects` 계열 화면·API를 만든다. 사용자·프로젝트·공통코드·증적 저장소·통계 화면 패턴을 재사용한다.
- 장점: 로그인·프로젝트 범위·디자인·권한이 하나로 통합되고, 결함–사람 관계가 사용자 id로 바뀐다. 이후 단위테스트 결함·WBS·요구사항과 연결하기 쉽다.
- 단점: 공수가 가장 크다. 프런트 전체를 다시 작성한다.

### 방안 B — 별도 서버로 두고 연결

- defect_manage2를 그대로 운영하고 메뉴에서 링크 또는 프록시로 연결한다.
- 장점: 가장 빠르다.
- 단점: 로그인·사용자 DB·디자인이 이중이 되고 프로젝트·사용자와 연결할 수 없다. SSO를 따로 구현해야 한다. 장기적으로는 비용이 더 든다.

### 방안 C — 단계적 병행 (A의 이행 방식)

- A로 구현하는 동안 외부 위젯·확장 프로그램은 기존 서버로 계속 받고, 데이터 이관과 검증이 끝난 시점에 위젯·확장의 호출 주소를 pmotools로 바꾼다.
- 병행 기간 동안 신규 결함이 두 곳에 생기지 않도록 기존 서버를 읽기 전용으로 바꾸는 시점을 정해야 한다.

권고: **A를 C 방식으로 진행.** B는 임시 연결이 필요할 때만 고려한다.

---

## 4. 방안 A의 상세 설계안 (제안, 확정 아님)

### 4.1 데이터 모델 매핑

| defect_manage2 | pmotools 제안 | 설명 |
|---|---|---|
| `defect_id` BIGINT | `id`(uuid) + `displayId` | `ut_defects`의 `DF-yymmdd-NNNN`과 겹치지 않는 접두사를 쓴다. 번호 구간은 프로젝트 `numberingBase` 체계 적용 여부를 검토한다. |
| 프로젝트 없음 | `projectId` | 이관 시 대상 프로젝트를 정해야 한다. |
| `title`, `steps_to_repro`, `menu_name`, `screen_name`, `screen_url`, `env_info` | 같은 이름의 문자열 컬럼 | 길이 제한은 255/TEXT를 유지한다. |
| `test_type`, `severity`, `priority`, `status`, `defect_identification` | 공통코드 참조(`...CodeId`) 또는 enum | 상태는 전이 규칙을 둘지 정해야 한다. |
| `creator`, `assignee`(이름) | `createdBy`, `assigneeUserId` + 이름 스냅샷 | 이관 시 이름 → 사용자 매핑이 필요하다. |
| `action_comment`, `action_due_date`, `action_start`, `action_end` | 같은 의미의 컬럼 | 조치자·관리자만 수정. |
| `screenshot` | 증적 파일 테이블(`DefectEvidence`) | base64를 파일로 변환. 단위테스트 증적 저장소 재사용. |
| `is_deleted` | `isActive` | 논리 삭제. |
| `defect_history` | `DefectHistory`(INSERT 전용) | 변경 필드 diff와 상태 전후를 저장. |
| `app_settings`(활성 테스트구분) | 프로젝트별 설정 또는 공통코드의 `isActive` | |
| `defect_save_error_logs` | 별도 테이블 또는 `AuditLog` 활용 여부 결정 | 외부 위젯 연동을 유지할 때만 필요. |
| `auth_sessions`, `users`, 로그인 | **이식하지 않음** | pmotools 인증(NextAuth)을 사용. |

### 4.2 역할 매핑 (안)

- 테스터 → 프로젝트 구성원(`MEMBER`)
- 조치자 → 프로젝트 구성원 중 조치 권한이 부여된 직무(직무 권한 모델에 `defect 조치` 권한을 추가할지 결정)
- 관리자 → `ADMIN`·`SUPER_ADMIN`(기존 단위테스트의 관리자 권한 확대 방침과 일치)

### 4.3 화면·API (안)

- `/mp-defects`: 목록(필터·페이징·결함번호 복사·엑셀), `/mp-defects/new`, 결함 상세·수정, 통계(대시보드), 조치자 현황, 조치 재확인.
- 메뉴: `AppNavigation`에 그룹 추가, 메뉴 노출 설정에 등록.
- API: `/api/v1/mp/defects/*`(기존 `/api/v1/mp/ut/*`의 라우팅·권한 패턴 사용).
- 통계: 이미 만든 `mp-ut/stats`의 표·막대 구성 패턴을 재사용.

### 4.4 캡처·외부 연동

- 이미지는 base64 JSON 대신 `multipart/form-data` 업로드로 받아 증적 저장소에 파일로 저장한다.
- Chrome 확장은 `manifest.json`의 호스트·열기 주소를 pmotools 주소와 등록 경로로 바꾼다. 현재 확장은 `http://127.0.0.1:3000/?mode=standalone#register`를 연다.
- 위젯은 외부 사이트에서 `window.open` + `postMessage`(`DEFECTFLOW_READY`/`DATA`/`CLOSE`)로 데이터를 넘기는 구조다. 새 구조에서는 **허용 출처 목록 검사**, 메시지 스키마 검증, 로그인 세션 확인(요청 위조 방지)을 새로 설계해야 한다.
- 배포 환경 제약: 증적 저장소는 서버 디스크 전제(`UT_EVIDENCE_ROOT`)라 Vercel 같은 서버리스에서는 쓸 수 없다. 운영 환경을 확인해야 한다.

### 4.5 단계와 대략 공수 (1인 기준, 참고용)

| 단계 | 내용 | 공수 |
|---|---|---|
| 1 | 설계 확정(5장 결정, 스키마·권한 설계서) | 1~2일 |
| 2 | 스키마·마이그레이션·공통코드 시드·표시 ID·권한 | 3~4일 |
| 3 | 결함 등록·수정·목록·이력·엑셀 | 6~8일 |
| 4 | 통계(대시보드)·조치자 현황·조치 재확인 | 3~4일 |
| 5 | 캡처 파일 저장·위젯/확장 연동·출처 검사 | 4~6일 |
| 6 | 데이터 이관 스크립트(결함 328건, 사용자 43명, 공통코드 163건) | 2~3일 |
| 7 | 테스트(단위·통합·e2e)·문서·전환 | 3~4일 |
| 합계 | | **약 22~31일** |

이관 범위가 설정·테스트 벤치·매뉴얼까지 넓어지면 늘어난다. 정밀한 산정은 설계 확정 후에 해야 한다.

### 4.6 데이터 이관

- 대상(상태 파일 기준): 결함 328건(`defect_history`는 0건), 사용자 43명, 공통코드 163건, `app_settings` 1건, 오류 로그 21건.
- 결함의 `creator`/`assignee` 이름을 사용자 id로 매핑한다. 동명이인, 이름이 바뀐 사용자, 사용자 목록에 없는 이름은 **사람이 확인할 목록**으로 따로 뽑는다.
- `screenshot`이 base64인 건은 파일로 변환해 증적으로 저장하고, URL 형식 값은 그대로 보존한다.
- 사용자는 이메일 기준으로 기존 pmotools 사용자와 먼저 대조한다.
- 이관은 쓰기 전에 대상 건수·충돌 목록을 보고하고 **승인 후** 실행한다. 이관 전 원본·대상 DB를 백업한다.
- 운영 DB(Vercel/Supabase)는 별도 승인 후에만 적용한다.

---

## 5. 정해야 할 사항

1. **프로젝트 귀속:** defect_manage2의 결함·사용자를 pmotools의 어느 프로젝트(하위 프로젝트)에 넣을지.
2. **역할 매핑:** 테스터·조치자·관리자를 pmotools 역할·직무와 어떻게 맞출지. 조치자 권한을 직무 권한 모델에 추가할지.
3. **`ut_defects`와의 관계:** 별개 모듈로 두고 장기 통합은 나중에 검토할지(권고), 처음부터 통합할지.
4. **외부 위젯·확장 프로그램:** 계속 사용할지, 사용한다면 전환 방식(주소 교체 시점)과 보안 요구사항.
5. **배포 환경:** 증적 파일 저장이 가능한 환경(내부 서버)인지, 서버리스인지.
6. **병행·전환 일정:** 기존 서버의 읽기 전용 전환 시점, 데이터 이관 시점.
7. **상태 전이 규칙:** 현재는 권한만 검사한다. 새 모듈에서 전이 규칙(예: Open → In Progress → Resolved → Staging → Closed, Reopened)을 둘지.
8. **이관 범위:** 설정, 오류 로그, 사용자 매뉴얼, 테스트 벤치 페이지를 옮길지.

## 6. 위험

| 위험 | 영향 | 대응 |
|---|---|---|
| 이름 문자열 → 사용자 id 매핑 불일치 | 결함의 등록자·담당자가 틀리게 연결됨 | 이관 전 불일치 목록을 만들어 사람이 확정 |
| base64 이미지 변환 | 대용량·손상 이미지, 저장소 용량 | 변환 전 건수·크기 점검, 실패 목록 보존 |
| 외부 위젯 보안 | 출처 위장, 요청 위조 | 출처 허용 목록, 메시지 스키마 검증, 인증 세션 확인 |
| 병행 운영 중 데이터 불일치 | 두 시스템에 결함이 갈라짐 | 전환 시점에 기존 서버를 읽기 전용으로 전환 |
| 프런트 전체 재작성 | 기능 누락 | 이 문서 1.4의 기능 목록을 인수 체크리스트로 사용 |
| 서버리스 배포 | 파일 저장 불가 | 배포 환경 확정(5장 5번) 후 저장소 방식 결정 |

---

## 7. 다음 단계

1. 5장 결정 사항을 하나씩 확정한다.
2. 확정 내용으로 스키마·화면·권한 설계서를 만든다(`docs/단위테스트 수행관리 프로그램 설계서.md`와 같은 형식 권장).
3. 설계 승인 후 구현에 착수한다. DB 스키마 변경·데이터 이관은 각각 리스크를 보고하고 승인을 받은 뒤 진행한다(`CLAUDE.md`).
