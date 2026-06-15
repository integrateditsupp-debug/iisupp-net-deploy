---
id: l1-onedrive-005
title: "OneDrive Known Folder Move — Desktop / Documents / Pictures not syncing"
category: onedrive
support_level: L1
severity: medium
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - known folder move
  - kfm
  - desktop not syncing
  - documents not in onedrive
  - kfm setup failed
  - protect your folders
  - onedrive folder redirection
  - kfm policy
tags:
  - onedrive
  - kfm
  - top-50
related: [l1-onedrive-001-not-syncing, l1-onedrive-004-sync-paused-stuck]
---

# OneDrive Known Folder Move (Desktop / Documents / Pictures)

### What is KFM and why your Desktop is suddenly in OneDrive

Known Folder Move (KFM) redirects your Windows Desktop, Documents, and Pictures folders to live inside OneDrive instead of locally on C:\Users\You. Your IT may have enabled this via Intune policy so your files survive a laptop swap. Visible signs: Desktop folder path now reads C:\Users\You\OneDrive\Desktop. Files moved automatically. Nothing was deleted.

### Files I had on Desktop are missing after KFM activation

They moved to OneDrive\Desktop, didn't delete. Open File Explorer → OneDrive → Desktop. If files aren't there either, they're still syncing — wait 10-30 minutes for the initial upload. Status visible: right-click OneDrive icon → see queue. If files truly missing after sync completes, check OneDrive Recycle Bin (onedrive.live.com → Recycle bin).

### "Protect your folders" prompt keeps appearing

Windows wants you to opt in to KFM. If your IT hasn't enforced it via policy, you can dismiss and ignore. If you DO want to enable: right-click OneDrive icon → Settings → Sync and backup → Manage backup → check Desktop / Documents / Pictures → Start backup. Migration takes 5-60 minutes depending on folder size.

### Saved files to Desktop, they're not appearing on my other PC

KFM only syncs to OneDrive after files are saved and detected. Check status: hover OneDrive icon → see if sync is paused/active. If active, file should appear on other PC within 30 seconds for small files, longer for large. If 5+ minutes pass: see KB l1-onedrive-004 for stuck-sync diagnosis.

### KFM setup failed with error 0x80070005 or similar

Most common cause: Desktop path is currently used by a third-party tool (cloud backup software, Dropbox redirecting it, custom shell extension). KFM can't overlay another redirect. Disable other cloud sync tools, retry KFM. Or: existing Desktop folder has a file with illegal characters / over-long path. KFM lists the blocker — fix that one file/folder, retry.

### Disable KFM (revert to local folders)

Right-click OneDrive icon → Settings → Sync and backup → Manage backup → click "Stop backup" next to Desktop / Documents / Pictures. Files stay in OneDrive but new files go to local C:\Users\You\Desktop. Old files won't auto-move back; you do that manually or leave them in OneDrive.

### Pictures folder showing 200,000 files I don't recognize

Your iPhone or iPad is also syncing photos to OneDrive Pictures (Camera Roll). Settings → Notifications & actions → check OneDrive mobile is uploading. To stop: OneDrive mobile app → Settings → Camera upload → off. Local Pictures folder isn't affected once that's off.

### When to escalate to L2

KFM is admin-enforced and failing silently. Migration appears stuck for hours. Other Cloud-Sync tools (Box, Dropbox Business, Google Drive for desktop) conflict with KFM. Files truly lost after KFM activation (rare, but possible with corrupt sync state) — L2 + Microsoft support for OneDrive recovery.
