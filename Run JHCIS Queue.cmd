@echo off
setlocal
title JHCIS Queue
pushd "%~dp0"
if errorlevel 1 goto folder_error

echo ========================================
echo          JHCIS Queue Launcher
echo ========================================
echo.

rem Explorer may not have Node.js on PATH. Also support portable/local runtimes.
set "NODE_EXE="
for /f "delims=" %%N in ('where node.exe 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%N"
if not defined NODE_EXE if exist "%~dp0runtime\node.exe" set "NODE_EXE=%~dp0runtime\node.exe"
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_EXE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE_EXE if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not defined NODE_EXE goto node_missing
for %%N in ("%NODE_EXE%") do set "PATH=%%~dpN;%PATH%"
echo Using Node.js: "%NODE_EXE%"
"%NODE_EXE%" -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>20||(a===20&&b>=9)?0:1)"
if errorlevel 1 goto node_old

if not exist "launch.cjs" goto project_missing
if not exist "package.json" goto project_missing
if exist "node_modules\next\dist\bin\next" goto run_app

where npm.cmd >nul 2>nul
if errorlevel 1 goto node_missing
echo First run: installing dependencies. Internet is required.
if exist "package-lock.json" (
  call npm ci
) else (
  call npm install
)
if errorlevel 1 goto install_error

:run_app
echo Starting the application and opening your browser...
"%NODE_EXE%" "%CD%\launch.cjs"
if errorlevel 1 goto run_error
popd
exit /b 0

:node_missing
echo ERROR: Node.js and npm are required on this computer.
echo Install Node.js LTS from https://nodejs.org and run this file again.
goto failed

:node_old
echo ERROR: Node.js 20.9 or later is required. Please install a current LTS version.
goto failed

:project_missing
echo ERROR: Copy the entire project folder, not just this CMD file.
goto failed

:install_error
echo ERROR: Dependency installation failed. Check your internet connection.
echo Review the error above, then run this file again.
goto failed

:run_error
echo ERROR: The application could not start. See the message above.
echo If available, check data\launcher.log for details.
goto failed

:folder_error
echo ERROR: Cannot open the project folder.
pause
exit /b 1

:failed
echo.
pause
popd
exit /b 1
