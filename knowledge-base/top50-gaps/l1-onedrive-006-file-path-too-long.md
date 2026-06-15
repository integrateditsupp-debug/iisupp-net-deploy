---
id: l1-onedrive-006
title: "OneDrive won't sync — file path too long or illegal characters"
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
  - path too long onedrive
  - cannot sync file
  - file name contains invalid character
  - 400 character limit
  - this file path is too long
  - long file name
  - illegal characters file
  - rename to sync
tags:
  - onedrive
  - sync
  - file-path
  - top-50
related: [l1-onedrive-001-not-syncing, l1-onedrive-004-sync-paused-stuck]
---

# OneDrive can't sync — path or filename issue

### "This file path is too long" — over 400 chars total

OneDrive's hard limit is 400 chars for the full path (drive + folders + filename + extension). Identify the offender: right-click OneDrive icon → View Sync Problems → see the specific file flagged. Fix: rename a parent folder shorter, OR move the file to a higher-level folder, OR rename the file itself. Sync resumes within 60 seconds after the path is under 400.

### Illegal character in filename — `<` `>` `:` `"` `|` `?` `*` `\` `/`

Files copied from Mac, Linux, or another system may have characters Windows OneDrive rejects. View Sync Problems shows which file. Right-click in File Explorer → Rename → remove the bad character. Common offenders: colons in dates (`Meeting 9:00.docx` → `Meeting 9-00.docx`), question marks (`Is this final?.pdf` → `Is this final.pdf`).

### Trailing space or period at end of filename

OneDrive rejects filenames ending with space or period (Windows quirk). Visible test: rename file, hit End key, look for invisible space. Remove. Save. Sync proceeds.

### Reserved Windows names

`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9` (case-insensitive, with any extension). Files literally named these won't sync. Rename to anything else.

### Folder has 50+ characters AND nested 8+ levels deep

Not a single problem but combined. Open the deeply-nested folder. Move it up to OneDrive root or shorten parent folder names. Pattern: a typical bad case is `OneDrive\Documents\Projects\2026\Q2\Client Name Inc\Project Folder\Subproject Phase 3\Working Drafts\filename.docx` — flatten this hierarchy.

### Two files differ only by case (Mac-source)

On Mac, `Report.docx` and `report.docx` are different files. On Windows, they're the same. OneDrive can't sync both. Rename one to `Report-v2.docx` or similar.

### File is 250 GB and stuck

OneDrive single-file limit is 250 GB. Files over this need to be split or stored in SharePoint document library which has higher limits. If you're hitting this with backups: move to a dedicated backup tool, not OneDrive.

### View what's actually failing — the Sync Problems list

Right-click OneDrive cloud icon → "View sync problems." Shows every file that failed and why. Most useful diagnostic in OneDrive. Tackle one row at a time — fix file, refresh list, watch entries disappear. If 100+ files all share the same parent folder, that folder is the problem (path length, permissions, or shared-with weirdness).

### When to escalate to L2

Sync problems list shows files but renaming doesn't help. Files truly cannot be renamed (in use by an app that won't close). Sync problem persists after restart + reset + rename — possible OneDrive client corruption. SharePoint document library version of OneDrive returning permission errors → admin checks library config.
