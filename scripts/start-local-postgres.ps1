$ErrorActionPreference = "Stop"
$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$data = Join-Path $PSScriptRoot "..\.local-postgres\data"
$log = Join-Path $PSScriptRoot "..\.local-postgres\postgres.log"
& (Join-Path $pgBin "pg_isready.exe") -h localhost -p 55432 | Out-Null
if ($LASTEXITCODE -eq 0) { Write-Host "Local PostgreSQL is already running on port 55432."; exit 0 }
if (-not (Test-Path (Join-Path $data "PG_VERSION"))) { throw "로컬 DB가 초기화되지 않았습니다." }
& (Join-Path $pgBin "pg_ctl.exe") -D $data -l $log -o '"-p 55432"' start
if ($LASTEXITCODE -ne 0) { throw "로컬 PostgreSQL을 시작하지 못했습니다." }
