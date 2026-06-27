---
id: l1-office-001
title: "Repair or reinstall Microsoft Office (Word/Excel/PowerPoint won't open)"
category: office
support_level: L1
severity: medium
estimated_time_minutes: 20
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
prerequisites: ["Signed in with the licensed work account"]
keywords:
  - office
  - microsoft 365
  - word
  - excel
  - powerpoint
  - onenote
  - repair
  - reinstall
  - wont open
  - crash
  - freeze
  - activation
---

# Repair / reinstall Microsoft Office

## 1. Quick checks
- Save work; close all Office apps (Task Manager → end any lingering WINWORD/EXCEL).
- Restart the PC and retry.

## 2. Online Repair (fixes most launch/crash/freeze issues)
1. Settings → **Apps → Installed apps** → Microsoft 365 / Office → **Modify**.
2. Try **Quick Repair** first (fast, offline) → reopen the app.
3. Still broken → **Online Repair** (re-downloads + fully repairs; needs internet + sign-in).

## 3. Safe Mode (isolates add-ins)
Hold **Ctrl** while launching, or run `winword /safe`. If it opens, disable add-ins (File → Options → Add-ins → COM Add-ins → Go → uncheck).

## 4. Activation / "unlicensed product"
File → Account → confirm you're signed in with the licensed work account; sign out/in. Verify the M365 license is assigned (see the Microsoft 365 article).

## 5. Reinstall (last resort)
Uninstall Office → reboot → reinstall from **portal.office.com → Install apps** → sign in to re-activate.
