---
id: l1-onedrive-004
title: "OneDrive sync paused, red X, or 'processing changes' forever"
category: onedrive
support_level: L1
severity: medium
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - onedrive sync stuck
  - onedrive red x
  - processing changes
  - onedrive paused metered
  - onedrive reset
  - file in use cant sync
  - sync icon spinning forever
  - onedrive battery saver
tags:
  - onedrive
  - sync
  - top-50
related: [l1-onedrive-001-not-syncing, l1-onedrive-002-restore-deleted-file, l1-onedrive-003-version-conflict]
---

# OneDrive sync stuck

### Red X on OneDrive icon — sync paused because of metered network

OneDrive auto-pauses on metered or low-battery connections to save data/power. Right-click OneDrive cloud icon in system tray → Settings → Sync and backup → uncheck "Pause syncing when this device is on a metered network" and "Pause syncing when this device is in battery saver mode." Click Resume. Sync resumes within 30 seconds.

### "Processing changes" spins forever on one file

That single file is the blocker. Hover the OneDrive icon — it usually shows which file is stuck. Common causes: filename has illegal characters (`<`, `>`, `:`, `"`, `|`, `?`, `*`), path too long (over 400 chars total), or file is open in another app holding a lock. Fix: rename the file removing illegal chars, shorten the folder path, or close the app that has it open. Sync clears within 60 seconds.

### Reset OneDrive completely

Last-resort fix when nothing else works. Quit OneDrive (right-click icon → Quit OneDrive). Open Run dialog (Win+R), paste: `%localappdata%\Microsoft\OneDrive\onedrive.exe /reset` — Enter. Wait 60 seconds. OneDrive auto-restarts. If it doesn't, manually launch from Start. Your files are safe — reset only clears the sync state.

### "Some files are locked and won't sync"

Office files held open by Word/Excel/PowerPoint block sync. Close every Office app completely (Task Manager → end winword.exe, excel.exe, powerpnt.exe). Wait 30 seconds. OneDrive re-attempts. Also check: anti-virus / backup software (Carbonite, CrashPlan) sometimes locks files during scan. Pause AV temporarily to confirm.

### OneDrive shows "Up to date" but my colleague says they don't see my file

Click File Explorer → navigate to OneDrive folder → the file should have a green check mark (synced). If it shows a cloud icon, it's not actually uploaded yet — open it once to trigger upload. If it shows red X, sync failed for that file specifically. If green check but colleague still can't see, they may be looking at the wrong folder OR their sync is paused.

### Unlink and relink account

When the OneDrive client itself is misbehaving despite reset. Right-click OneDrive icon → Settings → Account → "Unlink this PC." Files stay on disk; sync stops. Sign in again with your work account. Choose your existing OneDrive folder when prompted (don't pick a new location). Sync rebuilds within 5-30 minutes depending on folder size.

### When to escalate to L2

You've reset OneDrive, unlinked + relinked, and sync is still broken after 30 minutes → L2. Also: errors mentioning "credential failure" repeatedly, sync queue stuck at the same number forever, or admin-controlled Known Folder Move (Desktop/Documents/Pictures redirection) failing on first setup.
