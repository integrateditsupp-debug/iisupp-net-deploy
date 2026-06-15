---
id: l2-printers-001
title: "Print server / queue management / Universal Print rollout"
category: printers
support_level: L2
severity: medium
estimated_time_minutes: 30
audience: admin
prerequisites: ["Print server admin", "Intune / GPO"]
os_scope: ["Windows Server 2016+", "Windows 10/11"]
keywords:
  - print server
  - print queue
  - universal print
  - printnightmare
  - point and print
  - driver isolation
  - 0x0000011b
related_articles:
  - l1-printer-001
  - l1-printer-002
escalation_trigger: "PrintNightmare-class CVE in environment, or print server compromise, or fleet-wide outage"
last_updated: 2026-05-07
version: 1.0
---

# Print server / queue / Universal Print

## 1. Common scenarios
- Mass error 0x0000011b after security update.
- Spooler service crashing on print server.
- Driver isolation incompatibility.
- Migrating to Universal Print (cloud).

## 2. Error 0x0000011b (PrintNightmare-related)
- Microsoft hardened RPC; some drivers / configs break.
- **Workaround (security trade-off):** `HKLM\SYSTEM\CurrentControlSet\Control\Print → RpcAuthnLevelPrivacyEnabled = 0`.
- **Better:** update drivers to vendor's PrintNightmare-compatible version + keep registry secure.
- **Best:** move to Universal Print + Direct Print where possible.

## 3. Spooler service crashes
- Event Viewer → System → Source = Service Control Manager / PrintService.
- Identify driver causing crash (`PrintService/Operational` log shows driver name on access).
- Remove offending driver: `pnputil /enum-drivers` → `pnputil /delete-driver oem##.inf /uninstall /force`.
- Reinstall vendor's current driver.
- Spooler service Recovery tab → restart on first/second/subsequent failure.

## 4. Driver isolation
- Print Management → Drivers → driver → Set Driver Isolation = "Isolated".
- Crashes confined to `PrintIsolationHost.exe`, spooler stays alive.

## 5. Universal Print migration
- Connector installed on a Windows Server with line-of-sight to physical printers.
- Register printers in Universal Print portal.
- Push printers via Intune (Configuration → Universal Print policy).
- Users see them under Settings → Printers, queue lives in Azure.
- No more on-prem print server for Win10/11 fleets.

## 6. Verification
- Test print across all critical printers post-change.
- Spooler stable for 24h.
- Driver list matches approved baseline.
- For UP: printers listed in user's "Printers & scanners" without manual install.

## 7. Escalation
- Active CVE exploitation in environment.
- Print server compromise.
- → L3 / Security.

## 8. Prevention
- Vendor drivers: PCL 6 universal preferred for fleet.
- Keep print server patched + isolated (not domain controller).
- Migrate to Universal Print to retire on-prem print servers.
- Driver review: maintain a curated list, no random installs.
- Monthly audit of installed drivers.

## 9. Notes
- Universal Print subscription includes a job allotment per license — track usage.
- Direct Print (UP without connector) requires printers with native UP support.
- For shared computer scenario / RDS, isolate drivers strictly — driver crash on RDS host kills printing for all users.

## 10. Related
- l1-printer-001 — User-facing not printing
- l1-printer-002 — Garbled output

## 11. Keywords
print server, print queue, universal print, printnightmare, point and print, driver isolation, 0x0000011b
