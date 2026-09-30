# Supabase Migration Handover Document

> **작성자**: Rick Deckard (Enterprise SI Strategic PMO)
> **대상자**: 차기 마이그레이션 담당 에이전트 (Dev/Ops Agent)
> **문서 목적**: 로컬 PostgreSQL 데이터를 클라우드(Supabase)로 이관하기 위한 아키텍처 및 메타데이터 인계

---

## 1. 개요 (Overview)
- **Current State**: `pmotools` 내부망 서비스 종료 예정. 로컬 DB(localhost:55432)에 프로덕션 실데이터가 축적되어 있음.
- **To-Be State**: 차주 클라우드 서비스 오픈을 위해 Supabase Managed Postgres 인스턴스로 전체 데이터 이관(Cutover).
- **작업 원칙**: Supabase 내부 관리 스키마(`auth`, `storage`, `realtime` 등)를 건드리지 않기 위해 **오직 `public` 스키마만 정밀 타겟팅**하여 이관해야 함.

## 2. 백업 파일 자산 (Backup Assets)
- **덤프 파일 위치**: `d:\workspace\pmotools\docs\local_full_backup.sql`
- **덤프 방식**: `pg_dump --schema=public --no-owner --no-privileges --clean --if-exists`
- **특징**: 스키마(DDL) 생성 및 데이터(INSERT) 쿼리가 모두 포함되어 있으며, 기존 `public` 스키마의 테이블을 `DROP`하고 새로 생성하므로 클라우드 DB 초기화 시 멱등성(Idempotency)이 보장됨.

## 3. 데이터베이스 및 테이블 스펙 (Database Architecture)
본 시스템은 Prisma ORM 기반으로 설계되었으며, 주요 엔티티 그룹은 다음과 같습니다.

### 3.1. 인증 및 조직 (Auth & Org)
- `users`: 로그인 사용자 마스터
- `groups`: 조직/업무 그룹 통합 마스터 (Work Module / Company)
- `user_group_map`: 사용자-그룹 다대다 매핑
- `project_members`: 프로젝트 투입 인력 매핑

### 3.2. 프로젝트 및 기준정보 (Project & Master Data)
- `projects`: 프로젝트 마스터 (Tree 계층 구조)
- `common_code_groups` / `common_codes`: 시스템 전역 공통코드 (유형, 상태값 등)
- `holidays`: 휴일/공휴일 캘린더

### 3.3. 핵심 업무 모듈 (Core Modules)
- **이슈 관리**: `issues`, `issue_progress_entries`, `issue_report_lines`
- **요구사항 관리**: `requirements`, `requirement_changes`, `requirement_events`
- **업무 일지**: `work_logs`
- **WBS (작업분류체계)**: `wbs_items`, `wbs_assignments`, `wbs_item_events`
- **회의록 / 회의실**: `meeting_minutes`, `meeting_rooms`, `meeting_reservations`
- **PMO 통합 관제**: `management_tasks`, `action_items`, `pmo_daily_snapshots`

*(상세 제약조건 및 연관관계는 `d:\workspace\pmotools\prisma\schema.prisma` 참조 요망)*

---

## 4. 차기 에이전트 행동 지침 (Action Items for Next Agent)

담당 에이전트는 사용자가 제시하는 Supabase 접속 정보(`DATABASE_URL`)를 인계받은 뒤, 다음 절차를 수행해야 합니다.

1. **연결 문자열 확인**: `postgresql://postgres.[프로젝트ID]:[비밀번호]@aws-0-[리전].pooler.supabase.com:6543/postgres` 형태인지 검증.
2. **데이터 이관 실행 (psql)**:
   ```cmd
   "C:\Program Files\PostgreSQL\18\bin\psql.exe" "[Supabase_Connection_String]" -f "d:\workspace\pmotools\docs\local_full_backup.sql"
   ```
3. **무결성 검증 (Health Check)**:
   - 복원 직후 `users` 테이블과 `wbs_items` 테이블의 Count를 조회하여 로컬과 동일한지 확인.
   - 쿼리 예시: `SELECT 'users', count(*) FROM users UNION ALL SELECT 'wbs_items', count(*) FROM wbs_items;`
4. **환경변수 스위칭**:
   - 로컬 `pmotools` 및 `pmotools_admin`의 `.env.local` 혹은 `.env` 내 `DATABASE_URL`을 Supabase 주소로 갱신하여 클라우드망을 바라보도록 셋업.
