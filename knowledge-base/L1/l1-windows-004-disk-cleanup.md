---
id: l1-windows-004
title: "Disk full / out of space on C: drive"
category: performance
support_level: L1
severity: medium
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
prerequisites: []
keywords:
  - disk full
  - out of space
  - low disk space
  - c drive full
  - storage full
  - clear space
  - cleanup
related_articles:
  - l1-windows-003
  - l1-onedrive-001
escalation_trigger: "Cleanup recovers <5% on a 256 GB+ drive, or hidden files / WinSxS bloat needs admin tools"
last_updated: 2026-05-07
version: 1.0
---

# Disk full / out of space on C: drive

## 1. Symptoms
- Red bar in This PC under C: drive.
- "Low disk space" notification.
- Office / Teams won't open or save.
- Updates failing — "We couldn't install Windows update" with not enough space.
- Browser slows or crashes.

## 2. Likely Causes
1. Downloads / Desktop / Documents folders bulging.
2. Old Windows install (Windows.old) after upgrade.
3. Temp files / browser cache / Teams cache.
4. Large local OneDrive sync (not using Files On-Demand).
5. Big media files (videos, ISOs).
6. Hibernate file (`hiberfil.sys`) on small SSD.
7. Many local Outlook OST files (large mailbox cached).

## 3. Questions To Ask User
1. How big is your C: drive total? (This PC → C: → Properties.)
2. How much free now?
3. When did it last have plenty of room?
4. Do you store videos, large files, or VM disks locally?
5. Are you using OneDrive Files On-Demand (or syncing everything)?

## 4. Troubleshooting Steps
1. Settings → System → Storage → see breakdown.
2. Run Storage Sense: Storage settings → Cleanup recommendations.
3. Empty Recycle Bin and Downloads.
4. Find large files: File Explorer → Search "size:huge" or "size:gigantic" in C:.
5. Check Settings → System → Storage → Temporary files — select all → Remove.

## 5. Resolution Steps
**Standard cleanup:**
1. Storage → Cleanup recommendations → run all suggested.
2. Disk Cleanup utility (`cleanmgr.exe`) → C: → click "Clean up system files":
   - Windows Update Cleanup
   - Previous Windows installations (Windows.old) — frees 10–30 GB
   - Delivery Optimization Files
   - Recycle Bin
   - Temporary files

**OneDrive bloat:**
1. Right-click OneDrive cloud icon → Settings → Sync and backup → Free up space (Files On-Demand).
2. Files become cloud-only icons; opens download on click.

**Outlook OST too large:**
1. File → Account Settings → Account Settings → Data Files tab → see OST size.
2. Reduce: File → Account Settings → Account Settings → Email → Change → Mail to keep offline → reduce slider (e.g., to 6 months).

**Browser caches:**
- Clear Chrome/Edge/Firefox cache (Ctrl+Shift+Del).

**Disable hibernate (saves up to 16 GB on big-RAM laptops):**
- Run as admin: `powercfg -h off`. Note: disables Fast Startup; usually fine on SSDs.

**Move large folders:**
- Documents/Pictures/Videos: right-click → Properties → Location → move to D: or external.
- For OneDrive users, store in OneDrive instead.

## 6. Verification Steps
- C: free space ≥ 20% of total.
- Settings → Storage shows green/no warning.
- Office apps open and save without complaint.
- Windows Update completes.

## 7. Escalation Trigger
- Cleanup yields <5% recovery on a 256 GB+ drive (likely hidden bloat — WinSxS, system restore points, large logs).
- User has VM / dev tooling generating huge files we can't move.
- Drive itself is too small for role (recommend hardware upgrade via L2).
- → Escalate to **L2** with: drive size, free space, list of largest folders, Storage settings screenshot.

## 8. Prevention Tips
- Use OneDrive Files On-Demand on laptops.
- Keep Downloads tidy — delete after use.
- Don't store multimedia on C:; use external or cloud.
- Run Disk Cleanup quarterly.
- Right-size mailbox cache to 6–12 months for typical users.

## 9. User-Friendly Explanation
"Your hard drive is full and Windows needs a bit of room to operate. We'll free up the easy stuff first — old Windows installer files, browser cache, downloads you don't need. If your OneDrive is taking up your whole drive, we'll switch on Files On-Demand so files only download when you actually open them. You'll have plenty of room in a few minutes."

## 10. Internal Technician Notes
- Hidden bloat suspects: `C:\Windows\Installer\`, `C:\Windows\WinSxS\`, `C:\Windows\Temp\`, user `%temp%`, `C:\$WinREAgent\` (post-update).
- WinSxS cleanup: `Dism.exe /Online /Cleanup-Image /StartComponentCleanup /ResetBase` — removes superseded components, slow.
- Use `treesize free` or `WizTree` for quick visualization (don't install on prod without IT approval).
- For laptops with 256 GB SSDs, Office cache + Teams + OneDrive can eat 50–80 GB on their own — Files On-Demand is mandatory.
- `vssadmin list shadowstorage` — shadow copies / restore points sometimes consume 10%+; can be reduced with `vssadmin resize shadowstorage`.

## 11. Related KB Articles
- l1-windows-003 — Slow PC (often correlated)
- l1-onedrive-001 — OneDrive sync issues

## 12. Keywords / Search Tags
disk full, out of space, low disk space, c drive full, storage full, clear space, cleanup, files on demand
