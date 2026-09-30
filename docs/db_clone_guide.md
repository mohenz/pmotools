# 로컬 개발 데이터베이스 복제 가이드 (PC 간 DB 이관)

본 문서는 현재 PC(소스, Source)에 구성된 로컬 개발 데이터베이스(`mydb`)를 타 PC(타겟, Target)로 복제(이관)하는 두 가지 절차를 설명합니다.

## 방법 1. 네트워크 직접 연결 방식 (스크립트 활용)

타 PC(타겟)에서 복제 스크립트를 구동하여, 원격으로 이 PC(소스)의 DB에 붙어 데이터를 끌어오는 방식입니다. 

### 1.1. 사전 준비 (소스 PC)
- **방화벽 설정**: 소스 PC(`10.147.148.101`)의 Windows 방화벽 인바운드 규칙에서 PostgreSQL 포트(`55432`) 접속을 허용해야 합니다.
- **로컬 DB 구동**: 소스 PC에서 `npm run db:local:start` 등을 통해 로컬 DB가 켜져 있어야 합니다.

### 1.2. 이행 스크립트 실행 (타겟 PC)
타겟 PC에서 저장소를 클론한 후, 터미널을 열고 아래 명령어를 실행하여 데이터를 이관합니다.

```bash
powershell -ExecutionPolicy Bypass -File scripts\migrate\migrate-prod-to-local.ps1 -ProductionUrl "postgresql://johndoe:randompassword@10.147.148.101:55432/mydb?schema=public" -Force
```

> [!WARNING]
> 타겟 PC의 기존 로컬 DB(`mydb`) 데이터는 모두 초기화되고 소스 PC의 데이터로 완전히 대체됩니다.

---

## 방법 2. 오프라인 덤프/복원 방식 (네트워크 단절 시)

네트워크 방화벽 통제가 엄격하여 포트 오픈이 불가능할 경우, 소스 PC에서 수동으로 백업 덤프(`.sql`)를 추출하여 타겟 PC로 옮긴 후 복원하는 방식입니다.

### 2.1. 데이터 덤프 추출 (소스 PC)
소스 PC의 터미널에서 PostgreSQL `pg_dump` 유틸리티를 사용하여 덤프 파일을 생성합니다.

```bash
# PostgreSQL 18 기준 pg_dump 실행 경로
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" --clean --if-exists --no-owner --no-privileges -U johndoe -d mydb -h 127.0.0.1 -p 55432 -f db_backup.sql
```
*(※ 비밀번호 입력 프롬프트가 나타나면 `randompassword` 입력)*
- 추출된 `db_backup.sql` 파일을 USB 메모리, 사내 메신저, 망연계 솔루션 등을 통해 타겟 PC로 복사합니다.

### 2.2. 데이터 복원 (타겟 PC)
타겟 PC에서 로컬 DB를 구동한 후, 넘겨받은 `db_backup.sql` 파일을 밀어넣어 복원합니다.

```bash
# 타겟 PC에서 psql 실행
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U johndoe -d mydb -h 127.0.0.1 -p 55432 -f db_backup.sql
```
*(※ 비밀번호 입력 프롬프트가 나타나면 `randompassword` 입력)*

> [!TIP]
> 덤프 옵션에 `--clean --if-exists`가 포함되어 있으므로, 복원 시 타겟 PC의 기존 테이블들은 자동으로 삭제된 후 깔끔하게 복원됩니다.
