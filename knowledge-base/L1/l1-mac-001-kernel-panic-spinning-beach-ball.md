---
id: l1-mac-001
title: "macOS: kernel panic, spinning beach ball, or unexpected restart"
category: macos
support_level: L1
severity: high
estimated_time_minutes: 20
audience: end-user
os_scope: ["macOS"]
prerequisites: []
keywords:
  - kernel panic
  - mac restart
  - spinning beach ball
  - rainbow wheel
  - mac frozen
  - mac crash
  - "your computer was restarted because of a problem"
  - macos hung
  - sudden restart
  - mac unresponsive
related_articles:
  - l1-windows-003
  - l1-windows-001
escalation_trigger: "Kernel panic recurs >2x in 24h, panic log identifies a kext (3rd-party kernel extension) or hardware fault, or RAM/SSD diagnostics fail"
last_updated: 2026-05-08
version: 1.0
---

# macOS kernel panic / unresponsive Mac

## 1. Symptoms
- Mac restarts on its own with the message "Your computer was restarted because of a problem."
- A specific app shows the rainbow spinning beach ball indefinitely.
- Cursor moves but nothing else responds — Dock, menu bar, app windows are all stuck.
- Black screen with text in multiple languages: "You need to restart your computer" (the kernel panic screen).
- Mac is hot and the fans are screaming for no obvious reason.

## 2. Likely Causes
1. A specific app is leaking memory and dragging everything down.
2. A third-party kernel extension (kext) — usually an older driver or VPN client.
3. Storage drive almost full (<10% free) — macOS performance degrades sharply.
4. RAM physically failing.
5. External display or dock incompatibility (especially after a macOS update).
6. macOS update partially installed and never finished.

## 3. Questions To Ask User
1. macOS version — Apple menu → About This Mac.
2. Does it happen randomly, or with a specific app?
3. Anything new — external display, dongle, app installed in the last week?
4. Free storage — About This Mac → More Info → Storage.
5. When you restart, does it boot back up cleanly or panic again?

## 4. Troubleshooting Steps
1. **Force-quit the offending app.** Cmd+Option+Esc → select the app showing the beach ball → Force Quit.
2. **Restart cleanly** (Apple menu → Restart, not "force off"). If you got a panic message after reboot, the system saved a panic log.
3. **Read the panic message.** Apple → System Settings → General → About → System Report → Software → Logs → search for "panic". Note the kext name if shown.
4. **Disconnect external accessories** — unplug docks, hubs, USB devices, external displays. Reboot. If it's stable, plug things back one at a time.
5. **Check free storage.** Need at least 15% free for macOS to perform.

## 5. Resolution Steps
**If panic log mentions a third-party kext (e.g., `com.vendor.driver.something`):**
1. Identify the vendor from the kext name.
2. Update or uninstall that vendor's app.
3. macOS Big Sur+ uses System Extensions — System Settings → General → Login Items & Extensions → review.

**If a specific app freezes (beach ball):**
1. Activity Monitor → CPU tab → sort by CPU. Force-quit the top offender.
2. If the same app always freezes: reinstall it via the Mac App Store or vendor's site.

**If random panics with no obvious cause:**
1. Apple Diagnostics — shutdown, hold D while powering on. Apple Silicon: hold the power button until startup options, then ⌘+D. Run the test; note any error codes.
2. Safe Mode — Apple Silicon: hold power until startup options, hold Shift, click Continue in Safe Mode. Intel: hold Shift while powering on. Use the Mac for an hour. If it's stable in Safe Mode, the issue is a login item or kext.

**If macOS update is half-installed:**
1. App Store → Updates → re-run the macOS update.
2. If it fails: Apple menu → System Settings → General → Software Update → Reinstall.

**For storage cleanup:**
1. Apple menu → About This Mac → Storage → Manage.
2. Empty the Trash. Move large files to iCloud or external storage.

## 6. Verification Steps
- 24 hours of normal use without a panic, freeze, or unexpected restart.
- Activity Monitor shows idle CPU <15% and memory pressure in the green.
- All accessories work without triggering a freeze.
- No new panic logs in System Report → Software → Logs.

## 7. Escalation Trigger
- Same panic message with the same kext after uninstalling that vendor's software.
- Apple Diagnostics returns a hardware reference (e.g., "PFM006" — power, "VFD001" — display).
- Mac panics during boot before login.
- → Escalate to **L2** or Apple Support with: macOS version, panic log, Apple Diagnostics codes, recent app installs.

## 8. Prevention Tips
- Don't run with <15% free storage.
- Keep macOS and apps updated — most kext issues are fixed in vendor patches.
- Be cautious with cheap USB-C docks; they're a common kernel-panic source.
- Don't install ancient kernel extensions; many older vendors haven't shipped Apple Silicon-compatible drivers.

## 9. User-Friendly Explanation
"Macs are usually stable, so when one panics or freezes, it's pointing at a specific cause. We'll force-quit anything stuck, restart cleanly, and read the message macOS leaves behind — that message names the file responsible 90% of the time. From there it's usually one of three things: an old app driver, a finicky USB-C dock, or a drive that's almost full. Each one has a quick fix."

## 10. Internal Technician Notes
- Panic logs live at `/Library/Logs/DiagnosticReports/`. Look for `*.panic` and `*.ips` files; recent ones are at the top.
- `kextstat | grep -v com.apple` shows non-Apple kexts — anything here is suspect.
- `pmset -g log | grep "Failure"` lists power-related crashes.
- For Apple Silicon, kexts are largely deprecated in favor of System Extensions; if you see legacy KEXTs, the vendor is overdue for an update.
- `ioreg -p IOUSB` for USB device tree if a dock is suspected.
- T2 / Apple Silicon storage doesn't show SMART externally — use Apple Diagnostics for the closest indicator.

## 11. Related KB Articles
- l1-windows-001 — BSOD on Windows
- l1-windows-003 — Slow PC

## 12. Keywords / Search Tags
kernel panic, mac restart, spinning beach ball, rainbow wheel, mac frozen, mac crash, your computer was restarted because of a problem, macos hung, sudden restart, mac unresponsive, kext, system extension
