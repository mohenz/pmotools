@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: =======================================================
:: [PMO] 단위테스트 증적 저장소 설치 (내부 서버 전용)
:: - 대상: 10.147.148.101 (운영). 서버 RDP 세션에서 "관리자 권한으로 실행"
:: - 사용법: setup-evidence-storage.cmd [pmotools 실행 계정] [백업 경로]
::           계정 생략 시 현재 로그인 계정(%USERDOMAIN%\%USERNAME%)
::           백업 경로는 원본(D:)과 다른 디스크/NAS를 지정한다(PMO 결정 B3).
::           생략 시 D:\product\ut_evidence_backup — 같은 디스크라 경고 후 확인을 받는다
:: - 재실행 안전: 폴더·파일이 있으면 그대로 두고 권한·작업만 다시 적용
:: - 설계: docs/단위테스트 수행관리 프로그램 설계서.md 9장 "증적 저장소"
:: =======================================================

set "ROOT=D:\product\ut_evidence"
set "TMP_DIR=D:\product\ut_evidence_tmp"
set "BACKUP=%~2"
if "%BACKUP%"=="" set "BACKUP=D:\product\ut_evidence_backup"
set "SCRIPT_DIR=D:\product\scripts"
set "LOG_DIR=D:\product\logs"
set "BACKUP_SCRIPT=%SCRIPT_DIR%\ut-evidence-backup.cmd"
set "ENV_PATH=D:\product\pmotools\.env.production"
set "TASK_NAME=PMOTools_UT_Evidence_Backup"

set "SVC_ACCOUNT=%~1"
if "%SVC_ACCOUNT%"=="" set "SVC_ACCOUNT=%USERDOMAIN%\%USERNAME%"

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] 관리자 권한이 필요합니다. "관리자 권한으로 실행"으로 다시 실행하십시오.
    pause
    exit /b 1
)

if not exist "D:\product" (
    echo [ERROR] D:\product 가 없습니다. 운영 서버가 맞는지 확인하십시오.
    pause
    exit /b 1
)

echo =======================================================
echo  저장 루트 : %ROOT%
echo  임시 폴더 : %TMP_DIR%
echo  백업 폴더 : %BACKUP%
echo  실행 계정 : %SVC_ACCOUNT%
echo  환경 파일 : %ENV_PATH%
echo =======================================================
if /i "%BACKUP:~0,2%"=="%ROOT:~0,2%" (
    echo [WARN] 백업 경로가 원본과 같은 디스크^(%ROOT:~0,2%^)입니다. 디스크 장애 시 원본·백업이 함께 소실됩니다.
    echo        운영 개시 전 두 번째 인자로 다른 디스크/NAS 경로를 지정해 다시 실행하십시오.
)
choice /c YN /m "위 설정으로 설치합니까"
if errorlevel 2 (
    echo 취소했습니다.
    exit /b 0
)

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"
set "LOG=%LOG_DIR%\setup-evidence-storage.log"
echo [%date% %time%] START account=%SVC_ACCOUNT%>>"%LOG%"

echo [1/6] 폴더 생성...
for %%D in ("%ROOT%" "%TMP_DIR%" "%BACKUP%" "%SCRIPT_DIR%") do (
    if not exist "%%~D" mkdir "%%~D"
)

echo [2/6] 저장 루트 권한: 상속 해제, 실행 계정은 읽기+쓰기(삭제 불가)...
icacls "%ROOT%" /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "%SVC_ACCOUNT%:(OI)(CI)(RX,W)" "*S-1-3-4:(OI)(CI)(RX,W)" >>"%LOG%" 2>&1
if %errorLevel% neq 0 goto :fail

echo [3/6] 임시 폴더 권한: 실행 계정 수정 가능...
icacls "%TMP_DIR%" /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "%SVC_ACCOUNT%:(OI)(CI)M" >>"%LOG%" 2>&1
if %errorLevel% neq 0 goto :fail

echo [4/6] 백업 폴더 권한: 관리자·SYSTEM 전용...
icacls "%BACKUP%" /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" >>"%LOG%" 2>&1
if %errorLevel% neq 0 goto :fail

echo [5/6] 일일 백업 작업 등록 (03:30, SYSTEM)...
> "%BACKUP_SCRIPT%" (
    echo @echo off
    echo robocopy "%ROOT%" "%BACKUP%" /E /COPY:DAT /XO /R:1 /W:5 /NP /LOG+:"%LOG_DIR%\ut-evidence-backup.log"
    echo if %%errorlevel%% geq 8 exit /b 1
    echo exit /b 0
)
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1
schtasks /create /tn "%TASK_NAME%" /tr "\"%BACKUP_SCRIPT%\"" /sc daily /st 03:30 /ru SYSTEM /rl HIGHEST /f >>"%LOG%" 2>&1
if %errorLevel% neq 0 goto :fail

echo [6/6] 환경변수 등록 (%ENV_PATH%)...
if not exist "%ENV_PATH%" (
    echo [WARN] %ENV_PATH% 없음. 아래 두 줄을 운영 환경 파일에 직접 추가하십시오.
    echo        UT_EVIDENCE_ROOT=%ROOT%
    echo        UT_EVIDENCE_TMP=%TMP_DIR%
    echo [%date% %time%] WARN env file missing>>"%LOG%"
) else (
    findstr /B "UT_EVIDENCE_ROOT=" "%ENV_PATH%" >nul 2>&1 || (echo.>>"%ENV_PATH%" & echo UT_EVIDENCE_ROOT=%ROOT%>>"%ENV_PATH%")
    findstr /B "UT_EVIDENCE_TMP=" "%ENV_PATH%" >nul 2>&1 || echo UT_EVIDENCE_TMP=%TMP_DIR%>>"%ENV_PATH%"
    findstr /B "UT_EVIDENCE_MAX_MB=" "%ENV_PATH%" >nul 2>&1 || echo UT_EVIDENCE_MAX_MB=20>>"%ENV_PATH%"
)

echo.
echo ===== 검증 =====
icacls "%ROOT%"
schtasks /query /tn "%TASK_NAME%" /fo list | findstr /i "TaskName Next Status"
findstr /B "UT_EVIDENCE_" "%ENV_PATH%" 2>nul
for /f "tokens=3" %%F in ('dir /-c D:\ ^| findstr /i "bytes free"') do echo D: 여유 바이트 = %%F
echo [%date% %time%] DONE>>"%LOG%"
echo.
echo [SUCCESS] 설치 완료. 위 icacls 결과에 "%SVC_ACCOUNT%:(OI)(CI)(RX,W)" 가 있어야 합니다.
echo           pmotools 재시작은 하지 않았습니다(환경변수는 다음 재시작부터 적용).
pause
exit /b 0

:fail
echo [ERROR] 실패. 로그: %LOG%
echo [%date% %time%] FAIL>>"%LOG%"
pause
exit /b 1
