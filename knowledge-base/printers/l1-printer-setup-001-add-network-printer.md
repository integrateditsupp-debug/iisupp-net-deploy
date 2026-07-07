---
id: l1-printer-setup-001
title: "Add a network or office printer to a Windows computer (setup / how-to)"
category: printing
support_level: L1
severity: normal
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
tech_generation: current
year_range: "Current"
eol_status: "Current. Applies to shared/network printers in home and small-office setups."
prerequisites: []
keywords:
  - add printer
  - add a printer
  - install printer
  - set up printer
  - setup printer
  - connect to printer
  - add network printer
  - add office printer
  - add shared printer
  - install network printer
  - printer not showing up
  - cant find printer
  - add printer by ip
  - wireless printer setup
  - install printer driver
  - how do i add a printer
related_articles:
  - l1-printer-001-not-printing
escalation_trigger: "The printer needs a manufacturer driver that Windows can't fetch and the user has no admin rights to install it, OR the office uses a print server / secure-release (badge) printing that requires IT provisioning. Then route to IT for driver/print-server setup."
intent: setup
vertical: generic
safe_recipe: "add-printer-wizard"
last_updated: 2026-06-28
version: 1.0
---

# Add a network or office printer to a Windows computer

> This is a SETUP / how-to article (adding a printer you don't have yet). If the printer is already added but **won't print**, see `l1-printer-001` instead.

## 1. What You Need First
- The printer is **powered on** and on the **same network** (Wi-Fi or wired) as your computer — or you have its **IP address** or **share path** (e.g. `\\printserver\HP-2ndFloor`).
- For office printers, the **exact name** or **IP** from whoever manages them.

## 2. Step-by-Step — Add the Printer

### Method A — Automatic (most home/small-office Wi-Fi printers)
1. Windows: **Settings → Bluetooth & devices → Printers & scanners**.
2. Click **Add device** (Windows 11) / **Add a printer or scanner** (Windows 10).
3. Wait ~30 seconds. If your printer appears in the list → click it → **Add device**. Windows downloads the driver automatically. Done.

### Method B — "The printer that I want isn't listed" (network/office printers)
1. Same screen → **Add device** → wait → click **Add manually** / **The printer that I want isn't listed**.
2. Choose one:
   - **Add a printer using an IP address or hostname** → Next → Device type **TCP/IP** → enter the printer's **IP address** (e.g. `192.168.1.50`) → Next. Windows finds it and installs a driver.
   - **Select a shared printer by name** → type the share path `\\server\printername` → Next. (Office print-server printers.)
3. If prompted for a driver, accept the suggested one, or pick the make/model from the list.
4. Optionally set it as **default** and **print a test page**.

### Method C — Manufacturer app (Wi-Fi setup from scratch)
- For a brand-new printer not yet on Wi-Fi, the maker's app (HP Smart, Canon PRINT, Epson Smart Panel, Brother iPrint) walks it onto your Wi-Fi, then it shows up in Method A.

## 3. Verification Steps
- The printer shows in **Settings → Printers & scanners** with status **Ready/Idle**.
- A **test page** prints (right-click the printer → Printer properties → Print Test Page).
- A real document from Word/PDF prints to the correct printer.

## 4. Common Snags
- **Printer doesn't appear:** confirm it's on the same network (not a guest Wi-Fi), and powered on. Print the printer's own network/config page to read its IP.
- **"Driver unavailable":** install the maker's driver from their website, or use a generic PCL6/PostScript driver for basic printing.
- **Office secure-release / badge printers:** these usually require IT to push the print queue — ask IT for the exact share path or the provisioning step.

## 5. When to Escalate
- No admin rights to install the needed driver.
- Office uses a print server, follow-me/secure-release, or 802.1X-restricted printer VLAN — IT must provision it.

## 6. User-Friendly Explanation
Adding a printer is usually quick: go to Settings → Printers & scanners → Add device, wait a few seconds, and pick your printer from the list — Windows installs the rest. If it doesn't show up, choose "the printer I want isn't listed" and add it by its IP address (for office printers, ask IT for the IP or the `\\server\printer` name). Then print a test page to confirm.

## 7. Internal Technician Notes
- Prefer TCP/IP port (Standard TCP/IP, RAW 9100) for static-IP office printers; reserve the IP on DHCP so it doesn't change.
- For print-server queues, `\\server\queue` pulls the driver via Point-and-Print (watch Point-and-Print Restrictions / the 2021+ PrintNightmare hardening — non-admins may be blocked from driver install by design).
- Universal Print (Entra/Intune) is the modern serverless option for M365 tenants — no on-prem print server.

## 8. Related KB Articles
- `l1-printer-001` — Printer is added but won't print (break/fix)

## 9. Keywords / Search Tags
add printer, install printer, set up network printer, add printer by ip, shared printer, \\server\printer, printers and scanners, the printer i want isn't listed, wireless printer setup, install printer driver
