@echo off
echo Stopping PROD server on port 8080...
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr ":8080 "') DO (
    echo Killing process PID: %%T...
    taskkill /F /PID %%T >nul 2>&1
)
echo PROD Server stop process completed.
