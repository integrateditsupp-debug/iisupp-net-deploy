---
id: l1-windows-008
title: "Windows Update keeps rolling back / 'undoing changes'"
category: windows
support_level: L1
severity: high
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - we couldnt complete the updates
  - undoing changes
  - update keeps rolling back
  - feature update fails repeatedly
  - 0x80070643
  - 0xc1900101
  - kb installation failed
  - update reverts on reboot
tags:
  - windows
  - update
  - top-50
related: [l1-windows-007-update-stuck-reboot-loop, l1-storage-001-disk-full]
---

# Windows Update keeps reverting

### "We couldn't complete the updates. Undoing changes."

A specific patch failed mid-install. Settings → Windows Update → Update history → find the failing KB number → note the error code (in red, like `0xc1900101`). Then: pause updates for 7 days (Settings → Windows Update → Pause), let Microsoft fix the patch upstream. Most "undoing changes" loops resolve in a week without your intervention.

### Free up disk space first — most reverts are storage failures

Updates need 15-30 GB free during install. If C: is below that, the install commits then can't finalize → rollback. Check: Settings → System → Storage. If under 25 GB free, see KB l1-storage-001. Free space, then retry update.

### Specific error: 0xc1900101 — driver incompatible

A device driver isn't compatible with the new build. Settings → Update history → click the failing update → "Get help" link sometimes identifies the driver. Or run Device Manager → check for any yellow exclamation marks — those drivers are suspects. Update or remove the conflicting driver, retry Windows Update.

### Specific error: 0x80070643 — .NET or installer error

Often .NET Framework patch in a loop. Open Settings → Apps → Optional features → search ".NET" — if any version shows "needs update," click → uninstall → reinstall via Windows Update. Or use the Microsoft .NET repair tool from microsoft.com.

### Update installs then reverts on next reboot

Critical service mid-install crashed. Boot to Safe Mode (Shift + Restart → Troubleshoot → Advanced → Startup Settings → Safe Mode). In Safe Mode, run System File Checker: Admin Command Prompt → `sfc /scannow`. Then `DISM /Online /Cleanup-Image /RestoreHealth`. Both take 15-30 min. Reboot normally, retry update.

### "Working on updates X%" goes backwards

Phase 2/3 of install hit a hardware issue. Don't interrupt — let it finish even if it goes from 80% → 30%. After full rollback, try again. If it loops backward more than twice, the OS install image is corrupt. Run in-place upgrade via Windows 11 Installation Assistant (microsoft.com) — preserves apps + files, repairs the OS in place.

### One specific update keeps failing every month

Hide that update temporarily until Microsoft fixes it. Use Microsoft's "Show or hide updates" tool from microsoft.com. Pick the failing KB → hide. It stops getting offered. Re-check monthly via the same tool whether to unhide.

### When to escalate to L2

In-place upgrade (Windows Installation Assistant) didn't fix it. Update fails AND PC reboots randomly (hardware suspect — failing SSD or RAM). Multiple users in office hit same failing update (likely Microsoft-side issue, wait for fix). Critical security update failing and you need compliance — L2 manually installs via offline package.
