---
id: l1-onedrive-003
title: "OneDrive sync conflict — 'two copies of file' / file with computer name appended"
category: onedrive
support_level: L1
severity: low
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - sync conflict
  - duplicate file
  - file conflict
  - two copies
  - my computer copy
  - merged file
  - which version
related_articles:
  - l1-onedrive-001
  - l1-onedrive-002
escalation_trigger: "Conflict pattern affects shared library and multiple users; needs admin merge tooling"
last_updated: 2026-05-07
version: 1.0
---

# OneDrive sync conflict

## 1. Symptoms
- File "report.docx" suddenly accompanied by "report-PCNAME.docx".
- Notification "OneDrive couldn't merge changes — keeping both copies".
- Two near-identical files in same folder.
- Office app's "Conflict — Resolve" banner.

## 2. Likely Causes
1. Same file edited offline on two devices, both came online.
2. Collaborator and user edited simultaneously without auto-save.
3. Older Office version that lacks real-time co-authoring.
4. File on slow network — change conflict during save.
5. Sync was paused on one device for a long time.

## 3. Questions To Ask User
1. Which file is affected?
2. Did anyone else edit it recently?
3. Were you offline (no internet) while working on it?
4. Do you see "report-LAPTOPNAME.docx" type name?
5. Are these Word/Excel/PowerPoint files (co-authoring) or other file types?

## 4. Troubleshooting Steps
1. Open both versions side-by-side in their app.
2. Compare differences (Word: Review → Compare).
3. Decide which content to keep, or merge.
4. Save merged version with original name.
5. Delete the redundant copy.

## 5. Resolution Steps
**For Word docs (most graceful):**
1. Open both files in Word.
2. Review tab → Compare → Combine.
3. Pick original document and your conflict copy → OK.
4. Word produces merged view; accept changes you want.
5. Save As original filename → overwrite when prompted.
6. Delete the conflict file.

**For Excel:**
- No native compare — manually review sheets, copy cells from conflict copy as needed.
- Save merged as original.

**For other file types (PDF, images, etc.):**
- Pick the version you want to keep; rename it back to the original name; delete the loser.

**Prevent recurrence:**
- Enable Office AutoSave (top-left toggle in Word/Excel/PowerPoint when file is on OneDrive).
- Use real-time co-authoring (Office 2016+) — multiple editors stay in sync.
- Don't edit the same file offline on multiple devices.

## 6. Verification Steps
- Original filename present, content correct.
- Conflict-named file deleted.
- OneDrive shows green check on the file.
- Open file in Office → no conflict banner.

## 7. Escalation Trigger
- Conflict pattern repeats daily for the same user (sync misconfigured).
- Multiple users on shared library generating conflicts en masse — library setting / co-authoring policy issue.
- Merge needed across many files (admin tooling).
- → Escalate to **L2** with: filenames, frequency, library, file types.

## 8. Prevention Tips
- Use AutoSave on OneDrive-stored files.
- Use Office 2016+ for real-time co-authoring.
- Keep OneDrive online — don't pause for hours.
- Don't edit large monolithic files concurrently — split into sections.
- Communicate with collaborators — Teams chat "I'm editing X" reduces conflicts.

## 9. User-Friendly Explanation
"OneDrive saw two different versions of the same file and didn't want to lose anyone's work, so it kept both. We'll open them, pick the changes you want, save it back as the original, and delete the duplicate. To prevent this, turn on AutoSave next time you're editing — it keeps everyone in sync."

## 10. Internal Technician Notes
- Conflict naming convention: `<filename>-<computername>.<ext>` for OneDrive, or `<filename>-<user>'s conflicted copy <date>.<ext>` for SharePoint sync.
- For PowerPoint, real-time co-authoring requires PPTX format on SharePoint/OneDrive + Office 365 build with co-author flag.
- For mass conflicts post-migration, use SharePoint Migration Tool's Conflict Report to identify and bulk-resolve.
- AutoSave is OneDrive-aware: a file in synced OneDrive auto-enables; a local-only file cannot.
- Co-authoring requires write access for both users; if one has only "Edit" and another "Owner", policies still permit co-author but conflict rules change.

## 11. Related KB Articles
- l1-onedrive-001 — OneDrive sync issues
- l1-onedrive-002 — File restore / version history

## 12. Keywords / Search Tags
sync conflict, duplicate file, file conflict, two copies, my computer copy, merged file, which version, autosave
