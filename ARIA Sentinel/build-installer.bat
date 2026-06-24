@echo off
title ARIA Sentinel - Build Installer (with v1 gold icon)
cd /d "%~dp0"
echo ============================================================
echo  ARIA Sentinel - Building Windows installer with new icon
echo  Working dir: %CD%
echo ============================================================
echo.
echo Step 1/2: ensuring dependencies are installed...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo.
  echo NPM INSTALL FAILED. Press any key to close.
  pause >nul
  exit /b 1
)
echo.
echo Step 2/2: building .exe via electron-builder...
call npm run package:win
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Read the error above.
  pause
  exit /b 1
)
echo.
echo ============================================================
echo  BUILD COMPLETE
echo  New installer at: %CD%\dist\ARIA-Sentinel-0.1.0-unsigned.exe
echo ============================================================
echo.
echo Press any key to open the dist folder in File Explorer...
pause >nul
start "" "%CD%\dist"
