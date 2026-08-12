$ErrorActionPreference = "Stop"
$data = Join-Path $PSScriptRoot "..\.local-postgres\data"
if (-not (Test-Path (Join-Path $data "postmaster.pid"))) { Write-Host "Local PostgreSQL is not running."; exit 0 }
& "C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe" -D $data stop -m fast
if ($LASTEXITCODE -ne 0) { throw "로컬 PostgreSQL을 중지하지 못했습니다." }
