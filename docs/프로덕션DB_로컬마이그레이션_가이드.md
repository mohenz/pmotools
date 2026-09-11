# 프로덕션 DB → 로컬 마이그레이션 가이드

- 작성일: 2026-09-11
- 대상: 다른 PC에서 프로덕션(Supabase) 데이터를 로컬 개발 DB로 그대로 복사하고 싶을 때
- 실행 스크립트: `scripts/migrate-prod-to-local.ps1`

## 무엇을 하는 스크립트인가

프로덕션 Postgres(Supabase)를 `pg_dump`로 **읽기만** 하고, 그 결과를 로컬 개발 DB(`localhost:55432`의 `mydb`)에 복원한다. 복원은 `--clean --if-exists` 덤프를 쓰므로 **로컬 DB의 기존 데이터는 전부 사라지고 프로덕션과 동일한 스키마·데이터로 대체된다.** 프로덕션 쪽은 절대 쓰지 않는다(SELECT만 수행).

## 사전 준비

1. **로컬 개발 환경**: 이 저장소 루트의 `setup.cmd`를 먼저 실행해 로컬 PostgreSQL 18과 `.env`(로컬 `DATABASE_URL`)가 준비돼 있어야 한다. (이미 돼 있다면 건너뛴다.)
2. **Vercel CLI 설치·로그인**: `npm i -g vercel` → `vercel login`
3. **프로젝트 연결**: 저장소 루트에서 `vercel link` (Vercel 조직/프로젝트 `mohenzs-projects/pmotools` 선택)
4. **프로덕션 연결정보 받기**: `vercel env pull .env.local` — 이 명령이 `POSTGRES_URL_NON_POOLING` 등 프로덕션 Supabase 값을 `.env.local`에 채워준다. 스크립트는 이 파일에서 값을 읽는다.

## 실행

```powershell
powershell -ExecutionPolicy Bypass -File scripts/migrate-prod-to-local.ps1
```

실행하면:
1. `.env.local`의 `POSTGRES_URL_NON_POOLING`(프로덕션)과 `.env`의 `DATABASE_URL`(로컬)을 읽는다.
2. **안전장치**를 확인한다 — 복원 대상이 `localhost:55432`가 아니면 즉시 중단한다. (프로덕션에 실수로 복원하거나, 설정이 꼬여 엉뚱한 곳에 `--clean`이 실행되는 사고를 막기 위함.)
3. 진행 여부를 묻는다(`yes` 입력 필요). 확인 없이 바로 실행하려면 `-Force` 옵션을 쓴다.
4. 로컬 Postgres를 기동한다.
5. 프로덕션을 덤프한다(`.local-postgres/prod_dump_*.sql`, 이 폴더는 `.gitignore`에 포함돼 있어 실수로 커밋되지 않는다).
6. 로컬에 복원한다.
7. `users`/`wbs_items`/`issues` 건수를 출력해 실제로 데이터가 들어왔는지 보여준다.
8. 덤프 파일을 지운다(`-KeepDump`로 보존 가능, 단 프로덕션 실데이터이므로 보존 시 취급 주의).

완료 후 `npm run local`로 로컬 서버를 띄워 실제 데이터가 보이는지 확인한다.

## 옵션

| 옵션 | 설명 |
|---|---|
| `-Force` | 확인 프롬프트 생략(자동화용) |
| `-KeepDump` | 완료 후 덤프 파일(.sql)을 삭제하지 않고 남김 |
| `-ProductionUrl <url>` | `.env.local` 대신 직접 프로덕션 연결문자열을 지정 |

## 안전장치 상세

- 복원 대상 호스트가 `localhost`/`127.0.0.1`이 아니면 중단
- 복원 대상 포트가 로컬 개발 표준 포트(`55432`)가 아니면 중단
- 원본(프로덕션) 주소가 `localhost`면 중단(프로덕션 연결정보를 잘못 읽었다는 뜻)
- 화면·로그에는 연결문자열의 비밀번호를 `****`로 가려서만 출력

## 주의사항

- **로컬 DB에 프로덕션의 실제 사용자·업무 데이터가 그대로 들어온다.** 외부 공유, 스크린샷, 커밋 금지.
- 재실행할 때마다 로컬 데이터는 그 시점의 프로덕션 스냅샷으로 **완전히 교체**된다 — 로컬에서만 만든 테스트 데이터가 있다면 이 스크립트 실행 전에 백업해 둘 것.
- `.env.local`의 `POSTGRES_URL_NON_POOLING`은 프로덕션 접근 권한이 있는 민감한 값이다. 이 파일 자체도 `.gitignore` 대상이니 커밋하지 않는다.

## 문제 해결

| 상황 | 조치 |
|---|---|
| "프로덕션 연결정보를 찾을 수 없습니다" | `vercel link` → `vercel env pull .env.local` 순서로 다시 실행 |
| "복원 대상이 localhost가 아닙니다" | `.env`의 `DATABASE_URL`이 로컬을 가리키는지 확인(`setup.cmd`가 만든 값 그대로인지) |
| `pg_dump` 실패(연결 오류) | `.env.local`의 `POSTGRES_URL_NON_POOLING` 값이 만료되지 않았는지, 네트워크·방화벽이 Supabase 접속을 막고 있지 않은지 확인 |
| 복원 중 오류로 중단 | 로컬 DB가 일부만 반영된 상태일 수 있음 — 다시 실행하면 `--clean`이 남은 것까지 정리하고 처음부터 다시 반영한다 |
