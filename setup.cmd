@echo off
rem pmotools 로컬 개발 환경 원클릭 설치 — 더블클릭으로 실행하십시오.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-new-pc.ps1" %*
pause
