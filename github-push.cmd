@echo off
echo [PMO] pmotools (Frontend) GitHub Push Process Started
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

echo [3/3] Pushing to Remote Repository (GitHub) with Direct Token...
echo ========================================
echo Notice: We will use direct token authentication to bypass Credential Manager.
echo Please generate your PAT (Personal Access Token) starting with 'ghp_'.
echo ========================================
set /p gitToken="Enter your GitHub PAT (Input will be visible): "

if "%gitToken%"=="" (
    echo [ERROR] Token cannot be empty. Aborting.
    pause
    exit /b 1
)

git push https://mohenz:%gitToken%@github.com/mohenz/pmotools.git HEAD

echo.
echo ========================================
echo [PMO] Push Process Completed.
pause
