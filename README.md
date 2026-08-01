# Project Tool

프로젝트 이슈·리스크를 등록하고 추적하는 PMO 웹 애플리케이션입니다. 현재 개발 단계는 로컬 PostgreSQL 기반 첫 수직 기능입니다.

## 현재 구현

- PostgreSQL 16 전용 로컬 인스턴스와 재실행 가능한 SQL migration
- 프로젝트, 사용자, 권한, Track, 이슈·리스크, 업무 이력, 감사 로그 스키마
- 서버 기반 대시보드 집계와 3영업일 정체 판정
- 전체 목록 검색/필터
- 이슈·리스크 등록 API와 화면
- 에스컬레이션 레벨 서버 계산
- 대시보드 지표·매트릭스·유형별 현황에서 조건별 목록 이동
- 목록 페이지네이션, 상세 조회, CSV 내보내기
- 기본 정보, 상태, 에스컬레이션 레벨 변경
- 코멘트와 전체 변경 이력
- 낙관적 잠금을 통한 동시 수정 충돌 방지
- PM 이상 권한의 항목 보관 처리
- 코드 그룹 마스터와 그룹별 소속 코드 통합 관리
- 유형·관련 Track·에스컬레이션 레벨 시스템 그룹 설정
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
- PostgreSQL: `127.0.0.1:54326`

`npm run local`은 필요한 경우 프로젝트 전용 DB를 생성하고 모든 migration을 적용한 뒤 웹 서버를 실행합니다. 로컬 비밀번호와 데이터는 Git에서 제외됩니다.

## 주요 명령

```powershell
npm.cmd run db:setup
npm.cmd run db:stop
npm.cmd run dev
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

## 다음 개발 범위

- Supabase Auth/RLS 어댑터
- Supabase migration 호환성 검증
- Vercel Preview/Production 환경 분리
