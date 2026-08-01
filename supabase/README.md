# Supabase 데이터베이스 준비

현재 애플리케이션은 Supabase Data API가 아니라 서버의 PostgreSQL 연결을 사용합니다. 인증과 RLS를 도입하기 전까지 `project_tool` 스키마는 `anon`, `authenticated` 역할에 공개하지 않습니다.

## 원격 스키마 생성

1. Supabase 프로젝트의 **SQL Editor**를 엽니다.
2. `migrations/20260802000000_initial_pmo_control.sql` 전체를 붙여넣고 한 번 실행합니다.
3. `verify.sql`을 실행해 테이블과 초기 기준정보가 생성됐는지 확인합니다.

초기 스크립트에는 현재 애플리케이션 실행에 필요한 개발용 프로젝트, PMO 사용자, 공통코드와 예시 데이터가 포함되어 있습니다. 비어 있는 운영 데이터로 시작하려면 인증·권한 설계와 함께 별도 운영용 seed를 구성해야 합니다.

## Vercel 연결값

Supabase Dashboard의 **Connect** 화면에서 **Transaction pooler** 연결 문자열을 복사해 Vercel 환경변수 `DATABASE_URL`에 입력합니다. 서버리스 실행을 고려해 다음 값도 함께 설정합니다.

```text
DATABASE_SSL=require
DATABASE_POOL_MAX=3
DATABASE_CONNECTION_TIMEOUT_MS=10000
LOCAL_USER_ID=10000000-0000-4000-8000-000000000001
DEFAULT_PROJECT_ID=20000000-0000-4000-8000-000000000001
```

데이터베이스 비밀번호에 특수문자가 있으면 연결 문자열 안에서 URL 인코딩해야 합니다. 더 엄격한 인증서 검증이 필요하면 Supabase에서 CA 인증서를 내려받아 `DATABASE_SSL=verify-full`, `DATABASE_SSL_CA`를 설정합니다.

## 이후 운영 원칙

- 이 파일을 원격에 적용한 뒤의 스키마 변경은 새 `supabase/migrations/<timestamp>_description.sql` 파일로 관리합니다.
- 인증 전에는 `project_tool`을 Supabase API의 Exposed schemas에 추가하지 않습니다.
- Supabase Auth 적용 시 사용자 연결, RLS 정책, 역할별 권한을 별도 마이그레이션으로 추가합니다.
