@echo off
title ARIA Vault — Auto-Capture Watcher
cd /d "%~dp0"
echo Starting auto-capture watcher on 05_Inbox\_capture.md...
echo Leave this window open. Close to stop watching.
echo.
node scripts/watch-inbox.mjs
pause
