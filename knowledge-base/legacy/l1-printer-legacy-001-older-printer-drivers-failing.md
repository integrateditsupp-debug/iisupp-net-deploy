---
id: l1-printer-legacy-001
title: "Older HP / Brother / Canon printer stops printing after Windows update"
category: printer
support_level: L1
severity: medium
estimated_time_minutes: 25
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: legacy
year_range: "Hardware 2008-2017; affected by Windows print stack rewrite 2021+"
eol_status: "Windows print spooler hardened after PrintNightmare (CVE-2021-34527). Microsoft Universal Print Driver replaced many vendor V3 drivers. Many pre-2017 printer drivers are unsigned or unmaintained."
prerequisites: ["Local admin to install / remove drivers"]
keywords:
  - hp laserjet
  - brother hl
  - canon pixma
  - print spooler
  - printnightmare
  - v3 driver
  - v4 driver
  - universal print driver
  - mopria
  - airprint
  - usb printer
  - network printer
  - print queue stuck
related_articles:
  - l1-printer-001-not-printing
  - l1-printer-002-prints-garbage
  - l2-printers-001-server-management
escalation_trigger: "Multiple printers fail across the office after a Windows feature update; or the vendor has marked the model 'end of support'; or the customer is on Win Server with print sharing affected."
last_updated: 2026-05-11
version: 1.0
---

# Older HP / Brother / Canon printer stops printing after Windows update

## 1. Symptoms
Printer worked fine for years. After a Windows update (often a feature update like 23H2 → 24H2 → 25H1) it stopped printing. Print jobs sit in the queue. Or print queue clears but nothing comes out. Sometimes Windows says "Driver is unavailable" in the printer settings.

## 2. Likely Causes
1. **Driver isolation / V3 driver blocked.** Post-PrintNightmare hardening (2021+) restricts non-administrator driver installs and removes Type 3 (kernel-mode) drivers in many cases.
2. **Vendor stopped releasing Windows drivers.** Common cutoff: HP printers pre-2010 (LaserJet 1018, 1020, 3050 — no signed Win 11 driver). Brother HL-2070/2140 series. Canon PIXMA MP/iP series before 2012.
3. **Universal Print Driver pulled.** Microsoft removed several inbox V3 drivers for older models in 22H2 / 23H2.
4. **Print spooler service crashed** and won't restart.
5. **IPP / WSD discovery broke** after feature update — printer appears but won't print.

## 3. Questions To Ask User
1. Exact printer model and approximate year purchased? (Model on a sticker on the back.)
2. Connected via USB, Ethernet, or Wi-Fi?
3. Did Windows update recently? (Settings → Windows Update → Update history.)
4. Does the printer work from any other device (phone, another PC)?
5. Are there other printers in the office and are they all affected?

## 4. Troubleshooting Steps
1. **Print test page from the device itself** (button combo on the printer) to confirm hardware works.
2. **Print from a phone using AirPrint / Mopria** to confirm network + printer health.
3. **Restart the Print Spooler service** on the PC: `services.msc` → Print Spooler → Restart.
4. **Clear the print queue:**
   - Stop Print Spooler service.
   - Delete files in `C:\Windows\System32\spool\PRINTERS\`.
   - Start Print Spooler.
5. **Run Windows printer troubleshooter:** Settings → System → Troubleshoot → Other troubleshooters → Printer → Run.

## 5. Resolution Steps

**Path A — Use vendor's latest universal driver (preferred):**
1. Download HP Universal Print Driver (UPD) PCL6 or PostScript from HP support site. Works for most HP devices 2005 onward.
2. For Brother: download "Brother Universal Printer Driver" from brother.com support.
3. For Canon: try Canon Generic Plus PCL6 / UFR II driver.
4. Install the universal driver. Add the printer using the new driver: Settings → Bluetooth & devices → Printers & scanners → Add device → "The printer I want isn't listed" → Add a local printer or network printer with manual settings.

**Path B — Force inbox / Microsoft IPP driver (when vendor has no Win 11 driver):**
1. Settings → Printers & scanners → Add device → "The printer I want isn't listed".
2. Select "Add a printer using an IP address or hostname".
3. Device type: "TCP/IP Device". Enter printer IP. Wait for detection.
4. When prompted for driver: pick **Microsoft IPP Class Driver** or **Generic / Text Only**.
5. Test print.

**Path C — USB-only printer with no signed driver:**
1. Buy a small print server (TP-Link TL-WPS510U, StarTech NETPRINT2) or convert via a Raspberry Pi running CUPS.
2. The print server speaks IPP / IPPS to Windows — bypasses the vendor driver dependency entirely.
3. On the PC, add the printer as an IPP network printer using Microsoft IPP Class Driver.

**Path D — Replace the printer (recommended for pre-2012 models being used in a business):**
1. Modern entry-level laser: Brother HL-L2460DW ($230). Modern entry-level inkjet: HP OfficeJet Pro 8135e ($230).
2. Both support AirPrint, Mopria, IPP — no driver hell on any OS.

## 6. Verification Steps
- Test print from Notepad succeeds.
- Test print from Word succeeds (richer format).
- Reboot the PC. Print again — confirms driver persists.
- Check Event Viewer → Microsoft → Windows → PrintService → Operational — no errors logged.

## 7. Escalation Trigger
- Five or more PCs affected after the same Windows update → group policy / driver deployment fix, not per-PC.
- Customer is in a regulated industry (medical, legal) and the old printer must stay (some prescription pads / legal forms are tied to specific printers) → L2/L3 design isolation.
- Print spooler keeps crashing after every reboot → corrupt installation, may need OS reset.

## 8. Prevention Tips
- **Buy new printers from vendors with multi-OS / universal driver commitment** — Brother, HP Enterprise series, Lexmark, Xerox.
- **Wi-Fi / Ethernet IPP printers** outlast USB-only printers by years on the driver compatibility curve.
- **Subscribe to vendor support bulletins** for the model — they announce EOL before Windows breaks compatibility.

## 9. User-Friendly Explanation
Your printer is older than the latest Windows version, and Microsoft tightened up how Windows talks to printers a few years back to stop hackers. We've got three options: a) use a universal driver from the printer maker, b) trick Windows into talking to it through a different protocol, or c) replace the printer with one that just works. The first one is free and usually works within 15 minutes.

## 10. Internal Technician Notes
- PrintNightmare hardening: KB5005033 (Aug 2021) introduced Point-and-Print restriction. KB5005652 made non-admin Point-and-Print install fail by default.
- Registry key for relaxed Point-and-Print (not recommended, but possible): `HKLM\Software\Policies\Microsoft\Windows NT\Printers\PointAndPrint` → `RestrictDriverInstallationToAdministrators` DWORD = 0.
- HP UPD download (current): https://support.hp.com/us-en/drivers/universal-print-driver
- Brother universal driver supports PCL emulation across most HL/MFC/DCP models post-2008.
- Canon Generic Plus PCL6 covers imageRUNNER ADVANCE series + most consumer PIXMA 2014+.
- For CUPS on Raspberry Pi: `apt install cups`, add user to lpadmin group, share via `cupsctl --share-printers --remote-any` and add the printer to Win 11 as an IPP network printer at `http://<pi-ip>:631/printers/<name>`.

## 11. Related KB Articles
- `l1-printer-001` — Printer not printing (modern)
- `l1-printer-002` — Printer prints garbage
- `l2-printers-001` — Print server management

## 12. Keywords / Search Tags
hp laserjet, brother hl, canon pixma, printnightmare, v3 driver, v4 driver, universal print driver, upd, ipp, mopria, airprint, print spooler, cups, raspberry pi print server, point and print, kb5005033, kb5005652
