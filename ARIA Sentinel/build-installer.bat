@echo off
setlocal enabledelayedexpansion
title ARIA Sentinel - Build Installer (verified)
cd /d "%~dp0"
echo ============================================================
echo  ARIA Sentinel - Build the Windows installer (NSIS + MSI)
echo  Working dir: %CD%
echo  Every step below is checked. A failed step stops here and
echo  says so - nothing is reported as done that did not happen.
echo ============================================================
echo.

rem ---- optional signing environment (kept OUTSIDE the repo, never committed) ----
rem   %USERPROFILE%\.aria-sentinel-signing.bat  with lines such as
rem     set AZURE_SIGNING_ENDPOINT=https://eus.codesigning.azure.net
rem     set AZURE_SIGNING_ACCOUNT=<your Trusted Signing account>
rem     set AZURE_SIGNING_PROFILE=<your certificate profile>
rem     set AZURE_TENANT_ID=... / AZURE_CLIENT_ID=... / AZURE_CLIENT_SECRET=...
rem   or, for a PFX:  set CSC_LINK=C:\path\to\cert.pfx  /  set CSC_KEY_PASSWORD=...
rem   See docs\SIGNING.md. Without it this is an UNSIGNED build and the script says so.
if exist "%USERPROFILE%\.aria-sentinel-signing.bat" (
  echo Signing environment: loading %USERPROFILE%\.aria-sentinel-signing.bat
  call "%USERPROFILE%\.aria-sentinel-signing.bat"
) else (
  echo Signing environment: none found at %USERPROFILE%\.aria-sentinel-signing.bat
  echo   -^> this will be an UNSIGNED pilot build. Windows SmartScreen will warn customers. See docs\SIGNING.md.
)
echo.

rem ---- Step 1/5: Node ----
echo Step 1/5: checking Node (22 or newer is required)...
where node >nul 2>nul
if errorlevel 1 (
  echo   FAILED: node is not on PATH. Install Node 22 LTS from https://nodejs.org and rerun.
  pause
  exit /b 1
)
set "NODE_MAJOR="
for /f "tokens=1 delims=." %%a in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%a"
if not defined NODE_MAJOR (
  echo   FAILED: could not read the Node version.
  pause
  exit /b 1
)
if %NODE_MAJOR% LSS 22 (
  echo   FAILED: Node %NODE_MAJOR% is too old. Install Node 22 LTS and rerun.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo   OK: node %%v
echo.

rem ---- Step 2/5: npm ci ----
echo Step 2/5: npm ci (clean install from package-lock.json)...
call npm ci --no-audit --no-fund
if errorlevel 1 (
  echo   FAILED: npm ci did not complete. Read the error above. Nothing was built.
  pause
  exit /b 1
)
echo   OK: dependencies installed.
echo.

rem ---- Step 3/5: tests ----
echo Step 3/5: desktop battery, node tests\run-all.mjs --app-only (every desktop suite must be green BEFORE packaging; site/flywheel suites run in the root guard)...
if not exist "%~dp0dist" mkdir "%~dp0dist"
set "TEST_LOG=%~dp0dist\build-test.log"
call node tests\run-all.mjs --app-only > "%TEST_LOG%" 2>&1
set "TEST_RC=%errorlevel%"
echo   --- test summary (full log: %TEST_LOG%) ---
findstr /C:"suites taken" /C:"SUITE RED" /C:"SUITE INCOMPLETE" /C:"FAILED TO LOAD" /C:"NOT TAKEN" "%TEST_LOG%"
findstr /R /C:"^# tests [0-9]" "%TEST_LOG%" | find /C "# tests" > "%TEMP%\aria-sentinel-suitecount.txt"
set /p SUITES_WITH_COUNTS=<"%TEMP%\aria-sentinel-suitecount.txt"
echo   node:test suites reporting counts: %SUITES_WITH_COUNTS%
findstr /R /C:"^# fail [1-9]" "%TEST_LOG%" >nul 2>nul
if not errorlevel 1 (
  echo   node:test suites with failures:
  findstr /R /C:"^# fail [1-9]" "%TEST_LOG%"
)
if not "%TEST_RC%"=="0" (
  echo   FAILED: npm test exited %TEST_RC%. The build is NOT allowed to continue on a red suite.
  echo   Open %TEST_LOG% for the first failing suite.
  pause
  exit /b 1
)
echo   OK: test suite green.
echo.

rem ---- Step 4/5: package ----
echo Step 4/5: npm run package:win (allow-list check -^> voice model -^> electron-builder nsis + msi -^> verify)...
call npm run package:win
set "PKG_RC=%errorlevel%"
if not "%PKG_RC%"=="0" (
  echo   FAILED: packaging exited %PKG_RC%. Read the lines above - the verifier names the problem.
  echo   Common causes: electron-builder could not download Electron / NSIS / WiX ^(network^), a file in dist\ is open,
  echo   signing was requested but the certificate or Azure credentials are wrong ^(forceCodeSigning stops the build^).
  pause
  exit /b 1
)
echo.

rem ---- Step 5/5: verify + hashes ----
echo Step 5/5: verifying dist\ (paths, SHA-256, signed/unsigned verdict)...
call npm run package:win:verify --silent
if errorlevel 1 (
  echo   FAILED: verification found a problem. Do not publish this build.
  pause
  exit /b 1
)
echo   --- certutil SHA-256 (independent of the node verifier) ---
for %%f in ("dist\ARIA-Sentinel-*-setup.exe" "dist\ARIA-Sentinel-*-unsigned.exe" "dist\ARIA-Sentinel-*-setup.msi" "dist\ARIA-Sentinel-*-unsigned.msi") do (
  if exist "%%~f" (
    echo   %%~nxf
    certutil -hashfile "%%~f" SHA256 | findstr /V /C:"CertUtil" /C:"hash of"
  )
)
where signtool >nul 2>nul
if not errorlevel 1 (
  echo   --- signtool verify /pa ---
  for %%f in ("dist\ARIA-Sentinel-*-setup.exe" "dist\ARIA-Sentinel-*-unsigned.exe") do (
    if exist "%%~f" signtool verify /pa "%%~f"
  )
) else (
  echo   ^(signtool not on PATH - the PowerShell Authenticode verdict above is the signature check^)
)
echo.
echo ============================================================
echo  BUILD COMPLETE AND VERIFIED - see dist\RELEASE-^<version^>.json
echo  Next step: publish.
echo    ota-build.bat                      -^> bump + build + GitHub Release + update manifest (full OTA path)
echo    node scripts\publish-github-release.mjs   -^> upload the installer to a GitHub Release
echo    node scripts\publish-manifest.mjs [--url https://host/file.exe]  -^> point the update feed at it
echo  Needs: GITHUB_TOKEN (release) and SENTINEL_ADMIN_TOKEN (manifest). See docs\distribution\ and docs\SIGNING.md.
echo ============================================================
echo.
echo Press any key to open the dist folder in File Explorer...
pause >nul
start "" "%CD%\dist"
endlocal
