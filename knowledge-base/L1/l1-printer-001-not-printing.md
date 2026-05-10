---
id: l1-printer-001
title: "Printer not printing / job stuck in queue"
category: printers
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - printer
  - not printing
  - print queue
  - stuck job
  - offline
  - print spooler
  - won't print
  - paper jam
  - error printing
related_articles:
  - l2-printers-001
  - l1-printer-002
escalation_trigger: "Print server side error, or driver requires admin install, or hardware error code on display"
last_updated: 2026-05-07
version: 1.0
---

# Printer not printing / job stuck in queue

## 1. Symptoms
- Click Print, nothing comes out.
- Printer shows "Offline" in Windows.
- Job sits in queue with status "Error", "Spooling", or "Sent to printer" forever.
- Printer prints garbage / unreadable characters.
- "Cannot connect to printer" error 0x00000709 or similar.
- Printer powers on but won't accept jobs.

## 2. Likely Causes
1. Printer powered off or sleeping.
2. Network or USB connection lost.
3. Print spooler service stopped/crashed.
4. Stuck job blocks queue.
5. Wrong default printer selected.
6. Driver mismatch / corrupt.
7. Out of paper / toner / ink.
8. Paper jam.
9. Printer's IP changed (DHCP).

## 3. Questions To Ask User
1. Is the printer powered on, with no error lights?
2. Is it USB or network (Wi-Fi / Ethernet)?
3. Does the printer's display show any error message?
4. Does the printer queue show "Offline" or any items?
5. Does it work for other people / from a phone?
6. When did it last work?

## 4. Troubleshooting Steps
1. Confirm printer power, paper, no jam, all covers closed.
2. Settings → Printers & scanners → select printer → Open queue.
3. Cancel all stuck jobs (right-click each → Cancel; or Printer menu → Cancel All Documents).
4. Check "Use Printer Offline" — if checked, uncheck.
5. Set as default if user has multiple.
6. For network printers: ping the printer's IP from Command Prompt.
7. Restart Print Spooler:
   - Win+R → `services.msc`.
   - Find "Print Spooler" → Right-click → Restart.

## 5. Resolution Steps
**If queue stuck:**
1. Stop Print Spooler service.
2. Open `C:\Windows\System32\spool\PRINTERS\` — delete all files inside.
3. Start Print Spooler.
4. Re-send job.

**If "Offline" persists:**
- Power-cycle printer (off 30 sec, on, wait 2 min for boot).
- Verify network: ping printer IP. If fails, DHCP changed IP — reconfigure printer port to current IP, or use hostname.

**If wrong / stale driver:**
- Settings → Printers & scanners → printer → Remove device.
- Re-add: + Add device → wait for discovery → install.
- For corporate printers, use the print server queue (`\\printserver\printername`) instead of direct IP.

**If hardware error on display:**
- Note exact error code from printer (e.g., HP "59.40", Brother "TS-02").
- Refer to printer's manual or vendor support.
- Often fixed by reseating toner cartridge or clearing paper path.

**If garbage output:**
- Wrong driver — uninstall, install printer's exact model driver from vendor site (not the generic).

## 6. Verification Steps
- Test page prints cleanly (Settings → printer → Open queue → Printer → Properties → Print Test Page).
- Real document from Word prints to correct printer.
- Print queue empty after job completes.
- Printer status shows "Ready" or "Idle".

## 7. Escalation Trigger
- Print server (`\\printserver`) unreachable.
- Driver install requires admin and user lacks rights.
- Hardware error code from display.
- Issue affects all users of this printer.
- → Escalate to **L2** with: printer make/model, IP, error codes, screenshot of queue, driver name/version.

## 8. Prevention Tips
- Use print server / managed print queue for shared printers — easier to fix centrally.
- Don't install random "Universal Print Driver" downloads from search engines — use vendor official.
- Reserve printer IP via DHCP reservation so it doesn't shift.
- Power-cycle printers monthly.
- Replace toner before "low" — running empty causes spooler errors.

## 9. User-Friendly Explanation
"Your printer and your computer aren't seeing eye to eye. Usually one stuck job blocks everything behind it, or Windows decided the printer is offline. We'll clear the queue, restart the print service, and make sure the printer is reachable. Should be one of the faster fixes."

## 10. Internal Technician Notes
- Print Spooler service name: `Spooler`. CLI restart: `net stop spooler && net start spooler`.
- Stuck queue dir: `%systemroot%\System32\spool\PRINTERS\` — `.SHD` and `.SPL` files. Delete only when service is stopped.
- Network printer IP discovery: print printer's network config page from its physical menu.
- Error 0x00000709 = print server / GPO mismatch on default printer; check `HKCU\Software\Microsoft\Windows NT\CurrentVersion\Windows → Device`.
- Error 0x0000011b (since 2021 KB) = related to PrintNightmare patches; need vendor patched drivers, or registry value `HKLM\SYSTEM\CurrentControlSet\Control\Print → RpcAuthnLevelPrivacyEnabled = 0` (security trade-off).
- For Mac, use IPP/Bonjour discovery; CUPS web UI at `localhost:631` for advanced.

## 11. Related KB Articles
- l1-printer-002 — Printer prints garbled / wrong characters
- l2-printers-001 — Print server and queue management

## 12. Keywords / Search Tags
printer, not printing, print queue, stuck job, offline, print spooler, won't print, paper jam, error printing
