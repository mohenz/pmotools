<#
  프로덕션(Supabase) WBS·이슈 등 실제 DB를 로컬 개발 DB(mydb, localhost:55432)로 복사한다.
  pg_dump로 프로덕션에서 읽기만 하고(절대 쓰지 않음), 결과를 로컬에 --clean --if-exists로 복원한다 —
  즉 로컬 DB는 이 스크립트 실행 후 프로덕션과 동일한 스키마·데이터로 완전히 대체된다(기존 로컬 데이터는 사라짐).

  사전 준비:
    1) scripts/setup-new-pc.ps1 (또는 최소한 로컬 PostgreSQL 18 설치)이 이미 되어 있어야 한다.
    2) 이 PC에서 `vercel link`로 프로젝트를 연결한 뒤 `vercel env pull .env.local`을 실행해 프로덕션
       연결정보(POSTGRES_URL_NON_POOLING)를 받아둔다. (Vercel 계정에 프로젝트 접근 권한 필요)

  사용법:
    powershell -ExecutionPolicy Bypass -File scripts/migrate-prod-to-local.ps1
    powershell -ExecutionPolicy Bypass -File scripts/migrate-prod-to-local.ps1 -Force   # 확인 프롬프트 생략
#>
param(
  [string]$ProductionUrl,  # 생략하면 .env.local의 POSTGRES_URL_NON_POOLING을 읽는다
  [switch]$Force,          # 확인 프롬프트 없이 바로 진행 (스크립트 자동화용)
  [switch]$KeepDump        # 완료 후 덤프 파일을 지우지 않고 남겨둔다
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Ok($t) { Write-Host "  OK   $t" -ForegroundColor Green }
function Fail($t) { Write-Host "`n중단: $t" -ForegroundColor Red; exit 1 }

function Get-EnvValue([string]$path, [string]$key) {
  if (-not (Test-Path $path)) { return $null }
  $line = Get-Content $path | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  $value = ($line -replace "^\s*$key\s*=\s*", "").Trim()
  if ($value.StartsWith('"') -and $value.EndsWith('"')) { $value = $value.Substring(1, $value.Length - 2) }
  return $value
}

function Mask([string]$url) {
  # 비밀번호만 가려서 출력용으로 쓴다 — 로그·화면에 원본 연결문자열을 남기지 않는다.
  return ($url -replace '://([^:]+):([^@]+)@', '://$1:****@')
}

# 1. 연결정보 확인
Step "1. 연결정보 확인"
if (-not $ProductionUrl) { $ProductionUrl = Get-EnvValue (Join-Path $root ".env.local") "POSTGRES_URL_NON_POOLING" }
if (-not $ProductionUrl) { Fail "프로덕션 연결정보를 찾을 수 없습니다. 먼저 'vercel link' 후 'vercel env pull .env.local'을 실행하십시오." }
$localUrl = Get-EnvValue (Join-Path $root ".env") "DATABASE_URL"
if (-not $localUrl) { Fail ".env에서 DATABASE_URL을 찾을 수 없습니다. 먼저 scripts/setup-new-pc.ps1을 실행하십시오." }

$prodUri = [Uri]$ProductionUrl
$localUri = [Uri]$localUrl

# 2. 안전장치 — 대상이 반드시 로컬이어야 한다. 실수로 프로덕션에 프로덕션을 복원하거나,
#    로컬 설정이 잘못 꼬여 원격을 가리키는 상태에서 --clean(DROP)이 실행되는 걸 막는다.
Step "2. 안전장치 확인"
if ($localUri.Host -notin @("localhost", "127.0.0.1")) { Fail "복원 대상이 localhost가 아닙니다 ($($localUri.Host)) — 프로덕션에 실수로 복원하는 것을 막기 위해 중단합니다." }
if ($localUri.Port -ne 55432) { Fail "복원 대상 포트가 55432(로컬 개발 DB 표준 포트)가 아닙니다 ($($localUri.Port)) — 중단합니다." }
if ($prodUri.Host -in @("localhost", "127.0.0.1")) { Fail "원본(프로덕션) 주소가 localhost입니다 — POSTGRES_URL_NON_POOLING 값을 확인하십시오." }
Ok "원본(읽기 전용): $(Mask $ProductionUrl)"
Ok "대상(로컬, 덮어씀): $(Mask $localUrl)"

if (-not $Force) {
  Write-Host "`n로컬 DB($($localUri.AbsolutePath.Trim('/')))의 기존 데이터는 모두 사라지고 프로덕션 데이터로 대체됩니다." -ForegroundColor Yellow
  $answer = Read-Host "계속하시겠습니까? (yes 입력)"
  if ($answer -ne "yes") { Write-Host "취소했습니다."; exit 0 }
}

# 3. 로컬 Postgres 기동 (기존 스크립트 재사용)
Step "3. 로컬 Postgres 기동"
npm.cmd run db:local:start
if ($LASTEXITCODE -ne 0) { Fail "로컬 Postgres 기동 실패." }

# 4. 프로덕션 덤프 (읽기 전용 — pg_dump는 SELECT만 수행한다)
Step "4. 프로덕션 덤프"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$dumpDir = Join-Path $root ".local-postgres"
New-Item -ItemType Directory -Force -Path $dumpDir | Out-Null
$dumpPath = Join-Path $dumpDir "prod_dump_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
& (Join-Path $pgBin "pg_dump.exe") --no-owner --no-privileges --clean --if-exists -f $dumpPath $ProductionUrl
if ($LASTEXITCODE -ne 0) { Fail "pg_dump 실패 — 프로덕션 연결정보가 유효한지 확인하십시오." }
Ok "덤프 완료: $dumpPath ($([math]::Round((Get-Item $dumpPath).Length / 1MB, 1)) MB)"

# 5. 로컬로 복원 — --clean 덤프라 기존 로컬 테이블을 지우고 프로덕션 스키마·데이터를 그대로 만든다.
Step "5. 로컬 복원"
& (Join-Path $pgBin "psql.exe") -v ON_ERROR_STOP=1 $localUrl -f $dumpPath | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "복원 실패 — 위 psql 오류 메시지를 확인하십시오. 로컬 DB가 일부만 반영된 상태일 수 있습니다." }
Ok "복원 완료"

# 6. 확인 — 핵심 테이블 건수를 출력해 실제로 데이터가 들어왔는지 확인한다.
Step "6. 결과 확인"
& (Join-Path $pgBin "psql.exe") $localUrl -c "SELECT 'users' AS table, count(*) FROM users UNION ALL SELECT 'wbs_items', count(*) FROM wbs_items UNION ALL SELECT 'issues', count(*) FROM issues;"

if (-not $KeepDump) {
  Remove-Item $dumpPath -Force
  Ok "덤프 파일 삭제(-KeepDump로 보존 가능)"
} else {
  Write-Host "덤프 파일 보존: $dumpPath (프로덕션 실데이터이므로 커밋·공유 금지)" -ForegroundColor Yellow
}

Write-Host "`n마이그레이션 완료. 'npm run local'로 로컬 서버를 실행해 확인하십시오." -ForegroundColor Green
Write-Host "주의: 로컬 DB에 프로덕션의 실제 사용자·업무 데이터가 그대로 들어있습니다. 외부 공유·커밋 금지." -ForegroundColor Yellow
