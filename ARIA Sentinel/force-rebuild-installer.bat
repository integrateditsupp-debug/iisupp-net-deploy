@echo off
title ARIA Sentinel - Force Rebuild (kill + clean + build)
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo ============================================================
echo  ARIA Sentinel - Force rebuild (kills running app first)
echo  Use this when build-installer.bat stops on "file in use" /
echo  a stale dist\win-unpacked. Tests are NOT run here - run
echo  build-installer.bat for the verified path before publishing.
echo ============================================================
echo.
if exist "%USERPROFILE%\.aria-sentinel-signing.bat" (
  echo Signing environment: loading %USERPROFILE%\.aria-sentinel-signing.bat
  call "%USERPROFILE%\.aria-sentinel-signing.bat"
) else (
  echo Signing environment: none - UNSIGNED build ^(SmartScreen will warn^). See docs\SIGNING.md.
)
echo.
echo Step 1/4: killing any running ARIA Sentinel processes...
taskkill /F /IM "ARIA Sentinel.exe" 2>nul
taskkill /F /IM "aria sentinel.exe" 2>nul
taskkill /F /IM "ARIA-Sentinel.exe" 2>nul
taskkill /F /IM electron.exe 2>nul
echo (kill attempted - errors above are fine if the process wasn't running)
echo.
echo Step 2/4: waiting 3 seconds for file locks to release...
timeout /t 3 /nobreak >nul
echo.
echo Step 3/4: removing stale dist\win-unpacked...
if exist "dist\win-unpacked" rmdir /s /q "dist\win-unpacked"
if exist "dist\win-unpacked.tmp" rmdir /s /q "dist\win-unpacked.tmp"
echo (cleaned)
echo.
echo Step 4/4: building fresh installer via package:win (nsis + msi, verified)...
call npm run package:win
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Read the error above. Common cause: another tool still has dist\ open.
  pause
  exit /b 1
)
echo.
set "VERSION="
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "VERSION=%%v"
echo ============================================================
echo  BUILD COMPLETE - version %VERSION%
echo  Installer: dist\ARIA-Sentinel-%VERSION%-setup.exe (signed) or dist\ARIA-Sentinel-%VERSION%-unsigned.exe
echo  Facts (paths, SHA-256, signature verdict): dist\RELEASE-%VERSION%.json
echo ============================================================
echo.
echo Press any key to open the dist folder...
pause >nul
start "" "%CD%\dist"
endlocal
