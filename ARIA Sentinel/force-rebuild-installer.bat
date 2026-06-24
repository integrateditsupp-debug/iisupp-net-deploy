@echo off
title ARIA Sentinel - Force Rebuild (kill + clean + build)
cd /d "%~dp0"
echo ============================================================
echo  ARIA Sentinel - Force rebuild (kills running app first)
echo ============================================================
echo.
echo Step 1/4: killing any running ARIA Sentinel processes...
taskkill /F /IM "ARIA Sentinel.exe" 2>nul
taskkill /F /IM "aria sentinel.exe" 2>nul
taskkill /F /IM "aria-sentinel-0.1.0-unsigned.exe" 2>nul
taskkill /F /IM electron.exe 2>nul
echo (kill attempted - errors above are fine if process wasn't running)
echo.
echo Step 2/4: waiting 3 seconds for file locks to release...
timeout /t 3 /nobreak >nul
echo.
echo Step 3/4: removing stale dist\win-unpacked...
if exist "dist\win-unpacked" rmdir /s /q "dist\win-unpacked"
if exist "dist\win-unpacked.tmp" rmdir /s /q "dist\win-unpacked.tmp"
echo (cleaned)
echo.
echo Step 4/4: building fresh .exe via electron-builder...
call npm run package:win
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Read the error above. Common cause: another tool still has dist\ open.
  pause
  exit /b 1
)
echo.
echo ============================================================
echo  BUILD COMPLETE
echo  New installer: %CD%\dist\ARIA-Sentinel-0.1.0-unsigned.exe
echo ============================================================
echo.
echo Press any key to open the dist folder...
pause >nul
start "" "%CD%\dist"
