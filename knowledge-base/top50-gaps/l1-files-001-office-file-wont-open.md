---
id: l1-files-001
title: "Excel / Word / PowerPoint won't open — file is corrupt, locked, or in use"
category: files
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["You have the file (locally, OneDrive, SharePoint, or email attachment)"]
keywords:
  - file is locked for editing
  - file is in use
  - excel file wont open
  - word file corrupt
  - powerpoint corrupted
  - cannot open file
  - protected view
  - file format not valid
  - the file is corrupt and cannot be opened
  - excel found unreadable content
  - read-only file
  - .xlsx wont open
  - .docx wont open
tags:
  - files
  - office
  - top-50
related: [l1-fileshare-001-cant-open-shared-file, l1-onedrive-003-version-conflict, l1-outlook-001-not-receiving-emails]
---

# Office file won't open — diagnose the cause and recover

## Symptoms

- "The file is corrupt and cannot be opened"
- "File is locked for editing by [name]"
- "File is in use" / "Document is locked"
- Excel: "We found a problem with some content. Do you want us to try to recover as much as we can?"
- Word: opens blank or with garbled text
- "Cannot access [filename]"
- Protected View bar at top, "Editing this file is restricted"
- Office insists on opening as read-only

These break down into 5 distinct problems with different fixes.

## Step 1 — Identify which problem you have

| Error / behavior | Most likely cause | Skip to |
|---|---|---|
| "Locked for editing by [person]" | Real collaboration lock OR stale lock | Step 2 |
| "Locked for editing" but you're alone | Stale lock file from previous crash | Step 3 |
| "File is corrupt" / unreadable | Actual corruption | Step 4 |
| Protected View / "from internet" | Office's security feature | Step 5 |
| Opens read-only with no error | File permissions or read-only attribute | Step 6 |

## Step 2 — Someone else is editing (real co-author lock)

### If it's a OneDrive / SharePoint / Teams file
- Modern Office supports real-time co-authoring — multiple people CAN edit at once.
- If the lock appears, the file isn't co-author-enabled OR they're using an older Office version.
- **Easiest fix:** message the person, ask them to close the file.
- **Alternative:** Open via the web (open onedrive.com / sharepoint.com → click the file → Open in browser). Browser version usually allows co-edit.

### If it's a network share file (older corporate setup)
- Real Windows file lock. Only one editor at a time.
- Message owner. Or open read-only and save your version with a different name.

## Step 3 — Stale lock file (you're alone but it says locked)

A previous Office crash left an "owner file" behind. Office creates a tiny hidden file alongside any open Office doc (e.g., `~$MyReport.docx`) — if Office crashes, this lock file stays and blocks reopening.

### Fix
1. Close all Office apps.
2. Open File Explorer to the folder containing the document.
3. Enable hidden files: View → Show → Hidden items (Windows 11) or View tab → Hidden items (Win 10).
4. Look for a file starting with `~$` — same name as your document.
5. Delete that `~$` file.
6. Reopen the original document.

For OneDrive / SharePoint:
- Close all Office apps. Wait 60 seconds.
- Right-click the OneDrive cloud icon → Pause syncing → Resume syncing.
- Reopen the file.
- If still locked, sign out of Office (File → Account → Sign out), reopen Office.

## Step 4 — Actual file corruption

### Symptom
Office offers to "recover" content. Or the file just won't open at all. Or open and content is garbled.

### Recover within Office

**Excel / Word / PowerPoint:**
1. **File → Open**.
2. Browse to the file but **don't open it yet** — single-click to select.
3. Click the **dropdown arrow** next to the Open button.
4. Choose **"Open and Repair"**.
5. Pick **Repair** first (recovers most). If that fails, try **Extract Data**.

### Recover from auto-save / version history

**For OneDrive / SharePoint files:**
1. Right-click the file in OneDrive / SharePoint → **Version history**.
2. Pick a version from before the corruption.
3. Click ... → Restore.

**For local files:**
1. Open the Office app.
2. **File → Info → Manage Document → Recover Unsaved Documents** (or similar wording).
3. Pick the auto-saved version.

### If Excel only — try alternate methods
1. Save the corrupt .xlsx as .xls (older format) — open via File → Open → change file type filter.
2. Or rename .xlsx → .zip → extract → look inside `xl/worksheets/` for raw XML you can manually fix or import to a new sheet.

### If it's a PDF
- Different track entirely. Reopen in Adobe Reader. If still corrupt, drag into chrome.com (drop into Chrome address bar) — Chrome's PDF engine is forgiving.

## Step 5 — Protected View / "from internet"

Office sees the file came from a risky source (email attachment, internet download) and opens it read-only by default.

### Enable editing — single file
1. Click the **yellow banner** at top of the document → "Enable Editing."
2. Yes, you trust this file.
3. You can now edit + save.

### Stop the prompt for files in a trusted folder
1. File → Options → Trust Center → Trust Center Settings.
2. Trusted Locations → add your work folder.
3. Office will skip Protected View for files there.

⚠️ **Only do this for folders you control.** Don't disable Protected View globally — it's a real malware defense.

## Step 6 — Read-only / permissions

### Fix file's read-only flag (Windows)
1. Right-click file → Properties.
2. Uncheck **Read-only** at bottom.
3. Apply.

### Fix folder permissions (rare)
1. Right-click parent folder → Properties → Security.
2. Click Edit → ensure your user has Modify rights.
3. Apply.

### macOS
1. Right-click file → Get Info.
2. At bottom: Sharing & Permissions → click the lock to authenticate.
3. Set your user to **Read & Write**.

## Specific scenarios

### "Excel says 'we removed records: PivotTable from /xl/pivotTables/...'"
Partial corruption in pivot tables only. The rest of your data is fine. Repair process strips bad pivots and saves the recovered file.

### "The file opens but my macros / formulas / charts are gone"
Possible recovery dropped them. Check if you have an earlier version (OneDrive Version history) — restore that.

### "It won't open on my machine but opens on my colleague's"
- Office version mismatch. Your install may be missing a patch. Check Office for updates: File → Account → Update Options → Update Now.

### "Cannot open shared OneDrive file from Outlook attachment"
- Save the attachment locally first (Right-click attachment → Save As). Then open from your hard drive.
- If still fails, ask sender to share the original OneDrive/SharePoint link instead of attaching.

### "File is too large — Excel hangs"
- Office has hard limits (1M rows, but practical limits much lower at ~500K rows + heavy formulas).
- Open in Power BI or Python (pandas) for big files.
- For Excel itself: open in Safe Mode (Win+R → `excel /safe`) which skips add-ins that bloat memory.

## When to escalate

| Situation | Path |
|---|---|
| Open and Repair fails AND no version history | L2 — may need data recovery / professional tool |
| Multiple files corrupted at once on same drive | L2 — possible disk/sync issue |
| Files from one user always fail | L2 — that user's Office install may have bugs |
| Persistent locked-by-self issue | L2 — Office sign-out + cache clean |
| Macro-enabled files (.xlsm / .docm) blocked by policy | L2 — Group Policy / Mark of the Web issue |

## Prevention

- Save to OneDrive / SharePoint — auto-versioning means you can always rollback.
- Don't email .docx / .xlsx as attachments between collaborators — share the OneDrive link instead.
- AutoSave: turn it ON in every Office app (File → toggle at top).
- Keep Office updated — patches fix the most common file-format bugs.
- For critical files, manual versioning: save daily backups as filename_2026-05-13.xlsx.

## What ARIA can help with

ARIA can identify which of the 5 problem types you're hitting from your error message, walk you through Open and Repair step-by-step, and tell you whether your file is recoverable or you should escalate. ARIA cannot perform manual XML surgery for forensic recovery.
