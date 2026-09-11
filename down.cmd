@echo off
echo Stopping pmotools server on port 3020...
FOR /F "tokens=5" %%T IN ('netstat -a -n -o ^| findstr ":3020 "') DO (
    echo Killing process PID: %%T...
    taskkill /F /PID %%T >nul 2>&1
)
echo Server stop process completed.

echo Stopping local PostgreSQL Database...
call npm run db:local:stop
echo DB stop process completed.
