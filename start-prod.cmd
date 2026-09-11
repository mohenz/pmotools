@echo off
echo Starting pmotools PROD server...
cd /d "%~dp0"
start "PMOTools PROD Server" cmd /c "npm run start:prod"
echo PROD Server started in a new terminal window.
