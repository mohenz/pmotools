$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $projectRoot '.local'
$dataRoot = Join-Path $localRoot 'postgres-data'
$logPath = Join-Path $localRoot 'postgres.log'
$secretPath = Join-Path $PSScriptRoot '.env.admin.local'
$appEnvPath = Join-Path $projectRoot '.env.local'
$pgBin = 'C:\Program Files\PostgreSQL\16\bin'
$port = 54326

function New-LocalSecret {
    $bytes = New-Object byte[] 30
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

if (-not (Test-Path -LiteralPath (Join-Path $pgBin 'initdb.exe'))) {
    throw 'PostgreSQL 16 binaries not found.'
}

New-Item -ItemType Directory -Path $localRoot -Force | Out-Null

if (-not (Test-Path -LiteralPath $secretPath)) {
    $adminPassword = New-LocalSecret
    $appPassword = New-LocalSecret
    [System.IO.File]::WriteAllLines($secretPath, @(
        "POSTGRES_ADMIN_PASSWORD=$adminPassword",
        "PROJECT_TOOL_APP_PASSWORD=$appPassword"
    ))
}

$secrets = @{}
Get-Content -LiteralPath $secretPath | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.*)$') { $secrets[$matches[1]] = $matches[2] }
}
$adminPassword = $secrets['POSTGRES_ADMIN_PASSWORD']
$appPassword = $secrets['PROJECT_TOOL_APP_PASSWORD']
if (-not $adminPassword -or -not $appPassword) { throw 'Local database credentials are incomplete.' }

if (-not (Test-Path -LiteralPath $appEnvPath)) {
    [System.IO.File]::WriteAllLines($appEnvPath, @(
        "DATABASE_URL=postgresql://project_tool_app:$appPassword@127.0.0.1:$port/project_tool",
        'LOCAL_USER_ID=10000000-0000-4000-8000-000000000001',
        'DEFAULT_PROJECT_ID=20000000-0000-4000-8000-000000000001'
    ))
}

if (-not (Test-Path -LiteralPath $dataRoot)) {
    $passwordFile = Join-Path $localRoot 'init-password.txt'
    [System.IO.File]::WriteAllText($passwordFile, $adminPassword)
    try {
        & (Join-Path $pgBin 'initdb.exe') -D $dataRoot -U project_tool_admin --encoding=UTF8 --locale=C --auth-local=scram-sha-256 --auth-host=scram-sha-256 --pwfile=$passwordFile
        if ($LASTEXITCODE -ne 0) { throw 'initdb failed.' }
    } finally {
        if (Test-Path -LiteralPath $passwordFile) { Remove-Item -LiteralPath $passwordFile -Force }
    }
}

$listener = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
    & (Join-Path $pgBin 'pg_ctl.exe') -D $dataRoot -l $logPath -o "-p $port -h 127.0.0.1" -w start
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL startup failed.' }
}

$env:PGPASSWORD = $adminPassword
$psql = Join-Path $pgBin 'psql.exe'
$createdb = Join-Path $pgBin 'createdb.exe'
$escapedAppPassword = $appPassword.Replace("'", "''")

try {
    $roleSql = "do `$`$ begin if not exists(select 1 from pg_roles where rolname='project_tool_owner') then create role project_tool_owner nologin; end if; if not exists(select 1 from pg_roles where rolname='project_tool_app') then create role project_tool_app login password '$escapedAppPassword' nosuperuser nocreatedb nocreaterole noinherit; else alter role project_tool_app password '$escapedAppPassword'; end if; end `$`$;"
    & $psql -w -h 127.0.0.1 -p $port -U project_tool_admin -d postgres -v ON_ERROR_STOP=1 -c $roleSql | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Role setup failed.' }

    $databaseExists = & $psql -w -h 127.0.0.1 -p $port -U project_tool_admin -d postgres -Atc "select 1 from pg_database where datname='project_tool'"
    if ($databaseExists -ne '1') {
        & $createdb -w -h 127.0.0.1 -p $port -U project_tool_admin -O project_tool_owner project_tool
        if ($LASTEXITCODE -ne 0) { throw 'Database creation failed.' }
    }

    & $psql -w -h 127.0.0.1 -p $port -U project_tool_admin -d project_tool -v ON_ERROR_STOP=1 -c "create table if not exists public.project_tool_schema_migrations(filename text primary key, applied_at timestamptz not null default now());" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Migration history setup failed.' }

    $historyCount = & $psql -w -h 127.0.0.1 -p $port -U project_tool_admin -d project_tool -Atc "select count(*) from public.project_tool_schema_migrations"
    $legacySchema = & $psql -w -h 127.0.0.1 -p $port -U project_tool_admin -d project_tool -Atc "select to_regclass('project_tool.issue_risks') is not null"
    if ($historyCount -eq '0' -and $legacySchema -eq 't') {
        & $psql -w -h 127.0.0.1 -p $port -U project_tool_admin -d project_tool -v ON_ERROR_STOP=1 -c "insert into public.project_tool_schema_migrations(filename) values ('001_schema.sql'),('002_seed.sql'),('003_business_rules.sql') on conflict do nothing;" | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Legacy migration history bootstrap failed.' }
    }

    Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'migrations') -Filter '*.sql' | Sort-Object Name | ForEach-Object {
        $migrationName = $_.Name
        $escapedMigrationName = $migrationName.Replace("'", "''")
        $alreadyApplied = & $psql -w -h 127.0.0.1 -p $port -U project_tool_admin -d project_tool -Atc "select 1 from public.project_tool_schema_migrations where filename='$escapedMigrationName'"
        if ($alreadyApplied -ne '1') {
            & $psql -w -h 127.0.0.1 -p $port -U project_tool_admin -d project_tool -v ON_ERROR_STOP=1 -f $_.FullName | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Migration failed: $migrationName" }
            & $psql -w -h 127.0.0.1 -p $port -U project_tool_admin -d project_tool -v ON_ERROR_STOP=1 -c "insert into public.project_tool_schema_migrations(filename) values ('$escapedMigrationName');" | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "Migration history update failed: $migrationName" }
        }
    }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Output 'Project Tool PostgreSQL ready on 127.0.0.1:54326.'
