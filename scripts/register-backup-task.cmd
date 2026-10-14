@echo off
chcp 65001 >nul

echo =======================================================
echo [PMO] Task Scheduler Registration for DB Backup
echo =======================================================

:: Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] This script requires Administrator privileges.
    echo Please right-click this file and select "Run as Administrator".
    pause
    exit /b 1
)

set "TASK_NAME=PMOTools_Daily_DB_Backup"
set "SCRIPT_PATH=d:\workspace\pmotools\scripts\backup-db.cmd"

echo [1/2] Removing old scheduled task (if exists)...
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

echo [2/2] Registering new scheduled task (Daily at 03:00 AM)...
schtasks /create /tn "%TASK_NAME%" /tr "\"%SCRIPT_PATH%\"" /sc daily /st 03:00 /ru SYSTEM /rl HIGHEST /f

if %errorLevel% equ 0 (
    echo.
    echo [SUCCESS] Task "%TASK_NAME%" successfully registered!
    echo It will run automatically every day at 03:00 AM using SYSTEM privileges.
) else (
    echo.
    echo [ERROR] Failed to register the scheduled task.
)
pause
