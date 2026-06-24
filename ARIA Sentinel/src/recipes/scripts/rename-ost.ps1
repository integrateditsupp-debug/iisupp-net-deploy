# ARIA Sentinel recipe: outlook-ost-repair-v1 / rename-ost  (R-04 OUTLOOK.CRASH)
# Yellow tier — restore point taken first, always confirmed (never auto-fires, even in Autonomous).
# Reversible: the cached mailbox file is RENAMED to .ost.aria.bak, never deleted. Outlook rebuilds a
# fresh .ost from the server on next launch; the user (or support) can rename the .bak back to recover.
# Run close-outlook first so the file is not locked. Source-of-truth mirror (executed inline via -Command).
Get-ChildItem "$env:LOCALAPPDATA\Microsoft\Outlook\*.ost" -ErrorAction SilentlyContinue | Rename-Item -NewName { $_.Name + '.aria.bak' } -ErrorAction SilentlyContinue
