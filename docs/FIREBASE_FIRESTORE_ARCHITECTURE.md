# PMO CONTROL Firebase·Firestore 아키텍처

## 현재 운영 기준

- 웹 프레임워크: Next.js 15
- 호스팅: Firebase App Hosting
- 데이터베이스: Cloud Firestore 명명 데이터베이스 `projectmgmtdb`
- 서버 접근: Firebase Admin SDK와 App Hosting 기본 서비스 계정
- 데이터 접근 경로: 브라우저 → Next.js Server Component/Route Handler → Firestore
- 인증·권한: 업무 기능 완성 후 Firebase Authentication과 역할 기반 권한 적용

## 데이터 구조

업무 데이터는 프로젝트 문서 아래의 하위 컬렉션으로 분리합니다.

```text
profiles/{userId}
projects/{projectId}
  members/{userId}
  commonCodeGroups/{groupId}
  commonCodes/{codeId}
  items/{itemId}
  itemEvents/{eventId}
  calendarEvents/{eventId}
  weeks/{weekId}
  weeklyReports/{reportId}
  weeklyProgress/{progressId}
  staffChanges/{changeId}
  auditLogs/{logId}
  meta/itemSequence
```

현재 쿼리는 프로젝트 하위 컬렉션을 읽은 후 서버에서 조합·필터링합니다. 따라서 별도 복합 인덱스가 필요하지 않습니다. 데이터량 증가 시 화면별 조회 패턴을 기준으로 Firestore 쿼리와 복합 인덱스를 추가합니다.

## 환경변수

| 변수 | App Hosting 값 | 용도 |
|---|---|---|
| `FIRESTORE_DATABASE_ID` | `projectmgmtdb` | 명명 Firestore 데이터베이스 선택 |
| `DEFAULT_PROJECT_ID` | `20000000-0000-4000-8000-000000000001` | 인증 도입 전 기본 프로젝트 |
| `LOCAL_USER_ID` | `10000000-0000-4000-8000-000000000001` | 인증 도입 전 기본 사용자 |

`DATABASE_URL`과 Supabase 연결 정보는 애플리케이션에서 사용하지 않습니다. Google Cloud 프로젝트 ID와 인증 정보는 App Hosting 런타임에서 Application Default Credentials로 제공합니다.

## 초기 데이터

기본 프로젝트 문서가 없을 때 최초 서버 요청이 공통코드, 예시 이슈·리스크, 프로젝트 주차와 업무 데이터를 배치 쓰기로 생성합니다. 동일한 프로젝트 ID가 이미 존재하면 초기화를 다시 수행하지 않습니다.

## 배포 확인

1. `npm run lint`
2. `npm test`
3. `npm run build`
4. Firebase App Hosting 배포 완료 확인
5. `/api/health` 응답에서 `provider: firestore`, `databaseId: projectmgmtdb` 확인
6. 통합현황, 이슈 목록, 캘린더와 설정 화면 조회 확인

## 보안 후속 작업

Firebase Authentication 적용 전에는 서버 전용 Admin SDK만 Firestore에 접근합니다. 인증 도입 시 ID 토큰 검증, 프로젝트 멤버십과 역할 검사, 감사 로그의 실제 사용자 기록을 한 작업으로 적용합니다. 클라이언트 SDK 직접 접근을 추가하는 경우에만 해당 권한 모델에 맞는 Firestore Security Rules를 배포합니다.
