---
id: l1-m365-003
title: "Excel / Word file won't open — \"format not valid\", corrupt, or locked"
category: m365
support_level: L1
severity: high
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - excel won't open
  - word won't open
  - file format not valid
  - the file format and extension don't match
  - file is corrupt
  - workbook corrupt
  - file is locked for editing
  - file in use
  - open and repair
  - spreadsheet won't open
  - xlsx won't open
  - docx corrupt
  - cannot open the file
related_articles:
  - l1-m365-001
  - l1-onedrive-002
  - l1-onedrive-003
escalation_trigger: "File corrupt after Open-and-Repair AND no usable version in OneDrive/SharePoint history; or corruption across many files (possible disk/storage fault)"
last_updated: 2026-06-24
version: 1.0
---

# Excel / Word file won't open — "format not valid", corrupt, or locked

## 1. Symptoms
- "Excel cannot open the file … because the file format or file extension is not valid."
- "The file is corrupt and cannot be opened."
- "<file> is locked for editing by <another user>" (or by "another user" that is actually you).
- The file opens to a blank/garbled workbook, or Excel/Word hangs on open.
- Double-clicking does nothing, but other Office files open fine.

## 2. Likely Causes
1. **Extension mismatch** — the file was saved as a different type (e.g. a CSV or HTML table renamed to `.xlsx`), so the extension lies about the real format.
2. **Corrupt file** — an interrupted save, a sync conflict, or a bad download left the internal structure damaged.
3. **Locked file** — another app/person has it open, or a stale Office owner-lock file (`~$<name>`) was left behind after a crash.
4. **Stale Office document cache** — a cloud file (OneDrive/SharePoint) is stuck behind a bad local upload cache.

## 3. Fix (in order — stop when it opens)
1. **Verify the extension.** File Explorer → View → turn on **File name extensions**. If a `.xlsx` is really a CSV/HTML, rename it to the correct type (`.csv`, `.htm`) or re-export it. A genuine Excel file is `.xlsx`/`.xlsm`/`.xls`.
2. **Open and Repair.** In Excel (or Word): **File → Open → Browse → single-click the file → click the arrow beside the Open button → Open and Repair → Repair.** This rebuilds the file without changing the original until you save. If Repair fails, choose **Extract Data** to recover values.
3. **Release a locked file.** Close every Office app (check the system tray). If it is a shared/network file, the lock clears when the other person closes it or after Office times out. Delete any leftover `~$<filename>` owner-lock file in the same folder — it only records *who* had it open and contains none of your data.
4. **Clear the Office Document Cache (last resort for cloud files).** Close all Office apps → in any Office app: **File → Options → Save → Delete cached files**. Your documents live in OneDrive/SharePoint and re-download.
5. **Restore a known-good copy.** OneDrive/SharePoint → right-click the file → **Version history** → open/restore an earlier version.

## 4. Verify
- The file opens and the content is intact.
- After Open-and-Repair, **Save As** a new copy so you keep a clean version.

## 5. When to escalate (call IT)
- The file is still corrupt after Open-and-Repair **and** there is no usable version in OneDrive/SharePoint history.
- Multiple files are corrupting on the same machine (possible disk/storage fault) — stop using it and call **(647) 581-3182**.

## 6. Safe automation (ARIA Guided Fix)
ARIA's `office-file-repair-v1` recipe walks these steps as guided, dry-run-safe actions (verify extension → Open-and-Repair → release lock → clear cache). It never edits the original file content; the worst case is opening a settings panel. Confirm + countdown gate every step.
