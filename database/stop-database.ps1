$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$dataRoot = Join-Path $projectRoot '.local\postgres-data'
$pgCtl = 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe'

if (-not (Test-Path -LiteralPath $dataRoot)) {
    Write-Output 'Local PostgreSQL data directory does not exist.'
    exit 0
}

& $pgCtl -D $dataRoot -m fast -w stop
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL shutdown failed.' }
Write-Output 'Project Tool PostgreSQL stopped.'

