@echo off
setlocal enabledelayedexpansion

echo =======================================================
echo [PMO] Database Automated Backup Script
echo =======================================================

set "ENV_PATH=d:\product\pmotools\.env.production"
set "BACKUP_DIR=d:\product\db_backups"
set "RETENTION_DAYS=15"
set "PG_BIN=C:\Program Files\PostgreSQL\18\bin"

echo [1/4] Checking environment configuration...
if not exist "%ENV_PATH%" (
    echo [ERROR] Environment file not found at %ENV_PATH%
    pause
    exit /b 1
)

set "DB_URL="
for /f "tokens=1,* delims==" %%A in ('type "%ENV_PATH%" ^| findstr /B "DATABASE_URL"') do (
    set "DB_URL=%%B"
)

:: Remove quotes if any
if not "%DB_URL%"=="" (
    set "DB_URL=!DB_URL:"=!"
)

if "%DB_URL%"=="" (
    echo [ERROR] DATABASE_URL not found in %ENV_PATH%
    pause
    exit /b 1
)

:: Remove Prisma query parameters (everything after ?)
for /f "tokens=1 delims=?" %%A in ("!DB_URL!") do (
    set "CLEAN_DB_URL=%%A"
)

echo [2/4] Preparing backup directory...
if not exist "%BACKUP_DIR%" (
    mkdir "%BACKUP_DIR%"
)

echo [3/4] Running pg_dump...
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
:: Handle single-digit hours replacing space with zero
set "mytime=!mytime: =0!"
set "BACKUP_FILE=%BACKUP_DIR%\pmotools_db_%mydate%_%mytime%.sql"

"%PG_BIN%\pg_dump.exe" --dbname="%CLEAN_DB_URL%" -F p -f "%BACKUP_FILE%"
if errorlevel 1 (
    echo [ERROR] pg_dump failed. Check connection or PostgreSQL installation.
    pause
    exit /b 1
)
echo -^> Backup successfully created: %BACKUP_FILE%

echo [4/4] Applying retention policy (Keeping last %RETENTION_DAYS% days)...
forfiles /P "%BACKUP_DIR%" /M *.sql /D -%RETENTION_DAYS% /C "cmd /c del @path" 2>nul
echo -^> Old backups cleaned up.

echo.
echo =======================================================
echo [SUCCESS] Backup process finished.
echo =======================================================
