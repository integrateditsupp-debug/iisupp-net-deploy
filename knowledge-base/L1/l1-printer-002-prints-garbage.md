---
id: l1-printer-002
title: "Printer prints garbled / unreadable / wrong characters"
category: printers
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - garbled print
  - wrong characters
  - prints symbols
  - prints code
  - printer driver
  - corrupt print
related_articles:
  - l1-printer-001
  - l2-printers-001
escalation_trigger: "Replacing driver doesn't resolve, or print server queue produces same output for all users"
last_updated: 2026-05-07
version: 1.0
---

# Printer prints garbled / wrong characters

## 1. Symptoms
- Pages of random characters / symbols / boxes.
- Half a page prints, then ejects.
- Strange page formatting — text runs off the side.
- Color or graphics missing entirely.
- Test page is fine but actual documents print junk.

## 2. Likely Causes
1. Wrong driver (e.g., installed PCL when printer is PostScript, or vice versa).
2. Universal driver picked for printer that wants vendor-specific.
3. Driver corrupt — print spool data malformed.
4. Stuck print job in queue corrupted subsequent jobs.
5. Cable / network issue corrupting data mid-stream (rare).
6. Application using wrong page size or font not embedded.

## 3. Questions To Ask User
1. Does the printer's own test page (from its physical menu) print correctly?
2. Does ANY app print correctly, or all garbled?
3. Is this a new printer, or has it been working before?
4. What driver name appears in Settings → printer → Properties?

## 4. Troubleshooting Steps
1. From printer menu, print a self-test page — confirms hardware OK.
2. Try printing a different document type (Notepad → simple text).
3. Settings → Printers & scanners → printer → Open queue → cancel all jobs.
4. Restart Print Spooler service.
5. Note current driver name (Settings → printer → Printer properties → Advanced tab → Driver field).

## 5. Resolution Steps
**Wrong driver type:**
1. Identify printer model (label on physical printer).
2. Visit vendor support site → download "PCL 6" driver if printer supports PCL, or "PostScript / PS" for PS printers (most modern enterprise printers prefer PCL 6 for Windows).
3. Settings → Printers & scanners → remove existing printer.
4. Install fresh driver from downloaded package (vendor's installer is best).
5. Re-add printer.

**Corrupt driver:**
1. Print Management (`printmanagement.msc`) → All Drivers → right-click old driver → Remove driver package.
2. Reinstall fresh.

**Stuck job poisoning queue:**
1. Stop spooler service.
2. Delete files in `C:\Windows\System32\spool\PRINTERS\`.
3. Start spooler.
4. Re-add the print job from Word/Excel/etc.

**Universal driver issue:**
- For HP devices, "HP Universal Print Driver" can confuse some printers. Use the device-specific PCL 6 driver instead.

**Application-side issue:**
- Try Print to PDF first, then send PDF to printer. If PDF looks fine but printed garbage → driver. If PDF is also garbage → app problem.

## 6. Verification Steps
- Test print from Notepad reads correctly.
- Word doc prints with proper layout, fonts, images.
- Color output (if applicable) matches screen.
- Multiple pages print without corruption.
- 5+ documents printed without recurrence.

## 7. Escalation Trigger
- After driver reinstall, garbage continues.
- Print server queue (`\\printserver\Q`) produces same garbage for all users.
- Vendor driver not available for current Windows build.
- Hardware suspected (e.g., specific page area always corrupt — toner contamination).
- → Escalate to **L2** with: printer model, current driver name + version, sample output photo, app used, server queue if applicable.

## 8. Prevention Tips
- Match driver type (PCL/PS) to printer's actual capabilities.
- Use vendor's official driver, not generic Windows-supplied.
- For corporate, use a centrally-managed print server with curated drivers.
- Keep firmware on printer current.
- Don't mix universal and device-specific drivers across same printer fleet.

## 9. User-Friendly Explanation
"The printer is getting confused about what it should print. Almost always it's the driver — the translator between your computer and the printer is using the wrong dictionary. We'll swap to the right one and you'll get clean output. Should take a few minutes."

## 10. Internal Technician Notes
- PCL 6 (XL) is preferred for most modern HP/Brother/Lexmark.
- PostScript is preferred for Adobe-heavy / pre-press / high-end laser.
- Print queue files: `.SHD` (shadow / metadata) and `.SPL` (raw spool data) in `%systemroot%\System32\spool\PRINTERS\`.
- For server-side, Print Management → Forms tab and Drivers tab; v3 vs v4 driver model matters (v4 is "type 4" / package-aware, less prone to corruption).
- For PCL prints showing readable text mid-garbage, often a font isn't embedded — check application's print settings for "Print as image" workaround.
- Network packet drops corrupting raw print streams — check switch port errors if persistent.

## 11. Related KB Articles
- l1-printer-001 — Printer not printing at all
- l2-printers-001 — Print server / queue / driver management

## 12. Keywords / Search Tags
garbled print, wrong characters, prints symbols, prints code, printer driver, corrupt print, pcl, postscript
