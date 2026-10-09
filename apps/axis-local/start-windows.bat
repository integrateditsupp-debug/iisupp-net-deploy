@echo off
cd /d "%~dp0"
if not exist "%USERPROFILE%\.axis-local.json" (
  set /p KEY=Paste your Axis pairing key: 
  call node axis-local.mjs pair %KEY%
)
node axis-local.mjs
pause
