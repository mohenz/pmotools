<#
  pmotools 로컬 개발 환경 1회성 설치 스크립트 (Windows 전용).
  Node.js·PostgreSQL 18 확인/설치(winget) → 로컬 DB 클러스터 초기화 → 앱 전용 역할/DB 생성
  → .env·.env.local 생성 → npm install → prisma migrate deploy → prisma db seed → 개발 서버 실행.
  재실행해도 안전하다 — 이미 끝난 단계는 건너뛴다.
#>
param(
  [switch]$NoLaunch, # 마지막에 개발 서버 자동 실행을 생략
  [switch]$NoSeed    # 시드 데이터 생성을 생략(기존 로컬 데이터를 유지하고 싶을 때)
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Ok($t) { Write-Host "  OK   $t" -ForegroundColor Green }
function Fail($t) { Write-Host "`n설치 중단: $t" -ForegroundColor Red; exit 1 }

# winget 설치가 실제로 필요할 때만 관리자 권한으로 자기 자신을 재실행한다(이미 다 설치돼 있으면 UAC를 띄우지 않는다).
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
function Request-Elevation {
  if ($isAdmin) { return }
  Write-Host "관리자 권한이 필요합니다. UAC 승인 창이 뜨면 허용해 주세요." -ForegroundColor Yellow
  $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath)
  if ($NoLaunch) { $argList += "-NoLaunch" }
  if ($NoSeed) { $argList += "-NoSeed" }
  Start-Process powershell -Verb RunAs -ArgumentList $argList
  exit 0
}

# 1. Node.js 확인
Step "1. Node.js 확인"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { Fail "Node.js가 없고 winget도 사용할 수 없습니다. https://nodejs.org 에서 LTS 버전을 수동 설치한 뒤 다시 실행하십시오." }
  Request-Elevation
  Write-Host "Node.js가 없어 winget으로 설치합니다..."
  winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { Fail "Node.js 설치 실패. https://nodejs.org 에서 LTS 버전을 수동 설치한 뒤 다시 실행하십시오." }
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js 설치 후에도 PATH에서 node를 찾지 못했습니다. 새 터미널을 열어 다시 실행하십시오." }
Ok "node $(node --version)"

# 2. PostgreSQL 18 확인/설치
Step "2. PostgreSQL 18 확인"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
if (-not (Test-Path (Join-Path $pgBin "pg_ctl.exe"))) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { Fail "PostgreSQL 18이 없고 winget도 사용할 수 없습니다. 수동 설치 후 다시 실행하십시오." }
  Request-Elevation
  Write-Host "PostgreSQL 18이 없어 winget으로 설치합니다 (수 분 소요될 수 있습니다)..."
  winget install --id PostgreSQL.PostgreSQL.18 -e --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -ne 0) { Fail "PostgreSQL 18 설치 실패." }
}
if (-not (Test-Path (Join-Path $pgBin "pg_ctl.exe"))) { Fail "PostgreSQL 18 설치 후에도 $pgBin 를 찾지 못했습니다." }
Ok "PostgreSQL 18 ($pgBin)"

# 3. 로컬 DB 클러스터 초기화 (.local-postgres\data, 포트 55432 — scripts/start-local-postgres.ps1과 동일 경로)
Step "3. 로컬 DB 클러스터 초기화"
$data = Join-Path $root ".local-postgres\data"
if (-not (Test-Path (Join-Path $data "PG_VERSION"))) {
  & (Join-Path $pgBin "initdb.exe") -D $data -U postgres -A trust | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "initdb 실패." }
  Ok "클러스터 생성 완료: $data"
} else {
  Ok "이미 초기화됨: $data"
}

# 4. 로컬 Postgres 기동 (기존 스크립트 재사용)
Step "4. 로컬 Postgres 기동"
npm.cmd run db:local:start
if ($LASTEXITCODE -ne 0) { Fail "로컬 Postgres 기동 실패." }

# 5. 앱 전용 역할·DB 생성 (johndoe / mydb — .env의 DATABASE_URL과 정확히 일치해야 함)
# -w(비밀번호 프롬프트 금지)로, 클러스터가 trust가 아닌 비밀번호 인증이면 멈춰 있지 않고 바로 실패한다.
Step "5. 앱 DB·역할 생성"
$psql = Join-Path $pgBin "psql.exe"
$roleExists = (& $psql -w -h localhost -p 55432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='johndoe'") -join ""
if ($LASTEXITCODE -ne 0) { Fail "postgres 슈퍼유저로 접속하지 못했습니다. 클러스터 인증 방식을 확인하십시오(이 스크립트로 새로 초기화한 클러스터는 trust 인증이라 비밀번호가 필요 없어야 합니다)." }
if ($roleExists.Trim() -ne "1") {
  & $psql -w -h localhost -p 55432 -U postgres -d postgres -c "CREATE ROLE johndoe LOGIN PASSWORD 'randompassword';" | Out-Null
  Ok "역할 johndoe 생성"
} else { Ok "역할 johndoe 이미 존재" }
$dbExists = (& $psql -w -h localhost -p 55432 -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='mydb'") -join ""
if ($dbExists.Trim() -ne "1") {
  & (Join-Path $pgBin "createdb.exe") -w -h localhost -p 55432 -U postgres -O johndoe mydb
  if ($LASTEXITCODE -ne 0) { Fail "createdb 실패." }
  Ok "데이터베이스 mydb 생성"
} else { Ok "데이터베이스 mydb 이미 존재" }

# 6. 환경변수 파일 생성 (이미 있으면 손대지 않음)
Step "6. 환경변수 파일 생성"
$envPath = Join-Path $root ".env"
if (-not (Test-Path $envPath)) {
  'DATABASE_URL="postgresql://johndoe:randompassword@localhost:55432/mydb?schema=public"' | Out-File -FilePath $envPath -Encoding utf8
  Ok ".env 생성"
} else { Ok ".env 이미 존재 — 유지" }

$envLocalPath = Join-Path $root ".env.local"
if (-not (Test-Path $envLocalPath)) {
  $bytes = New-Object byte[] 32
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secret = [Convert]::ToBase64String($bytes)
  "AUTH_SECRET=$secret" | Out-File -FilePath $envLocalPath -Encoding utf8
  Ok ".env.local 생성 (이 PC 전용 신규 AUTH_SECRET — 운영 계정과 무관)"
} else { Ok ".env.local 이미 존재 — 유지" }

# 7. 의존성 설치 (postinstall이 prisma generate까지 실행)
Step "7. npm install"
npm.cmd install
if ($LASTEXITCODE -ne 0) { Fail "npm install 실패." }

# 8. 마이그레이션 적용 — 이 프로젝트는 항상 migrate deploy만 쓴다(migrate dev는 기존 시딩 마이그레이션이
#    빈 shadow DB에서 FK 위반을 일으켜 항상 실패한다. production vercel-build도 동일한 방식).
Step "8. 마이그레이션 적용"
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Fail "prisma migrate deploy 실패." }

# 9. 시드 데이터 (관리자 계정 등 초기 데이터)
if (-not $NoSeed) {
  Step "9. 시드 데이터"
  npx prisma db seed
  if ($LASTEXITCODE -ne 0) { Fail "prisma db seed 실패." }
} else {
  Step "9. 시드 데이터 (건너뜀: -NoSeed)"
}

Write-Host "`n설치 완료." -ForegroundColor Green
Write-Host "관리자 로그인: pmo.admin / ChangeMe!2026 (최초 로그인 후 반드시 비밀번호를 변경하십시오)"
Write-Host "주소: http://localhost:3020"

# 10. 개발 서버 실행
if (-not $NoLaunch) {
  Step "10. 개발 서버 실행"
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$root`"; npm run local"
  Start-Sleep -Seconds 3
  Start-Process "http://localhost:3020"
} else {
  Write-Host "다음 명령으로 개발 서버를 실행하십시오: npm run local"
}
