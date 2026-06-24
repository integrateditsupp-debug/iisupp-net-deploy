@echo off
title ARIA Sentinel - Backup current dist
setlocal
set TIMESTAMP=%date:~10,4%%date:~4,2%%date:~7,2%-%time:~0,2%%time:~3,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP=dist-backups\v0.1.x-%TIMESTAMP%
mkdir "%BACKUP%" 2>nul
echo Copying dist contents to %BACKUP%...
xcopy /Y dist\*.exe "%BACKUP%\"
xcopy /Y dist\*.blockmap "%BACKUP%\"
xcopy /Y dist\*.yml "%BACKUP%\"
xcopy /Y dist\*.yaml "%BACKUP%\"
echo.
echo Done. Backup at: %CD%\%BACKUP%
pause
