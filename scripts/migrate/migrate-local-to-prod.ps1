<#
  로컬(mydb, localhost:55432)에 축적된 실데이터를 프로덕션(Supabase 클라우드)으로 이행한다.
  (내부망 운영 -> 클라우드 전환을 위한 Cutover 스크립트)

  pg_dump로 로컬의 'public' 스키마만 추출하여, 프로덕션에 덮어쓴다(--clean --if-exists).
  Supabase의 내부 스키마(auth, storage 등)를 보호하기 위해 반드시 public 스키마만 이행한다.

  사전 준비:
    1) .env.local 또는 .env.production 파일에 POSTGRES_URL_NON_POOLING (또는 타겟 DATABASE_URL)이 있어야 한다.
    2) 로컬 데이터베이스가 실행 중이어야 한다. (npm run db:local:start)

  사용법:
    powershell -ExecutionPolicy Bypass -File scripts/migrate-local-to-prod.ps1
#>
param(
  [string]$TargetUrl,      # 생략 시 .env.local의 POSTGRES_URL_NON_POOLING을 사용
  [switch]$Force           # 확인 프롬프트 생략 (자동화용)
)

$ErrorActionPreference = "Stop"
$env:Path = "C:\Program Files\nodejs;C:\Program Files\PostgreSQL\18\bin;" + [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
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
  return ($url -replace '://([^:]+):([^@]+)@', '://$1:****@')
}

# 1. 연결정보 확인
Step "1. 연결정보 확인"
if (-not $TargetUrl) { 
  $TargetUrl = Get-EnvValue (Join-Path $root ".env.local") "POSTGRES_URL_NON_POOLING" 
  if (-not $TargetUrl) {
    $TargetUrl = Get-EnvValue (Join-Path $root ".env") "DATABASE_URL_PROD"
  }
}
if (-not $TargetUrl) { Fail "타겟(Supabase) 연결정보를 찾을 수 없습니다. 타겟 URL을 직접 지정하거나 환경변수를 설정하십시오." }

$localUrl = "postgresql://postgres@localhost:55432/mydb"
$targetUri = [Uri]$TargetUrl

# 2. 안전장치 (타겟이 로컬인지 방지)
Step "2. 안전장치 확인"
if ($targetUri.Host -in @("localhost", "127.0.0.1")) { Fail "이행 대상(타겟)이 localhost입니다. 이 스크립트는 로컬에서 원격으로 덮어쓰는 용도입니다." }

Ok "원본(로컬, 읽기 전용): $(Mask $localUrl)"
Ok "대상(클라우드, 덮어씀): $(Mask $TargetUrl)"

if (-not $Force) {
  Write-Host "`n[경고] 클라우드 DB($($targetUri.Host))의 'public' 스키마 기존 데이터는 모두 사라지고 로컬 데이터로 대체됩니다." -ForegroundColor Yellow
  Write-Host "클라우드 전환(Cutover) 시에만 실행해야 합니다." -ForegroundColor Yellow
  $answer = Read-Host "정말 덮어쓰시겠습니까? (yes 입력)"
  if ($answer -ne "yes") { Write-Host "취소했습니다."; exit 0 }
}

# 3. 로컬 덤프 (public 스키마만 덤프)
Step "3. 로컬 DB 덤프 (public 스키마 추출)"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$dumpDir = Join-Path $root ".local-postgres"
New-Item -ItemType Directory -Force -Path $dumpDir | Out-Null
$dumpPath = Join-Path $dumpDir "local_to_prod_dump_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

# Supabase 보호를 위해 -n public 필수. --clean --if-exists로 기존 테이블 삭제.
& (Join-Path $pgBin "pg_dump.exe") --schema=public --no-owner --no-privileges --clean --if-exists -f $dumpPath $localUrl
if ($LASTEXITCODE -ne 0) { Fail "로컬 DB pg_dump 실패. 로컬 DB(55432)가 실행 중인지 확인하십시오." }
Ok "덤프 완료: $dumpPath ($([math]::Round((Get-Item $dumpPath).Length / 1MB, 1)) MB)"

# 4. 프로덕션으로 복원
Step "4. 타겟(클라우드) 복원"
Write-Host "Supabase 클라우드로 데이터를 전송 중입니다. 잠시만 기다려 주십시오..." -ForegroundColor Gray
& (Join-Path $pgBin "psql.exe") $TargetUrl -f $dumpPath | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "클라우드 DB로의 psql 복원 중 오류가 발생했습니다." }
Ok "클라우드 복원 완료"

# 5. 확인
Step "5. 결과 확인 (클라우드 데이터베이스)"
& (Join-Path $pgBin "psql.exe") $TargetUrl -c "SELECT 'users' AS table, count(*) FROM users UNION ALL SELECT 'wbs_items', count(*) FROM wbs_items UNION ALL SELECT 'issues', count(*) FROM issues;"

Write-Host "`n[PMO] 클라우드 전환(Cutover) 데이터 이행 완료." -ForegroundColor Green
Write-Host "차주 클라우드 서비스 오픈을 위해 배포된 앱이 올바르게 Supabase를 바라보는지 환경변수를 확인하십시오." -ForegroundColor Cyan
