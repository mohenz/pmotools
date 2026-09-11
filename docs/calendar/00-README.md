# 프로젝트 공유 캘린더 — 기획 및 설계 문서

## 문서 목적
100명 이상 사용자가 이메일 ID로 가입하여 사용하는 **프로젝트 일정 공유 캘린더 웹 서비스**의 기획·설계 문서 모음입니다.
로컬(PostgreSQL) 개발 → 클라우드(Supabase + Vercel) 배포를 전제로 작성했습니다.

## 문서 구성

| 순번 | 문서 | 내용 |
|---|---|---|
| 01 | [requirements.md](./01-requirements.md) | 기능 요구사항 정의 (요청 기능 + 추가 제안 기능) |
| 02 | [architecture.md](./02-architecture.md) | 기술 스택, 시스템 구성도, 폴더 구조, 환경 전략 |
| 03 | [database-schema.md](./03-database-schema.md) | ERD 및 테이블 설계 |
| 04 | [api-design.md](./04-api-design.md) | REST API 엔드포인트 설계 |
| 05 | [design-guide.md](./05-design-guide.md) | 반응형 UI/UX 디자인 가이드 (PC/모바일) |
| 06 | [roadmap.md](./06-roadmap.md) | 단계별 개발 로드맵 |

## 프로젝트 한 줄 요약
> 프로젝트 참여 인력(100명+)이 자체 계정으로 로그인하여, 관리자/운영자가 등록한 프로젝트 일정을
> 년/월/주/일 뷰로 확인하고, 주요 이벤트를 모아보고, 검색·엑셀 다운로드·쪽지 등으로 협업하는 사내형 캘린더 서비스

## 핵심 기술 스택 요약
- **Frontend/Backend**: Next.js (App Router, TypeScript) — 단일 레포에서 웹+API 처리, Vercel 배포에 최적화
- **로컬 DB**: PostgreSQL
- **클라우드 DB/Storage**: Supabase (Postgres, Storage, 필요 시 Realtime)
- **ORM**: Prisma (로컬↔Supabase 동일 스키마로 마이그레이션 관리)
- **인증**: Auth.js(NextAuth) Credentials Provider + bcrypt (ID/이름/비밀번호 기반 자체 인증 — Supabase Auth 미사용, 사유는 02번 문서 참고)
- **저장소**: GitHub (레포) → Vercel (자동 배포, Preview/Production 분리)

## 읽는 순서 제안
기획 리뷰 시: `01 → 05 → 06` (무엇을·어떻게 보여줄지·언제 만들지)
개발 착수 시: `02 → 03 → 04` (어떻게 구현할지)
