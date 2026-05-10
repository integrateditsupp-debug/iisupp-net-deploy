---
id: l1-windows-001
title: "Blue screen of death (BSOD) on Windows 10/11"
category: windows
support_level: L1
severity: high
estimated_time_minutes: 20
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
prerequisites: []
keywords:
  - bsod
  - blue screen
  - stop error
  - kernel panic
  - system crash
  - critical_process_died
  - whea_uncorrectable
  - memory_management
  - driver_irql
related_articles:
  - l1-windows-002
  - l2-drivers-003
  - l2-performance-005
escalation_trigger: "BSOD repeats more than 3 times in 24h, occurs during boot before login, or shows DISK or NTFS-related stop codes"
last_updated: 2026-05-07
version: 1.0
---

# Blue screen of death (BSOD) on Windows 10/11

## 1. Symptoms
- Screen turns solid blue (or black on Win11) with a sad-face emoji and a stop code such as `CRITICAL_PROCESS_DIED`, `IRQL_NOT_LESS_OR_EQUAL`, `MEMORY_MANAGEMENT`, `WHEA_UNCORRECTABLE_ERROR`, or `PAGE_FAULT_IN_NONPAGED_AREA`.
- PC restarts unexpectedly, sometimes with a "collecting error info..." progress percentage.
- May happen when launching a specific app, plugging in a peripheral, or at random.

## 2. Likely Causes
1. Recently installed or corrupt device driver (most common — display, audio, network).
2. Failing RAM module or storage drive (SSD/HDD).
3. Recent Windows Update with a regression.
4. Overheating CPU or GPU.
5. Malware or rootkit.
6. Unstable overclock or BIOS settings (rare on managed corporate hardware).

## 3. Questions To Ask User
1. What stop code appears on the blue screen? (Take a phone photo if needed.)
2. Did this start after installing/updating any software, drivers, or Windows updates in the last 7 days?
3. Does it happen when running a specific application, or randomly?
4. How many times has it occurred in the last 24 hours?
5. Is the device a laptop or desktop, and is it on AC power?
6. Has any new hardware been connected (USB hub, dock, monitor, drive)?

## 4. Troubleshooting Steps
1. **Note the stop code** before the PC reboots — it's the single most useful piece of evidence.
2. Disconnect non-essential peripherals (USB drives, docks, secondary monitors) and reboot.
3. Boot to Safe Mode (Settings → System → Recovery → Advanced startup → Restart now → Troubleshoot → Advanced options → Startup Settings → 4 = Safe Mode).
4. If Safe Mode is stable, the issue is software/driver-related, not hardware.
5. In Settings → Update & Security → View update history, identify any update installed in the last week.

## 5. Resolution Steps
**If a recent update is suspected:**
1. Settings → Windows Update → Update history → Uninstall updates → remove the most recent quality update.
2. Reboot and use the PC normally for 30 min to confirm stability.

**If a recent driver is suspected:**
1. Open Device Manager (`devmgmt.msc`).
2. Locate the suspect device (yellow warning icon, or recently updated by date).
3. Right-click → Properties → Driver tab → **Roll Back Driver**.
4. Reboot.

**If random / no clear cause:**
1. Run `sfc /scannow` from elevated Command Prompt (System file checker).
2. Run `DISM /Online /Cleanup-Image /RestoreHealth`.
3. Run Windows Memory Diagnostic (`mdsched.exe`) — schedules a reboot test.
4. Run `chkdsk C: /f /r` — schedules at next reboot.
5. Check Event Viewer → Windows Logs → System for "BugCheck" entries; record full stop code and parameters.

## 6. Verification Steps
- 24 hours of normal use without recurrence.
- Event Viewer shows no new `BugCheck` events after the fix.
- The originally reported workflow (e.g., launching the app that triggered it) completes successfully 3 consecutive times.

## 7. Escalation Trigger
- BSOD recurs more than 3 times in 24 hours despite L1 steps.
- Stop code is `INACCESSIBLE_BOOT_DEVICE`, `NTFS_FILE_SYSTEM`, `DISK_HARDWARE_ERROR`, or any code containing `WHEA` (likely hardware).
- BSOD occurs before login screen — user cannot reach desktop.
- PC fails to boot into Safe Mode.
- → Escalate to **L2** with: stop code(s), timestamps from Event Viewer, install dates of recent updates/drivers, and minidump file from `C:\Windows\Minidump\`.

## 8. Prevention Tips
- Keep Windows Update and OEM driver updates current — but don't install drivers from unverified third-party sites.
- Avoid "driver booster" type utilities — they're a top cause of BSODs.
- Maintain at least 15% free space on the C: drive.
- Use a quality UPS or stable power source for desktops.
- Don't ignore single BSODs — log them; patterns matter.

## 9. User-Friendly Explanation
"That blue screen means Windows hit something it couldn't recover from and had to restart to keep your data safe. Most of the time it's a driver or a recent update — we'll roll back what changed first, run a couple of checks to make sure your memory and disk are healthy, and you'll be back in business. If it keeps happening, we'll bring in a technician to look closer at the hardware."

## 10. Internal Technician Notes
- Minidump location: `C:\Windows\Minidump\*.dmp`. Analyze with WinDbg + `!analyze -v`.
- Full memory dump (if enabled): `C:\Windows\MEMORY.DMP`.
- Useful Event Viewer filter: System log, Source = `BugCheck` or `Microsoft-Windows-WER-SystemErrorReporting`.
- If `WHEA_UNCORRECTABLE_ERROR`, almost always CPU/RAM hardware — check vendor diagnostic.
- For repeating `DRIVER_IRQL_NOT_LESS_OR_EQUAL`, the parameter at offset 3 is the offending driver address — `lmvm` it in WinDbg.
- For OEM laptops (Dell, HP, Lenovo), run vendor pre-boot diagnostics (F12 / Esc / F2 menus).
- If BitLocker is enabled and disk errors are suspected, ensure recovery key is on file before running `chkdsk /r`.

## 11. Related KB Articles
- l1-windows-002 — Windows won't boot / stuck on spinning dots
- l2-drivers-003 — Driver rollback strategies and WHQL gating
- l2-performance-005 — Diagnosing intermittent system instability

## 12. Keywords / Search Tags
bsod, blue screen, stop error, kernel panic, system crash, critical_process_died, whea_uncorrectable, memory_management, driver_irql, windows crashing, computer keeps restarting
