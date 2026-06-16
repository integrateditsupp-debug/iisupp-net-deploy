---
id: l1-onedrive-002
title: "Restore deleted or modified file from OneDrive / version history"
category: onedrive
support_level: L1
severity: medium
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
prerequisites: []
keywords:
  - restore file
  - deleted file
  - recover file
  - version history
  - previous version
  - rollback
  - ransomware recovery
  - onedrive recycle bin
related_articles:
  - l1-onedrive-001
  - l2-backup-001
escalation_trigger: "File deleted >93 days ago, or ransomware detected on tenant, or shared library file requires admin restore"
last_updated: 2026-05-07
version: 1.0
---

# Restore deleted or modified file from OneDrive

## 1. Symptoms
- File missing from OneDrive folder.
- File is corrupted or has wrong content (overwritten).
- "I saved over my work and need yesterday's version."
- Folder accidentally deleted.
- Mass corruption suspected (ransomware indicator).

## 2. Likely Causes
1. User deleted file (Recycle Bin → still recoverable).
2. Sync conflict resolved by retaining wrong copy.
3. Another user with shared access deleted/edited.
4. Office auto-save replaced with bad version.
5. Ransomware encrypted files.

## 3. Questions To Ask User
1. When did the file last look correct (date + time)?
2. Was the file in your personal OneDrive, or a shared library / SharePoint folder?
3. Can you remember the exact filename or what's in it?
4. Have you noticed other files going missing or renamed strangely (.crypted, .locked, .encrypted)?

## 4. Troubleshooting Steps
1. Check local Recycle Bin (desktop) — look for file there.
2. Check OneDrive web Recycle Bin: onedrive.live.com → Recycle bin (left nav).
3. For specific file's history: web view → right-click file → Version history.
4. For mass loss / suspected ransomware: STOP and escalate immediately — DO NOT attempt to restore until threat is contained.

## 5. Resolution Steps
**Single deleted file (last 30 days personal / 93 days work):**
1. onedrive.live.com (or office.com → OneDrive) → Recycle bin.
2. Find file → right-click → Restore. File returns to its original folder.

**Older deleted file (work account, second-stage bin):**
1. Recycle bin → "Second-stage recycle bin" link at bottom — accessible to admins; user requests via L2.

**Restore prior version:**
1. Web view → right-click file → Version history.
2. Click ⋯ on a version → Restore. Saves current as new version, makes restored version current.

**Bulk / time-machine restore:**
1. onedrive.live.com → Settings (gear) → Options → Restore your OneDrive.
2. Pick a date — slider shows daily activity histogram.
3. Confirm restore. ALL changes after that timestamp roll back. Use only when sure.

**Suspected ransomware:**
1. Disconnect device from network immediately.
2. Do NOT attempt restore yet — escalate to L2/L3 (see escalation).
3. Report to IT security per your incident response policy.

## 6. Verification Steps
- File is present in expected folder.
- Open file — content matches expected version.
- For version restore: file modified date is updated; previous versions still accessible in history.
- Sync icon green.

## 7. Escalation Trigger
- File deleted more than 93 days ago (work) — admin retention recovery needed.
- Mass file changes with .locked / .crypted / .[unknown] extensions — RANSOMWARE; escalate to **L3 / Security** immediately.
- Restore your OneDrive doesn't show enough history.
- SharePoint / shared library file — site collection admin restore needed.
- → Escalate to **L2** for second-stage bin / **L3 / Security** for ransomware.

## 8. Prevention Tips
- Use Office auto-save with OneDrive — gives version history "for free".
- Don't store irreplaceable files only locally — sync the folder via OneDrive.
- Never delete an entire folder without confirming recursive intent.
- Enable Personal Vault for sensitive docs (extra MFA gate).
- Watch for unusual file activity emails from OneDrive — they flag mass deletes.

## 9. User-Friendly Explanation
"OneDrive keeps a memory of every version of your files for 30 days, and a recycle bin for 30–93 days. So even if you deleted the file or saved over it, we can usually pull it back. We'll find the right one and restore it together. The only time this gets tricky is if a virus encrypted things — that's a bigger fix and we'll loop in security."

## 10. Internal Technician Notes
- Personal OneDrive recycle bin: 30 days.
- OneDrive for Business: 93 days for end-user; admins have second-stage bin (90 days more).
- "Restore your OneDrive": rolls back ALL changes after chosen point — like a time machine. Up to 30 days back.
- Ransomware detection: M365 has built-in alerts ("File detection settings"); SOC team should be looped in.
- Version history retention: defaults to 500 versions; tunable per library (SharePoint Library settings → Versioning).
- For shared libraries (SharePoint), use site recycle bin first, then admin-level.
- Always check `Get-MailboxAuditLog` and Audit Log Search before declaring a deletion intentional vs. malicious.

## 11. Related KB Articles
- l1-onedrive-001 — OneDrive not syncing
- l2-backup-001 — Backup retention and admin restore

## 12. Keywords / Search Tags
restore file, deleted file, recover file, version history, previous version, rollback, ransomware, onedrive recycle bin
