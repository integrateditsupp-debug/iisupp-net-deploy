@echo off
title ARIA Sentinel — Build single .exe (RUN 12-23e)
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo  ARIA Sentinel Build — Single .exe (RUNs 12-23e)
echo  RUN 23e: ONE build for everyone. The admin console ships to all
echo  (extraResources) but only unlocks for an admin-tier license key.
echo  SENTINEL_ADMIN_TOKEN is already set on Netlify.
echo  This will:
echo    0. Auto-bump version (skip with [no-bump] in commit SUBJECT)
echo    1. Kill any running ARIA-Sentinel processes
echo    2. Clean old win-unpacked dir
echo    3. Build the .exe (package:win)
echo    4. Copy .exe to ..\public\sentinel-binaries\
echo    5. Open dist folder
echo    6. Auto-publish to GitHub Release + update manifest (OTA)
echo ============================================================
echo.

echo --- Step 0: Auto version bump ---
for /f "tokens=2 delims==" %%v in ('node scripts\version-bump.mjs') do set "VERSION=%%v"
if not defined VERSION (
  echo VERSION BUMP FAILED — package.json unchanged. Abort.
  pause
  exit /b 1
)
echo Building version %VERSION%

echo --- Step 1: Kill running Sentinel processes ---
taskkill /F /IM "ARIA Sentinel.exe" 2>nul
taskkill /F /IM "ARIA-Sentinel.exe" 2>nul
timeout /t 3 /nobreak >nul

echo --- Step 2: Remove old win-unpacked ---
if exist "dist\win-unpacked" rd /S /Q "dist\win-unpacked" 2>nul

echo --- Step 3: Build the .exe (single build) ---
call npm run package:win
if errorlevel 1 (
  echo BUILD FAILED. Press any key to abort.
  pause
  exit /b 1
)
if not exist "dist\ARIA-Sentinel-%VERSION%-unsigned.exe" (
  echo .exe NOT found in dist. Abort.
  pause
  exit /b 1
)

echo --- Step 4: Copy .exe to public/sentinel-binaries/ ---
if not exist "..\public\sentinel-binaries" mkdir "..\public\sentinel-binaries"
copy /Y "dist\ARIA-Sentinel-%VERSION%-unsigned.exe" "..\public\sentinel-binaries\ARIA-Sentinel-%VERSION%-unsigned.exe" >nul
echo .exe copied.

echo --- Step 5: Open dist folder ---
start "" ".\dist"

echo --- Step 6: Auto-publish to OTA pipeline ---
call node scripts\publish-github-release.mjs %VERSION%
if errorlevel 1 (
  echo GitHub Release publish FAILED — manual recovery: upload dist .exe to the releases page
  goto :continue
)
call node scripts\publish-manifest.mjs %VERSION%
if errorlevel 1 (
  echo Manifest publish FAILED — open admin console Updates tab + click "Publish current dist"
)
:continue

echo.
echo ============================================================
echo  v%VERSION% built. Customer .exe staged + published to GitHub Release.
echo  Clients auto-detect on their next update poll. Admin install: run the admin .exe.
echo ============================================================
pause
