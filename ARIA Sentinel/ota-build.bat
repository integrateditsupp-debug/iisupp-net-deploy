@echo off
title ARIA Sentinel - Build + publish one release (OTA)
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ============================================================
echo  ARIA Sentinel OTA build - ONE build for everyone (RUN 23e):
echo  the admin console ships to all (extraResources) and unlocks
echo  only for an admin-tier license key. This will:
echo    0. Auto-bump the version (skip with [no-bump] in the commit SUBJECT)
echo       - package.json, package-lock.json, the recipes.mjs fallback literal,
echo         and a DRAFT docs\RELEASE_NOTES_^<version^>.md if none exists
echo    1. Kill any running ARIA Sentinel processes
echo    2. Clean the old win-unpacked dir, then run the test suite (must be green)
echo    3. Build the installer (package:win = nsis + msi, verified, SHA-256, signed/unsigned verdict)
echo    4. (opt-in) copy the installer under ..\public\sentinel-binaries\ - OFF by default:
echo       installers are NOT committed to git any more (set SENTINEL_COPY_TO_PUBLIC=1 to keep the old behaviour)
echo    5. Open the dist folder
echo    6. Publish: GitHub Release (installer + latest.yml) + the update manifest
echo       - needs GITHUB_TOKEN and SENTINEL_ADMIN_TOKEN in this shell
echo       - set SENTINEL_BINARY_URL=https://... to point the manifest at your own host instead
echo       - set GITHUB_RELEASE_REPO=owner/repo to publish to a public releases-only repo
echo ============================================================
echo.

if exist "%USERPROFILE%\.aria-sentinel-signing.bat" (
  echo Signing environment: loading %USERPROFILE%\.aria-sentinel-signing.bat
  call "%USERPROFILE%\.aria-sentinel-signing.bat"
) else (
  echo Signing environment: none - UNSIGNED build ^(SmartScreen will warn^). See docs\SIGNING.md.
)
echo.

echo --- Step 0: Auto version bump ---
set "VERSION="
for /f "tokens=2 delims==" %%v in ('node scripts\version-bump.mjs') do set "VERSION=%%v"
if not defined VERSION (
  echo VERSION BUMP FAILED - package.json unchanged. Abort.
  pause
  exit /b 1
)
echo Building version %VERSION%
if not exist "docs\RELEASE_NOTES_%VERSION%.md" (
  echo docs\RELEASE_NOTES_%VERSION%.md is missing - the bump should have created a DRAFT. Abort.
  pause
  exit /b 1
)
findstr /C:"Audience: DRAFT" "docs\RELEASE_NOTES_%VERSION%.md" >nul 2>nul
if not errorlevel 1 (
  echo.
  echo WARNING: docs\RELEASE_NOTES_%VERSION%.md is still the DRAFT stub. Customers will see it in the
  echo          update feed and the GitHub Release. Press Ctrl+C to stop and write the notes first,
  echo          or any key to continue with the draft.
  pause >nul
)

echo --- Step 1: Kill running Sentinel processes ---
taskkill /F /IM "ARIA Sentinel.exe" 2>nul
taskkill /F /IM "ARIA-Sentinel.exe" 2>nul
timeout /t 3 /nobreak >nul

echo --- Step 2: Remove old win-unpacked, then run the tests ---
if exist "dist\win-unpacked" rd /S /Q "dist\win-unpacked" 2>nul
set "TEST_LOG=%TEMP%\aria-sentinel-ota-test.log"
call npm test > "%TEST_LOG%" 2>&1
set "TEST_RC=%errorlevel%"
findstr /C:"suites taken" /C:"SUITE RED" /C:"SUITE INCOMPLETE" /C:"FAILED TO LOAD" /C:"NOT TAKEN" "%TEST_LOG%"
if not "%TEST_RC%"=="0" (
  echo TESTS RED ^(npm test exited %TEST_RC%^). Nothing is built or published on a red suite. Log: %TEST_LOG%
  pause
  exit /b 1
)
echo Tests green.

echo --- Step 3: Build the installer (single build, verified) ---
call npm run package:win
if errorlevel 1 (
  echo BUILD FAILED. Press any key to abort.
  pause
  exit /b 1
)
set "ARTIFACT="
if exist "dist\ARIA-Sentinel-%VERSION%-setup.exe" set "ARTIFACT=dist\ARIA-Sentinel-%VERSION%-setup.exe"
if not defined ARTIFACT if exist "dist\ARIA-Sentinel-%VERSION%-unsigned.exe" set "ARTIFACT=dist\ARIA-Sentinel-%VERSION%-unsigned.exe"
if not defined ARTIFACT (
  echo Installer NOT found in dist ^(expected ARIA-Sentinel-%VERSION%-setup.exe or ARIA-Sentinel-%VERSION%-unsigned.exe^). Abort.
  pause
  exit /b 1
)
echo Installer: %ARTIFACT%

echo --- Step 4: Copy to public/sentinel-binaries/ (opt-in; installers are not committed) ---
if "%SENTINEL_COPY_TO_PUBLIC%"=="1" (
  if not exist "..\public\sentinel-binaries" mkdir "..\public\sentinel-binaries"
  for %%f in ("%ARTIFACT%") do copy /Y "%ARTIFACT%" "..\public\sentinel-binaries\%%~nxf" >nul
  echo Copied to ..\public\sentinel-binaries\ - do NOT git add it ^(100 MB binaries do not belong in the repo^).
) else (
  echo Skipped ^(SENTINEL_COPY_TO_PUBLIC is not 1^). The installer stays in dist\ and is published in Step 6.
)

echo --- Step 5: Open dist folder ---
start "" ".\dist"

echo --- Step 6: Auto-publish to the OTA pipeline ---
if defined SENTINEL_BINARY_URL (
  echo SENTINEL_BINARY_URL is set - skipping the GitHub Release, the manifest will point at %SENTINEL_BINARY_URL%
  echo ^(upload %ARTIFACT% to that exact URL yourself before customers poll^)
  goto :manifest
)
call node scripts\publish-github-release.mjs %VERSION%
if errorlevel 1 (
  echo GitHub Release publish FAILED - manual recovery: upload the dist installer to the releases page, then
  echo    node scripts\publish-manifest.mjs %VERSION% --url https://github.com/^<owner^>/^<repo^>/releases/download/sentinel-v%VERSION%/^<file^>
  goto :continue
)
:manifest
call node scripts\publish-manifest.mjs %VERSION%
if errorlevel 1 (
  echo Manifest publish FAILED - read the reason above ^(a host outside the server allow-list needs
  echo    SENTINEL_UPDATE_HOSTS set on Netlify^), or open the admin console Updates tab + "Publish current dist".
)
:continue

echo.
echo ============================================================
echo  v%VERSION% built from %ARTIFACT%.
echo  Published: see the two publish results above - a FAILED line means NOT published.
echo  Clients poll the manifest on their next update check. Admin install: the same installer, admin key.
echo ============================================================
pause
