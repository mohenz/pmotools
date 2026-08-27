# 04. API 설계 (REST)

권한 표기: `M`=일반사용자, `O`=운영자, `A`=관리자 (상위 권한은 하위 권한 포함)

## 1. 인증 / 계정

| Method | Endpoint | 설명 | 권한 |
|---|---|---|---|
| POST | `/api/auth/signup` | ID/이름/비밀번호로 가입 | Public |
| POST | `/api/auth/login` | 로그인 (Auth.js Credentials) | Public |
| POST | `/api/auth/logout` | 로그아웃 | M |
| POST | `/api/users/me/password` | 본인 비밀번호 변경(기존 PW 확인) | M |
| PATCH | `/api/users/me` | 내 정보 수정(이름, 이메일, 테마) | M |
| PATCH | `/api/users/me/theme` | 테마 변경 | M |
| POST | `/api/admin/users/{id}/reset-password` | 관리자 강제 초기화(임시 PW 발급) | A |

## 2. 사용자/그룹 관리

| Method | Endpoint | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/users` | 사용자 목록/검색 | O |
| GET | `/api/users/{id}` | 사용자 상세 | O |
| PATCH | `/api/users/{id}/role` | 역할 변경 | A |
| PATCH | `/api/users/{id}/status` | 계정 잠금/해제 | A |
| GET | `/api/groups` | 그룹 목록 (조직/업무그룹) | M |
| POST | `/api/groups` | 그룹 생성 | A |
| PATCH | `/api/groups/{id}` | 그룹 수정(색상 포함) | A |
| POST | `/api/groups/{id}/members` | 그룹원 추가/제거 | A |

## 3. 프로젝트

| Method | Endpoint | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/projects` | 프로젝트 목록 | M |
| POST | `/api/projects` | 프로젝트 생성 (기간/오픈일자 포함) | A |
| PATCH | `/api/projects/{id}` | 프로젝트 정보 수정 | A |

## 4. 일정(이벤트)

| Method | Endpoint | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/events?view=month&date=2026-08&projectId=` | 뷰별 일정 조회(반복 규칙 서버 전개 후 반환) | M |
| GET | `/api/events/milestones` | 주요 이벤트 모아보기(상 우선순위/마일스톤) | M |
| GET | `/api/events/search?q=&from=&to=&priority=&groupId=&assigneeId=` | 검색/필터 | M |
| GET | `/api/events/{id}` | 상세 | M |
| POST | `/api/events` | 등록(담당자/업무그룹 다중 지정 포함) | O |
| PATCH | `/api/events/{id}` | 수정 (`?scope=all|single`로 반복 일정 단일회차 예외 처리) | O |
| DELETE | `/api/events/{id}` | 삭제 (`?scope=all|single`) | O |
| POST | `/api/events/{id}/attachments` | 첨부파일 업로드 | O |

## 5. 엑셀

| Method | Endpoint | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/excel/export?month=2026-08&projectId=` | 월단위 일정 엑셀 다운로드 | O |
| POST | `/api/excel/import/validate` | 업로드 파일 검증(Dry-run, 오류 리포트 반환) | O |
| POST | `/api/excel/import` | 검증 통과 후 실제 반영 | O |

## 6. 쪽지

| Method | Endpoint | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/messages?box=received\|sent` | 쪽지함 목록(내용 미포함, 메타만) | M |
| POST | `/api/messages` | 쪽지 발송(수신자 검색 포함, 조회 비밀번호 설정) | M |
| POST | `/api/messages/{id}/view` | 조회 비밀번호 검증 후 복호화된 내용 반환 | M |

## 7. 알림

| Method | Endpoint | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/notifications/settings` | 내 알림 설정 조회 | M |
| PATCH | `/api/notifications/settings` | 알림 수신 여부/리마인더 시점 설정 | M |

## 8. 감사 로그

| Method | Endpoint | 설명 | 권한 |
|---|---|---|---|
| GET | `/api/admin/audit-logs?table=&targetId=&from=&to=` | 변경 이력 조회 | A |

## 공통 규칙
- 응답 포맷: `{ data, error, meta }` 통일
- 페이지네이션: `?page=&pageSize=` (기본 20, 목록 API 공통)
- 에러 코드 체계: `AUTH_*`, `EVENT_*`, `PERM_*`, `VALIDATION_*` 프리픽스로 클라이언트 분기 처리 단순화
- 모든 쓰기(Write) API는 서버에서 역할 재검증 + 성공 시 `audit_logs` 기록 (일정/사용자/그룹/비밀번호 초기화 대상)
