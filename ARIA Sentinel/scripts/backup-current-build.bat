@echo off
title ARIA Sentinel - Backup current dist
setlocal
cd /d "%~dp0\.."
set "VERSION="
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "VERSION=%%v"
if not defined VERSION set "VERSION=unknown"
set TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%-%time:~0,2%%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP=dist-backups\v%VERSION%-%TIMESTAMP%
mkdir "%BACKUP%" 2>nul
echo Copying dist contents (installers, msi, blockmaps, feed, release facts) to %BACKUP%...
xcopy /Y dist\*.exe "%BACKUP%\"
xcopy /Y dist\*.msi "%BACKUP%\"
xcopy /Y dist\*.blockmap "%BACKUP%\"
xcopy /Y dist\*.yml "%BACKUP%\"
xcopy /Y dist\*.yaml "%BACKUP%\"
xcopy /Y dist\RELEASE-*.json "%BACKUP%\"
echo.
echo Done. Backup at: %CD%\%BACKUP%  (dist-backups\ is gitignored - never committed)
pause
