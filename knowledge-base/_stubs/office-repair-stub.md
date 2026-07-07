---
id: stub-office-repair
title: "Office / Microsoft 365 apps repair & reinstall (stub)"
category: app-repair
support_level: L1
status: stub
keywords: [office, microsoft 365, outlook, word, excel, teams, crash, won't open, repair, reinstall, activation, profile]
---
## Quick fix
- Close all Office apps. Settings → Apps → Microsoft 365 → Modify → **Quick Repair** (offline, fast). If unresolved → **Online Repair** (reinstalls components, needs internet).
## Activation
- File → Account → check "Product Activated." If not: sign out + back in with the licensed account; confirm a license is assigned (admin).
## Outlook-specific
- New Outlook profile: Control Panel → Mail → Show Profiles → Add → set as default. Rebuild fixes corrupt-profile crashes.
- Safe mode: `outlook /safe` to isolate a bad add-in → disable add-ins.
## Reinstall
- If repair fails: uninstall Office → reboot → reinstall from the M365 portal (or the SaRA Office removal tool for a clean wipe).
## Escalate
- Activation blocked by licensing, repeated crash after Online Repair + new profile → L2 / M365 admin.
