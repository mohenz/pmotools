# 개발 환경 셋업 및 데이터베이스 접속 가이드

## 1. 소스 코드 클론 (Git Clone)

내부 형상관리(Gitea) 서버에 접속하여 `pmotools` 및 `pmotools_admin` 저장소를 클론합니다. 인증 정보가 포함된 URL을 사용하거나 인증 창에서 입력할 수 있습니다.

**pmotools 저장소**
```bash
git clone http://pmoadmin:adminadmin@127.0.0.1:3000/PMO/pmotools.git
```

**pmotools_admin 저장소**
```bash
git clone http://pmoadmin:adminadmin@127.0.0.1:3000/PMO/pmotools_admin.git
```
> [!NOTE]
> `127.0.0.1` 및 포트 `3000`은 로컬 인프라 스택 구동 기준입니다. 실제 내부망 서버 IP가 별도로 존재할 경우 해당 IP로 치환하여 사용해야 합니다.

## 2. 데이터베이스 접속 가이드 (DBeaver 기준)

개발 PC에서 내부 데이터베이스(PostgreSQL)에 접속하기 위한 연결 정보입니다.
해당 정보는 `setup.cmd` 실행 시 자동 구성되는 개발 DB 환경 기준입니다.

### 2.1. 데이터베이스 연결 정보
| 항목 | 값 | 비고 |
|---|---|---|
| **DBMS** | PostgreSQL | |
| **Host** | `127.0.0.1` | 로컬 또는 지정된 내부망 IP |
| **Port** | `55432` | |
| **Database** | `mydb` | |
| **Schema** | `public` | |
| **Username** | `johndoe` | |
| **Password** | `randompassword` | |

### 2.2. DBeaver 접속 설정 절차
1. DBeaver 실행 후 상단 메뉴에서 플러그 아이콘 **[새 연결(New Database Connection)]** 클릭
2. 데이터베이스 목록에서 **PostgreSQL** 선택 후 **[다음]** 클릭
3. **Main 탭(또는 General 탭)** 에 아래 정보 입력:
   - **Host**: `127.0.0.1`
   - **Port**: `55432`
   - **Database**: `mydb`
   - **Username**: `johndoe`
   - **Password**: `randompassword`
4. 화면 하단의 **[Test Connection]** 버튼을 클릭하여 정상 연결(Connected) 상태 확인
5. 확인 완료 후 **[완료(Finish)]** 버튼을 클릭하여 접속 구성 저장

> [!WARNING]
> 보안 정책에 따라 상기 정보는 오직 **로컬 개발 및 테스트 목적**으로만 사용됩니다. 운영 환경(Production)의 `DATABASE_URL` 정보는 환경 변수(`.env.production`)를 통해 런타임에 주입되며, 개발자에게 직접 노출되거나 Git에 커밋되어서는 안 됩니다.
