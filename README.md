# Project Tool

프로젝트 이슈·리스크와 PMO 업무를 통합 관리하는 Firebase 기반 웹 애플리케이션입니다.

## 현재 구현

- Firebase App Hosting과 Cloud Firestore(`projectmgmtdb`) 기반 서버 데이터 저장
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
- Firebase Admin SDK와 App Hosting 기본 서비스 계정 연결

## 로컬 실행

```powershell
npm.cmd install
npm.cmd run local
```

- 웹: `http://127.0.0.1:3020`
- 공통코드 설정: `http://127.0.0.1:3020/settings/common-codes`
- 상태 확인: `http://127.0.0.1:3020/api/health`
- Firestore 데이터베이스: `projectmgmtdb`

`npm run local`은 개발 서버를 실행합니다. 로컬에서 Firestore에 연결하려면 Google Application Default Credentials 또는 Firestore Emulator를 구성해야 합니다.

## Firestore 준비

Firebase 프로젝트 `projectmgmt-e7dfd`의 Firestore 데이터베이스 ID `projectmgmtdb`를 사용합니다. 최초 요청 시 기준 프로젝트, 공통코드와 예시 업무 데이터가 식별자 기준으로 안전하게 초기화됩니다.

## 주요 명령

```powershell
npm.cmd run local
npm.cmd run dev
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

## 다음 개발 범위

- Firebase Authentication 및 역할 기반 접근 제어
- Firebase App Hosting 환경별 백엔드 분리
- Cloud Firestore 백업·복구 및 보존 정책 확정
