---
id: l1-windows-007
title: "Windows Update stuck, pending reboot loop, or '0% installing' forever"
category: windows
support_level: L1
severity: medium
estimated_time_minutes: 20
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["Admin rights helpful", "Backup important work before troubleshooting"]
keywords:
  - windows update stuck
  - 0% installing forever
  - cant install updates
  - update error
  - pending restart wont apply
  - update keeps failing
  - 0x80070002
  - 0x800f081f
  - feature update stuck
  - update keeps rolling back
  - we couldnt complete the updates
tags:
  - windows
  - update
  - top-50
related: [l1-windows-001-blue-screen-stop-error, l1-windows-003-slow-pc-performance, l1-storage-001-disk-full]
---

# Windows Update stuck or rebooting in a loop — get it unstuck

## Symptoms

- "Downloading 0%" forever
- "Installing 0%" forever
- Stuck on "Working on updates 30%" after reboot
- "We couldn't complete the updates. Undoing changes."
- Pending restart never applies
- Specific error codes: 0x80070002, 0x800f081f, 0x8007000d, 0x80073712

## Step 1 — How long has it really been stuck?

A few major Windows updates legitimately take **45-90 minutes** even on fast SSDs. Don't pull the plug before that.

**Wait at least 90 minutes** before declaring it stuck if you see:
- Spinning circle with no error
- Percentage that hasn't changed (it may be working on something else)
- "Working on updates" with hard drive activity light blinking

**Pull plug only if:**
- 2+ hours with zero progress AND no disk activity
- Or a clear error message has appeared
- Or the screen is black with no cursor for 30+ min

## Step 2 — Check free disk space

Windows updates need 15-30+ GB free.

1. Settings → System → Storage.
2. If C: drive is below 20 GB free → see `l1-storage-001-disk-full` first.
3. After freeing space, restart and retry update.

## Step 3 — Run Windows Update Troubleshooter

Microsoft's first-line tool actually works for many common stuck states.

1. Settings → System → Troubleshoot → Other troubleshooters.
2. Find **Windows Update** → Run.
3. Follow prompts.
4. Restart → try update again.

## Step 4 — Reset the Windows Update components manually (advanced)

If troubleshooter didn't fix it, the Update cache may be corrupt.

### Run in Administrator Command Prompt
1. Right-click Start → Terminal (Admin) or "Command Prompt (Admin)".
2. Paste these one at a time:

```
net stop wuauserv
net stop cryptSvc
net stop bits
net stop msiserver
ren C:\Windows\SoftwareDistribution SoftwareDistribution.old
ren C:\Windows\System32\catroot2 catroot2.old
net start wuauserv
net start cryptSvc
net start bits
net start msiserver
```

3. Restart.
4. Settings → Windows Update → Check for updates. It'll rebuild the cache fresh and start downloading.

This usually fixes 80% of stuck-update problems.

## Step 5 — Specific error code fixes

### 0x80070002 — file missing in cache
- Step 4 (manual reset) fixes this.

### 0x800f081f — feature install fails (.NET / Windows Features)
- Open Control Panel → Programs → Turn Windows Features On or Off → check what was attempted → toggle.

### 0x8007000d — bad data in cache
- Step 4.

### 0x80073712 — system files corrupt
1. Admin Command Prompt:
   ```
   sfc /scannow
   ```
2. Wait for it to complete (10-15 min).
3. Then:
   ```
   DISM /Online /Cleanup-Image /RestoreHealth
   ```
4. Wait again (15-30 min).
5. Restart. Retry update.

### "Update keeps rolling back to previous version"
1. Storage might be marginal — free more space.
2. Or specific driver is incompatible — Settings → Windows Update → Update history → see what failed.
3. Use **Show or hide updates** tool (Microsoft's) to skip the failing one temporarily until they patch it.

## Step 6 — Manual install from Microsoft Update Catalog

When Windows Update itself is broken, you can download specific updates and install directly.

1. Go to https://www.catalog.update.microsoft.com.
2. Search for the KB number (e.g., "KB5045500") shown in your failing update.
3. Download the `.msu` file for your Windows version (x64 vs ARM64).
4. Double-click to install.

## Step 7 — Pending reboot won't apply

### Symptom
Settings shows "Restart required to finish installing updates" but every restart loops back to the prompt.

### Fix
1. Shut down (not restart) — File → Shut down → wait 30 sec.
2. Hold Shift while clicking Restart → opens Advanced Startup.
3. Troubleshoot → Advanced options → Startup Settings → Restart → boot to Safe Mode.
4. In Safe Mode: Admin Command Prompt → `sfc /scannow`.
5. Restart normally.

## Step 8 — Last resort: in-place upgrade repair

If updates have been broken for weeks:

1. Download the **Windows 11 Installation Assistant** (or Win 10) from microsoft.com.
2. Run it.
3. Choose "Upgrade this PC now" / "Keep my files and apps."
4. Takes 1-2 hours but repairs the install in place. Apps, files, settings stay.

This is the nuclear-but-non-destructive option.

## When to escalate

| Situation | Path |
|---|---|
| Multiple users in the office all stuck on the same update | L2 — possibly a patch issue Microsoft will fix in 1-7 days |
| Update fails AND PC reboots randomly | L2 — possibly hardware (failing SSD, RAM) |
| sfc /scannow reports unfixable corruption | L2 — DISM + Windows install repair |
| Critical security update fails repeatedly | L2 — manual install or in-place upgrade |
| PC won't boot at all after update | L2 — System Restore / boot media |

## Prevention

- Don't power off mid-update. Let it finish, even if it's been 90 min.
- Keep 25%+ free space on C: drive.
- Pause updates if you have a critical demo / meeting in the next 24 hours (Settings → Windows Update → Pause).
- Install updates on a Friday afternoon — Monday morning fixes are easier with the weekend buffer.
- For corporate PCs: tell IT if you keep hitting the same failing update — they may have a managed fix.

## What ARIA can help with

ARIA can identify specific error codes, walk you through the manual reset commands step-by-step, and tell you whether your symptom is "wait longer" vs "needs intervention." ARIA cannot execute admin command prompt commands on your behalf — you need to run them with your admin rights.
