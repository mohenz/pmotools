@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo [PMO] Local DB Offline Backup (for Agent Handover)
echo =======================================================

set "ROOT_DIR=%~dp0..\.."
set "PG_BIN=C:\Program Files\PostgreSQL\18\bin"
set "LOCAL_URL=postgresql://postgres@localhost:55432/mydb"
set "DUMP_DIR=%ROOT_DIR%\docs"
set "DUMP_FILE=%DUMP_DIR%\local_full_backup.sql"

echo [1/2] Preparing to backup local database (Schema: public)...
if not exist "%DUMP_DIR%" mkdir "%DUMP_DIR%"

echo [2/2] Running pg_dump...
"%PG_BIN%\pg_dump.exe" --schema=public --no-owner --no-privileges --clean --if-exists -f "%DUMP_FILE%" "%LOCAL_URL%"
if errorlevel 1 (
    echo [ERROR] pg_dump failed. Please check if PostgreSQL is running on port 55432.
    pause
    exit /b 1
)

echo.
echo =======================================================
echo [SUCCESS] Backup saved to: %DUMP_FILE%
echo Please provide this file and the handover document to the next agent.
echo =======================================================
pause
