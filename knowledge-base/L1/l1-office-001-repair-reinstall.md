---
id: l1-office-001
title: "Office / Microsoft 365 apps — repair & reinstall"
category: app-repair
support_level: L1
severity: medium
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
keywords:
  - office
  - microsoft 365
  - word
  - excel
  - powerpoint
  - onenote
  - repair
  - reinstall
  - won't open
  - crash
  - activation
related_articles: []
escalation_trigger: "See the Escalate section in the body."
last_updated: 2026-06-27
version: 1.0
status: active
---
# Office / Microsoft 365 apps — repair & reinstall

## Quick fix
- Close all Office apps. Settings → Apps → Microsoft 365 → Modify → **Quick Repair** (offline, fast). If that doesn't fix it → **Online Repair** (reinstalls components, needs internet).

## Activation
- File → Account → check "Product Activated." If not: sign out and back in with the licensed account; confirm a license is assigned (admin).

## Outlook-specific
- New Outlook profile: Control Panel → Mail → Show Profiles → Add → set as default. A rebuild fixes corrupt-profile crashes.
- Safe mode: run `outlook /safe` to isolate a bad add-in, then disable add-ins.

## Reinstall
- If repair fails: uninstall Office → reboot → reinstall from the Microsoft 365 portal (or use the SaRA Office removal tool for a clean wipe).

## Escalate
- Activation blocked by licensing, or repeated crashes after Online Repair + a new profile → L2 / M365 admin.

## Keywords
office, microsoft 365, word, excel, powerpoint, onenote, repair, reinstall, won't open, crash, activation
