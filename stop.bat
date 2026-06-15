@echo off
setlocal
cd /d "%~dp0"
title Technical Library - Stop

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "PG=%ROOT%\.runtime\pgsql"
set "PGDATA=%LOCALAPPDATA%\technical-library\pgdata"

echo Stopping server on port 5000 ...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5000 " ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1

echo Stopping PostgreSQL ...
if exist "%PG%\bin\pg_ctl.exe" "%PG%\bin\pg_ctl.exe" -D "%PGDATA%" -m fast stop -w -t 20 >nul 2>&1

echo.
echo Stopped.
pause