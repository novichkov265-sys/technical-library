@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Technical Library - Portable Launcher

set "NODE_VER=v22.12.0"
set "NODE_DIR=node-%NODE_VER%-win-x64"
set "NODE_URL=https://nodejs.org/dist/%NODE_VER%/%NODE_DIR%.zip"
set "PG_ZIP=postgresql-15.8-1-windows-x64-binaries.zip"
set "PG_URL=https://get.enterprisedb.com/postgresql/%PG_ZIP%"

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "RT=%ROOT%\.runtime"
set "NODE=%RT%\%NODE_DIR%"
set "PG=%RT%\pgsql"

set "DATAROOT=%LOCALAPPDATA%\technical-library"
set "PGDATA=%DATAROOT%\pgdata"
set "PGPORT=55432"

set "PGCLIENTENCODING=UTF8"
set "PATH=%NODE%;%PG%\bin;%PATH%"

echo ============================================
echo   Technical Library - portable start
echo   App folder:  %ROOT%
echo   DB data dir: %PGDATA%
echo   PostgreSQL port: %PGPORT%
echo ============================================
echo.

echo [0/6] Cleaning up previous run ...
if exist "%PG%\bin\pg_ctl.exe" if exist "%PGDATA%\PG_VERSION" "%PG%\bin\pg_ctl.exe" -D "%PGDATA%" -m fast stop -w -t 20 >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PGPORT% " ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5000 " ^| findstr LISTENING') do taskkill /PID %%p /F >nul 2>&1
timeout /t 2 >nul

if not exist "%RT%" mkdir "%RT%"
if not exist "%DATAROOT%" mkdir "%DATAROOT%"

if not exist "%NODE%\node.exe" (
    echo [1/6] Downloading Node.js %NODE_VER% ...
    curl -L -o "%RT%\node.zip" "%NODE_URL%"
    if errorlevel 1 goto downloadfail
    echo       Extracting Node.js ...
    tar -xf "%RT%\node.zip" -C "%RT%"
    del "%RT%\node.zip"
) else (
    echo [1/6] Node.js already present.
)

if not exist "%PG%\bin\pg_ctl.exe" (
    echo [2/6] Downloading PostgreSQL ...
    curl -L -o "%RT%\pgsql.zip" "%PG_URL%"
    if errorlevel 1 goto downloadfail
    echo       Extracting PostgreSQL ...
    tar -xf "%RT%\pgsql.zip" -C "%RT%"
    del "%RT%\pgsql.zip"
) else (
    echo [2/6] PostgreSQL already present.
)

netstat -ano | findstr ":%PGPORT% " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo [3/6] [ERROR] Port %PGPORT% is busy. Change PGPORT in this file.
    echo.
    pause
    exit /b 1
)

set "NEEDINIT=0"
if not exist "%PGDATA%\PG_VERSION" set "NEEDINIT=1"
if "%NEEDINIT%"=="1" goto doinit
goto trystart

:doinit
echo [3/6] Creating fresh database cluster ...
if exist "%PGDATA%" rmdir /s /q "%PGDATA%"
"%PG%\bin\initdb.exe" -D "%PGDATA%" -U postgres -E UTF8 -A trust
if errorlevel 1 goto pgperm

:trystart
echo       Starting PostgreSQL ...
"%PG%\bin\pg_ctl.exe" -D "%PGDATA%" -l "%RT%\pg.log" -o "-p %PGPORT%" -w -t 60 start
if errorlevel 1 (
    if "%NEEDINIT%"=="0" (
        echo       Existing cluster looks broken. Recreating from scratch ...
        set "NEEDINIT=1"
        goto doinit
    )
    goto pglog
)

echo       Waiting for PostgreSQL ...
set /a pgtries=0
:waitpg
"%PG%\bin\pg_isready.exe" -h localhost -p %PGPORT% >nul 2>&1
if not errorlevel 1 goto pgready
set /a pgtries+=1
if !pgtries! geq 20 goto pglog
timeout /t 2 >nul
goto waitpg
:pgready
echo       PostgreSQL is ready.

echo       Checking database tech_library_db ...
set "DBEXISTS="
"%PG%\bin\psql.exe" -h localhost -p %PGPORT% -U postgres -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='tech_library_db'" > "%RT%\dbcheck.txt" 2>nul
set /p DBEXISTS=<"%RT%\dbcheck.txt"

if "!DBEXISTS!"=="1" (
    echo       Database already exists, reusing it.
) else (
    echo       Creating database tech_library_db ...
    "%PG%\bin\createdb.exe" -h localhost -p %PGPORT% -U postgres -E UTF8 -T template0 tech_library_db
    if errorlevel 1 goto pgfail

    echo       Applying init.sql ...
    "%PG%\bin\psql.exe" -h localhost -p %PGPORT% -U postgres -d tech_library_db --set=client_encoding=UTF8 -v ON_ERROR_STOP=1 -f "%ROOT%\database\init.sql"
    if errorlevel 1 goto pgfail
)

if not exist "%ROOT%\client\node_modules" (
    echo [4/6] Installing client dependencies ...
    pushd "%ROOT%\client"
    call "%NODE%\npm.cmd" install
    popd
)
if not exist "%ROOT%\client\dist\index.html" (
    echo       Building client ...
    pushd "%ROOT%\client"
    call "%NODE%\npm.cmd" run build
    popd
)
echo       Copying client into server\public ...
if not exist "%ROOT%\server\public" mkdir "%ROOT%\server\public"
xcopy /E /I /Y "%ROOT%\client\dist\*" "%ROOT%\server\public\" >nul

if not exist "%ROOT%\server\node_modules" (
    echo [5/6] Installing server dependencies ...
    pushd "%ROOT%\server"
    call "%NODE%\npm.cmd" install
    popd
) else (
    echo [5/6] Server dependencies present.
)
if not exist "%ROOT%\server\uploads" mkdir "%ROOT%\server\uploads"
if not exist "%ROOT%\server\backups" mkdir "%ROOT%\server\backups"

echo [6/6] Starting server ...
set "RUNNER=%RT%\run-server.bat"
> "%RUNNER%" echo @echo off
>> "%RUNNER%" echo cd /d "%ROOT%\server"
>> "%RUNNER%" echo set "PATH=%NODE%;%%PATH%%"
>> "%RUNNER%" echo set "PORT=5000"
>> "%RUNNER%" echo set "DB_HOST=localhost"
>> "%RUNNER%" echo set "DB_PORT=%PGPORT%"
>> "%RUNNER%" echo set "DB_NAME=tech_library_db"
>> "%RUNNER%" echo set "DB_USER=postgres"
>> "%RUNNER%" echo set "DB_PASSWORD=postgres"
>> "%RUNNER%" echo "%NODE%\node.exe" src\app.js
>> "%RUNNER%" echo echo.
>> "%RUNNER%" echo echo Server stopped. Press any key to close.
>> "%RUNNER%" echo pause ^>nul
start "Technical Library Server" "%RUNNER%"

echo       Waiting for the app on http://localhost:5000 ...
set /a apptries=0
:waitapp
curl -s -o nul http://localhost:5000
if not errorlevel 1 goto appready
set /a apptries+=1
if !apptries! geq 40 goto appwarn
timeout /t 2 >nul
goto waitapp
:appwarn
echo       [WARN] App did not respond yet. Opening browser anyway.
:appready

start "" http://localhost:5000

echo.
echo ============================================
echo   App is running!
echo   URL:   http://localhost:5000
echo   Login: admin@library.local
echo   Pass:  Admin123
echo ============================================
echo.
echo Server runs in a separate window. To stop everything run stop.bat
echo.
pause
exit /b 0

:downloadfail
echo.
echo [ERROR] Download failed. Check your internet connection.
echo.
pause
exit /b 1

:pgperm
echo.
echo [ERROR] Could not create the database cluster in %PGDATA%
echo Check that you have write access to your user profile folder.
echo.
pause
exit /b 1

:pglog
echo.
echo [ERROR] PostgreSQL did not start. Last log lines:
echo --------------------------------------------
if exist "%RT%\pg.log" powershell -NoProfile -Command "Get-Content -Path '%RT%\pg.log' -Tail 20"
echo --------------------------------------------
pause
exit /b 1

:pgfail
echo.
echo [ERROR] Database step failed. See messages above and %RT%\pg.log
echo.
pause
exit /b 1