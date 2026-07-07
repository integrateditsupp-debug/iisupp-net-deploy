---
id: l1-office-002
title: "Re-enable a disabled Office add-in (Excel / Outlook / Word)"
category: office
support_level: L1
severity: medium
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["The add-in was working before and is still installed"]
keywords:
  - excel add-in disabled
  - outlook disabled my add-in
  - re-enable disabled add-in
  - com add-in missing from ribbon
  - vsto add-in not loading
  - disabled items office
  - add-in disappeared
  - manage com add-ins
  - my toolbar is gone
  - addin not showing
tags:
  - office
  - excel
  - outlook
  - add-ins
  - top-50
related: [l1-office-001-repair-reinstall, l1-files-001-office-file-wont-open, l1-outlook-006-profile-ost-rebuild]
---

# Re-enable a disabled Office add-in (Excel / Outlook / Word)

## Symptoms
- A ribbon tab or toolbar you use every day (e.g., an accounting, tax, or reporting add-in) has vanished.
- "A problem was detected with an add-in and it has been disabled."
- The add-in still shows as installed but does nothing.
- It happened right after Office crashed or was force-closed.

## Likely causes
- Office disabled the add-in automatically after it slowed startup or was open during a crash ("Disabled Items").
- The COM add-in got unticked.
- The add-in loads from a network location that was briefly unreachable.

## Safe steps (do these in the affected app — Excel, Outlook, or Word)
- **Check the "Disabled Items" list (most common fix):**
  - File → Options → **Add-ins**.
  - At the bottom, set **Manage:** to **Disabled Items** → **Go**.
  - If your add-in is listed → select it → **Enable** → close and reopen the app.
- **Re-tick the COM add-in:**
  - File → Options → Add-ins → set **Manage:** to **COM Add-ins** → **Go**.
  - Tick the checkbox next to your add-in → **OK**.
  - If it un-ticks itself after a restart, it's failing to load — note the exact name for IT.
- **Stop Office from disabling it for being "slow" (Outlook):**
  - File → Options → Add-ins → **Manage: COM Add-ins → Go** to confirm it's enabled.
  - File → Options → **Add-ins** → also check the **Slow and Disabled COM Add-ins** panel (Outlook's start screen may show "Always enable this add-in").
  - Choose **Always enable this add-in** if prompted.
- **If it still won't load:**
  - Close the app fully, reopen, and re-check the COM Add-ins list.
  - Repair Office (File → Account, or Settings → Apps → Microsoft 365 → Modify → **Quick Repair**) — see the Office repair runbook.

## Verify
- The add-in's ribbon tab / toolbar is back.
- Its buttons respond and the add-in shows as **Active** under File → Options → Add-ins.
- It survives a full close-and-reopen of the app.

## When to escalate (to L2 / IT)
- The add-in is a managed/business add-in (accounting, tax, CRM, market-data) that keeps disabling after every restart.
- It's greyed out and can't be enabled (may be blocked by policy).
- It needs a version update or a license the user can't set themselves.

## Safety notes
- Enabling an add-in you recognize and installed is safe and reversible (you can disable it the same way).
- Don't enable an unfamiliar add-in you didn't install — note its name and ask IT.

## What ARIA can help with
- ARIA can guide you to the exact Disabled Items / COM Add-ins panel for whichever Office app is affected and confirm the add-in is back to **Active**. It reads only the add-in's on/off state, never your documents.
