@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo [PMO] Cutover Migration: Local DB -^> Supabase Cloud
echo =======================================================

set "ROOT_DIR=%~dp0..\.."
set "PG_BIN=C:\Program Files\PostgreSQL\18\bin"
set "LOCAL_URL=postgresql://postgres@localhost:55432/mydb"
set "DUMP_DIR=%ROOT_DIR%\.local-postgres"
set "TARGET_URL="

:: 1. Read Target URL from .env.local
echo [1/4] Scanning for Target (Supabase) Connection String...
if exist "%ROOT_DIR%\.env.local" (
    for /f "tokens=1,* delims==" %%A in ('type "%ROOT_DIR%\.env.local" ^| findstr /B "POSTGRES_URL_NON_POOLING"') do (
        set "TARGET_URL=%%B"
    )
)

:: Fallback to .env
if "%TARGET_URL%"=="" (
    if exist "%ROOT_DIR%\.env" (
        for /f "tokens=1,* delims==" %%A in ('type "%ROOT_DIR%\.env" ^| findstr /B "DATABASE_URL_PROD"') do (
            set "TARGET_URL=%%B"
        )
    )
)

:: Remove quotes
if not "%TARGET_URL%"=="" (
    set "TARGET_URL=!TARGET_URL:"=!"
)

if "%TARGET_URL%"=="" (
    echo [ERROR] Target Connection String not found in .env.local or .env
    pause
    exit /b 1
)

:: Prevent targeting localhost
echo !TARGET_URL! | findstr /I "localhost 127.0.0.1" >nul
if not errorlevel 1 (
    echo [ERROR] Target URL is localhost. This script must target the Cloud DB.
    pause
    exit /b 1
)

echo.
echo [WARNING] All existing data in the Cloud 'public' schema will be DESTROYED and REPLACED by Local Data.
set /p CONFIRM="Are you sure you want to proceed? (Type 'yes'): "
if /I not "%CONFIRM%"=="yes" (
    echo Migration Canceled.
    pause
    exit /b 0
)

:: 2. Local Dump
echo.
echo [2/4] Dumping Local Database (Schema: public)...
if not exist "%DUMP_DIR%" mkdir "%DUMP_DIR%"
set "DUMP_FILE=%DUMP_DIR%\local_to_prod_dump.sql"

"%PG_BIN%\pg_dump.exe" --schema=public --no-owner --no-privileges --clean --if-exists -f "%DUMP_FILE%" "%LOCAL_URL%"
if errorlevel 1 (
    echo [ERROR] pg_dump failed. Is Local PostgreSQL running on port 55432?
    pause
    exit /b 1
)
echo -^> Dump completed successfully.

:: 3. Restore to Cloud
echo.
echo [3/4] Restoring to Supabase Cloud...
echo (This may take some time. Please do not close this window.)
"%PG_BIN%\psql.exe" "%TARGET_URL%" -f "%DUMP_FILE%" >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Restore to Cloud DB failed.
    pause
    exit /b 1
)
echo -^> Restore completed successfully.

:: 4. Verification
echo.
echo [4/4] Verification (Fetching counts from Cloud Database)
"%PG_BIN%\psql.exe" "%TARGET_URL%" -c "SELECT 'users' AS table, count(*) FROM users UNION ALL SELECT 'wbs_items', count(*) FROM wbs_items UNION ALL SELECT 'issues', count(*) FROM issues;"

echo.
echo =======================================================
echo [PMO] Cutover Migration Completed Successfully.
echo =======================================================
pause
