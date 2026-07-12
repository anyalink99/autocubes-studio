@echo off
setlocal EnableExtensions
title Autocubes Studio

cd /d "%~dp0"

set "PORT=%~1"
if not defined PORT set "PORT=4178"

echo.
echo  AUTOCUBES STUDIO
echo  ----------------
echo  Workspace: %CD%
echo  Address:   http://127.0.0.1:%PORT%/
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Install Node.js LTS from https://nodejs.org/
  goto :failed
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found next to Node.js.
  goto :failed
)

if not exist "node_modules\vite\bin\vite.js" (
  echo [1/3] Installing project dependencies...
  call npm install
  if errorlevel 1 goto :install_failed
) else (
  echo [1/3] Project dependencies are ready.
)

node -e "const fs=require('fs');const {chromium}=require('playwright');process.exit(fs.existsSync(chromium.executablePath())?0:1)" >nul 2>nul
if errorlevel 1 (
  echo [2/3] Installing Chromium for page capture...
  call npm run browsers:install
  if errorlevel 1 goto :browser_failed
) else (
  echo [2/3] Capture browser is ready.
)

echo [3/3] Starting Studio. Press Ctrl+C to stop the server.
echo.
call npm run dev -- --host 127.0.0.1 --port %PORT% --strictPort
if errorlevel 1 goto :server_failed
goto :done

:install_failed
echo.
echo [ERROR] Dependency installation failed.
goto :failed

:browser_failed
echo.
echo [ERROR] Playwright Chromium installation failed.
goto :failed

:server_failed
echo.
echo [ERROR] Studio did not start. Port %PORT% may already be in use.
echo Try another port: start-studio.bat 4190
goto :failed

:failed
echo.
pause
exit /b 1

:done
endlocal
