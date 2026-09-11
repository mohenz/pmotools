# 📋 pmotools 로컬 개발 환경 구성 & 원격 DB 이행 보고서 (완료)

> **프로젝트**: EPMS 프로젝트관리 시스템 (pmotools)  
> **원격 DB 데이터 이행 완료 일시**: 2026-09-11 11:21:49 KST  
> **총괄 책임**: Rick Deckard (Enterprise SI Strategic PMO Agent)  

---

## 📌 작업 항목 체크리스트

| 번호 | 구분 | 작업 항목 | 세부 내용 | 상태 |
| :---: | :--- | :--- | :--- | :---: |
| 1 | **소스코드** | 저장소 클론 및 환경 정비 | GitHub `mohenz/pmotools` 클론 & 스크립트 인코딩 보완 | **[완료]** |
| 2 | **런타임** | Node.js 설치 | Node.js LTS (v24.19.0) winget 자동 설치 및 PATH 등록 | **[완료]** |
| 3 | **DBMS** | PostgreSQL 18 설치 | PostgreSQL 18.6-3 winget 자동 설치 및 바이너리 검증 | **[완료]** |
| 4 | **DBMS** | PG 로케일 및 패치 조치 | `snowball_create.sql` 패치 & `--locale=C` 호환성 처리 | **[완료]** |
| 5 | **DB 초기화** | DB 클러스터 생성 | `initdb.exe`로 `.local-postgres\data` 클러스터 생성 | **[완료]** |
| 6 | **DB 서비스** | 로컬 Postgres 서비스 기동 | `PostgreSQL-pmotools` 윈도우 서비스(55432 포트) 영속 등록 및 실행 | **[완료]** |
| 7 | **DB 계정** | 데이터베이스 & Role 생성 | Role (`johndoe`) 및 Database (`mydb`) 생성 완료 | **[완료]** |
| 8 | **환경설정** | 환경변수 파일 생성 | `.env` (`DATABASE_URL`) 및 `.env.local` (`AUTH_SECRET`) 구성 완료 | **[완료]** |
| 9 | **의존성** | NPM 패키지 설치 | `npm install` (677개 패키지) 및 `Prisma Client (7.9.1)` 생성 완료 | **[완료]** |
| 10 | **마이그레이션** | Prisma DB 마이그레이션 | 전체 50개 Prisma 스키마 마이그레이션 적용 완료 (`npx prisma migrate deploy`) | **[완료]** |
| 11 | **시드 데이터** | 초기 마스터/계정 시딩 | `npx prisma db seed` 완료 (관리자 계정 `pmo.admin` 생성) | **[완료]** |
| 12 | **원격 DB 이행** | 프로덕션 데이터 덤프 & 복원 | `migrate-prod-to-local.ps1`을 통한 Supabase 덤프 로컬 복원 완료 | **[완료]** |

---

## 🟢 원격 DB 로컬 이행 최종 검증 결과

```sql
   table   | count 
-----------+-------
 users     |    81
 wbs_items |  3418
 issues    |     2
```

* **원격 DB 출처**: Supabase Managed Postgres (`aws-0-us-east-1.pooler.supabase.com:5432`)
* **로컬 타겟 DB**: `localhost:55432` (`mydb`)
* **덤프 용량**: `6.3 MB` (`.local-postgres\prod_dump_20260911_111948.sql`)
* **이행 테이블 데이터**: 사용자 81건, WBS 항목 3,418건, 이슈 2건 등 프로덕션 전체 데이터 완전 이행 완료.

---

## 🔑 접속 및 로컬 실행 안내

* **개발 서버 실행 커맨드**: `npm run local` (또는 `npm run dev`)
* **웹 서비스 접속 주소**: `http://localhost:3020`
* **헬스체크 엔드포인트**: `http://localhost:3020/api/health` ➔ `{"status":"ok","database":"connected","provider":"postgres"}`
