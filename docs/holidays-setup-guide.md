# 다른 PC에서 DB 만들고 공휴일 데이터 넣기

다른 PC에서 이 저장소를 받아 로컬 DB를 만들고, `holidays` 테이블(국경일·공휴일)을 채우는 절차입니다. 데이터는 [holidays-2026-2027.md](holidays-2026-2027.md)에 있습니다.

`holidays` 테이블은 두 곳에서 쓰입니다.

- 캘린더의 국경일·공휴일 표시 (월간·주간·일간·년간·목록)
- WBS 영업일·지연일 계산 (평일 공휴일은 영업일에서 빠집니다)

## 1. 한 번에 설치하기 (Windows, 권장)

```powershell
git clone https://github.com/mohenz/pmotools.git
cd pmotools
powershell -ExecutionPolicy Bypass -File scripts\setup-new-pc.ps1 -NoLaunch
```

`scripts/setup-new-pc.ps1`이 아래를 자동으로 합니다. 이미 끝난 단계는 건너뛰므로 다시 실행해도 안전합니다.

1. Node.js와 PostgreSQL 18 확인 (없으면 winget으로 설치)
2. 로컬 DB 클러스터 초기화 (`.local-postgres/data`, 포트 55432)
3. 앱 전용 역할과 DB 생성, `.env`·`.env.local` 생성
4. `npm install` (`prisma generate` 포함)
5. `prisma migrate deploy` (테이블 생성)
6. `prisma db seed` (관리자 계정 등 초기 데이터)

회사 정책으로 PowerShell 스크립트가 막히면 2번의 수동 절차를 따르세요.

## 2. 수동으로 설치하기

PostgreSQL 18과 Node.js가 설치되어 있어야 합니다. PostgreSQL 설치 경로가 `C:\Program Files\PostgreSQL\18\bin`이 아니면 환경변수 `PG_BIN`으로 지정하세요.

```bash
git clone https://github.com/mohenz/pmotools.git
cd pmotools
npm install

# 로컬 DB 클러스터가 없으면 한 번만 초기화 (포트 55432는 start 스크립트가 지정)
"C:\Program Files\PostgreSQL\18\bin\initdb.exe" -D .local-postgres/data -U postgres -A trust --locale=C --encoding=UTF8
npm run db:local:start

# 앱 전용 역할·DB 생성: 이름과 비밀번호는 scripts/setup-new-pc.ps1의 5단계와 똑같이 맞춥니다.
# .env의 DATABASE_URL도 같은 값이어야 합니다 (setup-new-pc.ps1의 6단계 참고).

npx prisma migrate deploy      # 테이블 생성 (migrate dev는 쓰지 않습니다)
npx prisma db seed             # 초기 데이터
```

## 3. 공휴일 데이터 넣기

DB와 테이블이 준비된 뒤 실행합니다. 두 방법 중 하나를 고르세요.

### 방법 A. md 파일에서 넣기 (인터넷·인증키 불필요, 권장)

```bash
# 미리보기: DB를 바꾸지 않고 추가·갱신될 행만 보여 줍니다.
npx tsx scripts/sync-holidays.ts --file docs/holidays-2026-2027.md

# 반영
npx tsx scripts/sync-holidays.ts --file docs/holidays-2026-2027.md --apply
```

### 방법 B. 공공데이터 API에서 직접 받기 (다른 연도 추가 시)

한국천문연구원 특일 정보 API를 호출합니다. 공공데이터포털(data.go.kr)에서 "한국천문연구원_특일 정보" 활용 신청 후 받은 일반 인증키가 필요합니다. 인증키는 저장소에 넣지 말고 `.env.local`에만 둡니다 (`.env*`는 git에서 제외됩니다).

```bash
# .env.local
DATA_GO_KR_SERVICE_KEY=발급받은_일반_인증키

# 연도를 지정해 실행 (기본은 미리보기, --apply를 붙이면 반영)
npx tsx scripts/sync-holidays.ts 2028
npx tsx scripts/sync-holidays.ts 2028 --apply
```

새 연도를 받은 뒤에는 `docs/holidays-2026-2027.md`와 같은 형식의 md 파일로 정리해 두면 다른 PC에서 방법 A로 넣을 수 있습니다.

### 스크립트 동작

- 전사 공통(`projectId` 비움) 휴일로 넣습니다.
- 없는 날짜는 추가하고, 이름이 바뀐 날짜는 갱신합니다.
- 파일이나 API에 없는 기존 행은 삭제하지 않습니다. 실행 결과에 "DB에만 있음"으로 표시만 합니다.
- 다시 실행해도 같은 결과입니다. 이미 있는 행은 "동일"로 건너뜁니다.

## 4. 확인

```bash
npx tsx scripts/sync-holidays.ts --file docs/holidays-2026-2027.md
```

마지막 줄이 `추가 0 · 갱신 0 · 동일 46`이면 DB와 파일이 일치합니다.

화면에서는 개발 서버를 켠 뒤(`npm run local`, 주소 `http://localhost:3020`) 캘린더에서 2026-09-25(추석) 같은 날짜가 빨간색 날짜와 이름으로 보이는지 확인합니다.

## 5. 주의

- 이미 데이터가 있는 DB(운영·사내 서버 포함)에 넣을 때는 반드시 미리보기를 먼저 실행하세요. 평일 공휴일이 추가되면 해당 기간의 WBS 영업일과 지연일이 달라질 수 있습니다.
- 사내 서버나 Vercel DB에는 그 환경의 `DATABASE_URL`(`.env`)을 설정한 셸에서 같은 명령을 실행합니다.
- md 표의 형식(`| YYYY-MM-DD | 요일 | 이름 |`)을 바꾸지 마세요. 날짜와 이름 열만 읽고 요일 열은 무시합니다.
- 이 데이터는 2026-11-01에 조회한 값입니다. 임시공휴일이 새로 지정되면 방법 B로 다시 받아 md를 갱신하세요.
