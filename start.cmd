@echo off
echo Starting local PostgreSQL Database...
call npm run db:local:start

echo Starting pmotools local server...
cd /d "%~dp0"
start "PMOTools Server" cmd /c "npm run dev"
echo Server started in a new terminal window.
