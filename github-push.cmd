@echo off
echo [PMO] GitHub Push Process Started
echo ========================================

cd /d "%~dp0"

echo [1/3] Checking Git Status...
git status
echo.

echo [2/3] Staging and Committing...
set /p commitMsg="Enter commit message (Default: 'Update pmotools frontend'): "
if "%commitMsg%"=="" set commitMsg="Update pmotools frontend"

git add .
git commit -m "%commitMsg%"
echo.

echo [3/3] Pushing to Remote Repository...
git push origin master

echo.
echo ========================================
echo [PMO] Push Process Completed.
pause
