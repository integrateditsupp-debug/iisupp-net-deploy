---
id: l1-onedrive-001
title: "OneDrive not syncing / paused / stuck on 'looking for changes'"
category: onedrive
support_level: L1
severity: medium
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - onedrive
  - not syncing
  - paused
  - looking for changes
  - sync stuck
  - red x
  - upload pending
  - blocked file
related_articles:
  - l1-onedrive-002
  - l2-sharepoint-001
escalation_trigger: "Sync error code 0x8004... persists after reset, or pattern across multiple users on same tenant"
last_updated: 2026-05-07
version: 1.0
---

# OneDrive not syncing

## 1. Symptoms
- OneDrive cloud icon shows red X, paused symbol, or sync arrow stalled.
- "Looking for changes" message stays for hours.
- File modified locally doesn't appear in OneDrive web.
- Specific files fail with "couldn't sync" notification.
- "OneDrive isn't connected. Click here to sign in."

## 2. Likely Causes
1. OneDrive paused (battery saver, metered network, manual pause).
2. File name has illegal characters (`<>:"/\|?*` or trailing space/period).
3. File path > 400 characters total.
4. File >250 GB (size cap).
5. Account credentials expired.
6. Storage quota exceeded.
7. File locked by an application (open in Word/Excel).
8. Folder location moved while OneDrive was running.

## 3. Questions To Ask User
1. What does the OneDrive icon look like (red X, paused, normal cloud, blue arrows)?
2. Are all files affected, or specific ones?
3. What's your OneDrive storage usage? (right-click cloud → Settings → Account.)
4. Is the file currently open in another app?
5. Are you on battery, on Wi-Fi, on a metered connection?

## 4. Troubleshooting Steps
1. Click cloud icon → if paused, click Resume.
2. Settings → Sync and backup → uncheck "Pause sync when this device is on battery / metered network" if needed.
3. Check name of any flagged file → rename to remove special characters.
4. Check path length: `where.exe /R C:\Users\<user>\OneDrive *` — anything >400 chars must be shortened.
5. Verify quota: cloud → Settings → Account → "X GB of Y GB used".

## 5. Resolution Steps
**If paused / network:**
- Resume; if still stalled, switch to a different network briefly to confirm reachability.

**If file-level sync errors:**
- Right-click cloud → View sync problems.
- Click each entry → fix per error message.
- Common: rename file (drop emoji / special chars), shorten path, close app holding lock, or move file to a shorter folder.

**If OneDrive itself is stuck:**
1. Right-click cloud → Quit OneDrive.
2. Run reset: Win+R → `%localappdata%\Microsoft\OneDrive\onedrive.exe /reset` → Enter.
3. If icon doesn't reappear in 5 min, run `%localappdata%\Microsoft\OneDrive\onedrive.exe`.
4. Sign in fresh.

**If credentials expired:**
- Same reset; on relaunch, sign in with work account.

**If quota:**
- Web: onedrive.live.com → file usage report → archive or delete.
- Or: admin assigns 1 TB → 5 TB upgrade per Microsoft 365 SKU.

## 6. Verification Steps
- Cloud icon shows green check (or "Up to date").
- "View sync problems" empty.
- Test file: create new file in synced folder → verify in OneDrive web within 60s.
- 24h of normal use without sync error notifications.

## 7. Escalation Trigger
- Reset + sign-in fails repeatedly.
- Error codes 0x8004de40, 0x8004de80, 0x80070184, or 0x8007016A persist.
- Mass file conflicts after a known shared folder change.
- KFM (Known Folder Move) errors during enrollment.
- → Escalate to **L2** with: OneDrive version, error codes, sync log path output, and tenant info.

## 8. Prevention Tips
- Avoid emojis and special chars in file/folder names.
- Don't store OneDrive root inside another sync tool (Dropbox, Google Drive) — pick one.
- Close Office files before forcing sync.
- Keep OneDrive updated.
- For laptops with SSDs <256 GB, enable Files On-Demand.

## 9. User-Friendly Explanation
"OneDrive paused or got stuck. Either it doesn't trust your network right now, or one file has a character it doesn't like (think emoji or a colon in the name). We'll resume, fix the troublemaker file, and confirm everything is making it to the cloud. If it's deeper than that, a reset clears the slate cleanly."

## 10. Internal Technician Notes
- Reset command full: `%localappdata%\Microsoft\OneDrive\onedrive.exe /reset` (per-user) or `"C:\Program Files\Microsoft OneDrive\OneDrive.exe" /reset` (per-machine).
- Logs: `%localappdata%\Microsoft\OneDrive\logs\` — `SyncDiagnostics.log` is the goldmine for L2.
- KFM (Known Folder Move): admin-controlled. Verify Group Policy / Intune CSPs `KFMSilentOptIn`.
- Known sync errors:
  - 0x8004de40 — sign-in error.
  - 0x8004de80 — token expired.
  - 0x80070184 — file too large or quota.
  - 0x8007016A — file is in use.
- For corporate, check that `oneclient.sfx.ms` / `*.onedrive.com` / `*.sharepoint.com` aren't blocked at proxy.
- Files On-Demand (Win10 1709+) — check status: `fsutil reparsepoint query "C:\Users\<user>\OneDrive\file"`.

## 11. Related KB Articles
- l1-onedrive-002 — File restore from version history
- l2-sharepoint-001 — SharePoint sync conflicts

## 12. Keywords / Search Tags
onedrive, not syncing, paused, looking for changes, sync stuck, red x, upload pending, blocked file
