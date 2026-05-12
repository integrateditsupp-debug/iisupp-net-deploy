---
id: l1-file-recovery-001
title: "Recover a deleted or lost file — OneDrive, SharePoint, Teams, Recycle Bin"
category: file-management
support_level: L1
severity: medium
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+", "iOS 15+", "Android 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: []
keywords:
  - deleted file
  - file recovery
  - recycle bin
  - trash
  - onedrive restore
  - sharepoint restore
  - version history
  - file history
  - file versions
  - recover document
  - undelete
  - lost file
  - find file
related_articles:
  - l1-onedrive-001-not-syncing
  - l1-onedrive-002-restore-deleted-file
  - l1-onedrive-003-version-conflict
escalation_trigger: "File deleted > 30 days ago AND not in any restore path → ticket IT for backup tape / Azure Blob soft-delete recovery (may have additional retention)."
last_invoked: 2026-05-12
last_updated: 2026-05-12
version: 1.0
---

# Recover a deleted or lost file

## 1. Symptoms
- Accidentally deleted a file. Need it back.
- Saved over a file with wrong version. Need previous.
- Can't find a file you remember creating.
- Coworker says "you deleted [thing]" but you don't remember doing it.

## 2. Decision Tree (where to look first)

### Case A — Deleted from your computer's local disk

**Windows:**
1. **Recycle Bin** on desktop. Open. Look for file.
2. Right-click → **Restore** → goes back to original location.

**macOS:**
1. **Trash** in Dock.
2. Right-click file → **Put Back** → original location.

### Case B — File was in OneDrive / SharePoint / Teams (Files tab)

This is where 80% of work files live. Recovery is easy:

**Step 1 — OneDrive web recycle bin.**
- Open browser → `https://onedrive.live.com` (personal) or `https://[tenant]-my.sharepoint.com` (work).
- Left sidebar → **Recycle bin**.
- Find file → click → **Restore**.
- *(What you should see: File reappears in its original folder within 60 seconds.)*

**Step 2 — Second-stage recycle bin (deleted from recycle bin).**
- In OneDrive Recycle bin → bottom → "Second-stage recycle bin" link.
- Files live here for **additional 30 days** after being deleted from first recycle bin.
- 93 days total recovery window.

**Step 3 — SharePoint Online recycle bin.**
- Open the SharePoint site → bottom-left → **Recycle bin**.
- Same first-stage + second-stage pattern.

**Step 4 — Teams Files recovery.**
- A Teams channel's Files tab is actually a SharePoint folder.
- Click "Open in SharePoint" → use SharePoint recycle bin per Step 3.

### Case C — Saved over a file (wrong version saved)

**OneDrive / SharePoint Online (use this — it's gold):**
1. Open OneDrive web.
2. Find the file → right-click → **Version history**.
3. List of versions with timestamps + author.
4. Click an older version → **Restore** OR **Open** to preview first.

**Office desktop apps (Word/Excel/PowerPoint):**
1. File menu → **Info** → **Version History**.
2. Click a version → restore.

**macOS Time Machine:**
- If you have Time Machine: enter Time Machine → navigate to file's folder → scroll back to earlier date → Restore.

**Windows File History:**
- Settings → System → Storage → Advanced → File History — only works if you set it up beforehand.

### Case D — Can't find a file you know exists somewhere

1. **Microsoft 365 search** — go to `https://office.com` → top search bar → type any keyword from the file title or content. Searches OneDrive + SharePoint + email attachments + Teams.
2. **Windows Search** — Start menu type the file name. Shows local + indexed cloud.
3. **macOS Spotlight** — Cmd+Space type file name.
4. **OneDrive Files On-Demand:** if file shows ghost icon (cloud only), it's there — click to download.

### Case E — File "deleted" by sync conflict

OneDrive sometimes makes a copy named `Filename-MyComputer.docx` when there's a sync conflict. Check the folder for files with `-MyComputer` or `-[YourName]` suffix.

### Case F — File in a Teams chat (not Files tab)

Files shared in chat:
- Open the chat → scroll up to find the message with the file.
- OR: SharePoint root → `OneDrive/Documents/Microsoft Teams Chat Files/` (shared files land in your personal OneDrive).

## 3. Retention Windows (How Long Files Stay Recoverable)

| Location | Retention |
|---|---|
| Windows Recycle Bin | Until manually emptied OR disk full |
| macOS Trash | Until manually emptied |
| OneDrive personal first-stage recycle bin | 30 days |
| OneDrive personal second-stage recycle bin | + additional 30 days (60 total) |
| OneDrive for Business first-stage | 93 days |
| OneDrive for Business second-stage | After 93 days, Site Collection Admin recovery only |
| SharePoint Online first-stage | 93 days |
| SharePoint Online second-stage | + additional retention per tenant policy (often 14-30 more days) |
| Microsoft 365 Retention Policy (if applied) | Set by your org (could be 7 years, 10 years, etc.) — files preserved even after deletion |

## 4. After 93 days

If a file is older than the recycle bin window:
- Ask IT — they may have a backup snapshot (Veeam / Druva / Azure Backup) outside the recycle bin path.
- Some companies use **immutable backup** for compliance — file may exist even years later, but IT has to do a restore from cold storage.

## 5. Verification Steps
- File reappears in its expected folder.
- Open the file — content is the right version.
- Sync to OneDrive completes (green check mark).
- For shared files: confirm permissions still correct (sometimes restore strips share links).

## 6. When to Call IT
- File older than 93 days AND it's important for compliance / legal / business.
- Multiple files missing simultaneously (potential ransomware, sync corruption).
- Suspect deletion was malicious (HR / legal involved).
- Need to restore an entire SharePoint site to a previous state.

## 7. Prevention Tips
- **Save to OneDrive / SharePoint by default**, not local Documents.
- **Don't bypass the recycle bin** with Shift+Delete on important files.
- **Office 365 retention policy** for regulated data: have IT apply a 7-year retention.
- **Version history is your friend** — overwrite-by-accident is far less scary when versions auto-save.
- **Don't use third-party file deletion tools** ("File Shredder", "CCleaner") on synced folders — bypasses recycle bin.

## 8. User-Friendly Explanation
For files on OneDrive or SharePoint, go to onedrive.live.com → Recycle bin → restore. That covers most cases. For local files, check Recycle Bin (Windows) or Trash (Mac). For "I saved over it," right-click the file in OneDrive → Version history → restore an older version. Files are recoverable for 93 days on OneDrive for Business — after that, ask IT.

## 9. Internal Technician Notes
- OneDrive first-stage recycle bin: user-controlled at user's account level.
- OneDrive second-stage: Site Collection Admin level. Files can be hard-purged here.
- Versioning default: 500 major versions per file in SharePoint Online (can be tuned per library).
- Retention policy (Microsoft Purview): can hold deleted items beyond recycle bin retention. Apply at folder, library, or site level.
- For audit: Unified Audit Log shows file deletion + by whom (90 days default, 1 year with E5).
- For mass recovery: PowerShell `Restore-PnPRecycleBinItem`.
- Soft-deleted SharePoint sites: 93-day window then permanent.

## 10. Related KB Articles
- `l1-onedrive-001` — OneDrive not syncing
- `l1-onedrive-002` — Restore deleted file
- `l1-onedrive-003` — Version conflict

## 11. Keywords / Search Tags
deleted file, file recovery, recycle bin, trash, onedrive restore, sharepoint restore, version history, file history, file versions, recover document, undelete, lost file, find file, retention, sharepoint recycle bin, microsoft 365 search
