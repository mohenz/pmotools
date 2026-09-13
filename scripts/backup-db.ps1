# Database Backup Script for PMOTools
$ErrorActionPreference = "Stop"

# Configuration
$EnvPath = "d:\product\pmotools\.env.production"
$BackupDir = "d:\product\db_backups"
$RetentionDays = 15
$PgDumpPath = "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"

# 1. Read DATABASE_URL from .env
if (-not (Test-Path $EnvPath)) {
    Write-Error "Environment file not found at $EnvPath"
    exit 1
}

$DbUrl = ""
Get-Content $EnvPath | ForEach-Object {
    if ($_ -match "^DATABASE_URL=`"?(.*?)`"?$") {
        $DbUrl = $matches[1]
    }
}

if ([string]::IsNullOrWhiteSpace($DbUrl)) {
    Write-Error "DATABASE_URL not found in $EnvPath"
    exit 1
}

# Remove Prisma-specific query parameters (e.g. ?schema=public) which pg_dump doesn't support
$DbUrl = $DbUrl -replace "\?.*$", ""

# 2. Create Backup Directory if it doesn't exist
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

# 3. Generate Backup Filename
$DateStr = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = Join-Path $BackupDir "pmotools_db_$DateStr.sql"

# 4. Execute pg_dump
Write-Host "Starting database backup to $BackupFile..."
# Using plain SQL format for easy restore/inspection.
& $PgDumpPath --dbname=$DbUrl -F p -f $BackupFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump failed with exit code $LASTEXITCODE"
    exit 1
}
Write-Host "Backup completed successfully."

# 5. Clean up old backups (Retention Policy)
Write-Host "Applying retention policy: keeping backups for $RetentionDays days."
$CutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupDir -Filter "*.sql" | Where-Object { $_.CreationTime -lt $CutoffDate } | ForEach-Object {
    Write-Host "Deleting old backup: $($_.Name)"
    Remove-Item $_.FullName -Force
}

Write-Host "Backup process finished."
