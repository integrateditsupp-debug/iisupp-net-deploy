---
id: l1-printer-004
title: "Can't find printer — network printer not showing in Add Printer list"
category: printing
support_level: L1
severity: medium
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["Printer is powered on", "You're on the same network OR have driver"]
keywords:
  - printer not found
  - cant find printer
  - network printer missing
  - add printer empty list
  - printer disappeared
  - office printer gone
  - printer offline
  - cant add printer windows
  - printer not in airprint list
  - printer not showing in mac
tags:
  - printer
  - network
  - top-50
related: [l1-printer-001-not-printing, l1-printer-002-prints-garbage, l1-printer-003-print-queue-stuck]
---

# Network printer not in your list — find and add it

## Symptoms

- "Add Printer" dialog shows empty list
- Printer worked yesterday, today it's gone
- AirPrint doesn't see the office printer from your iPhone
- macOS "Add Printer" can't find network printer
- New laptop never picked up the office printer
- Printer name shows but won't add ("driver unavailable" or similar)

## Step 1 — Verify the basics

Before chasing software:
1. **Printer powered on?** Walk over and check.
2. **No paper jam / error code on the printer's display?**
3. **Network cable plugged in** (if wired) or **Wi-Fi indicator lit** (if wireless)?
4. **You on the office Wi-Fi**, not guest Wi-Fi or VPN? Many office networks segregate VLANs so guest Wi-Fi can't see printers.

If any of those is wrong, fix it first.

## Step 2 — Verify printer's network state

Most office printers have a panel that can print a network configuration page:
- HP: Settings → Reports → Network Configuration.
- Brother: Network Information → Configuration.
- Canon: Setup → Device Settings → Network Settings → Print Network Status.

Print it. Look for an **IP address**. Note it.

If no IP, the printer isn't on the network at all. Power-cycle the printer (off 30 sec, on). Walk away for 2 minutes. Reprint config.

## Step 3 — Add printer by IP (most reliable)

If Windows / macOS "auto-discover" failed, manually add by IP.

### Windows 11
1. Settings → Bluetooth & devices → Printers & scanners → Add device.
2. Wait for discovery. If yours shows, click → install. Done.
3. If not: scroll → "The printer that I want isn't listed."
4. Pick **"Add a printer using an IP address or hostname."**
5. Enter IP from Step 2.
6. Pick the manufacturer + model from the driver list, or "Have Disk" if you downloaded a driver.
7. Done.

### Windows 10
- Settings → Devices → Printers & scanners → Add a printer.
- Same path otherwise.

### macOS
1. System Settings → Printers & Scanners → +.
2. Top of the dialog: tabs (Default / IP / Windows / Advanced).
3. Click **IP**.
4. Enter IP. Protocol: usually IPP or LPD. Queue: usually empty or "auto."
5. Use: pick driver or "Generic PostScript."
6. Add.

## Step 4 — Driver issues

### "Driver unavailable" or doesn't show in list
- Download driver from manufacturer's site BEFORE adding.
  - HP: hp.com/support → enter your model.
  - Brother: brother.ca/support.
  - Canon: canon.ca → support → drivers.
  - Lexmark: lexmark.com → support → drivers.
- Install driver first, then add printer.
- Use Universal Print Driver (UPD) if your IT shop uses it — works for most enterprise fleets.

### "Windows can't connect to this printer" (error 0x000003e3 or similar)
- Restart the **Print Spooler** service (services.msc → Print Spooler → Restart).
- See `l1-printer-003-print-queue-stuck` for full spooler reset.

## Step 5 — Specific environment fixes

### Corporate AD/Azure-joined PC
- Type `\\printserver` in File Explorer (replace with your actual print server name — ask IT).
- See list of shared printers.
- Right-click yours → Connect → install.

If you don't know the print server name, IT will know it. Common naming: `print01`, `printsrv`, `\\corp-prints`.

### "Printer worked yesterday, gone today"
- Check if you're on a different Wi-Fi / VPN than yesterday.
- Check if printer IP changed (DHCP may have re-assigned it). The IT team can assign a static IP to prevent this.
- Power-cycle your laptop + the printer.

### "iPhone / iPad doesn't see office printer"
- iOS uses AirPrint. The printer needs AirPrint-compatible firmware (most enterprise printers do; some don't).
- Phone needs to be on the SAME subnet as the printer (often blocked between guest Wi-Fi and office Wi-Fi).
- If printer doesn't support AirPrint, install vendor's app (HP Smart, Canon PRINT, Brother iPrint&Scan).

### Mac on a Windows print server
- System Settings → Printers & Scanners → + → click "Windows" tab.
- Workgroup → click yours → server → printer.
- Pick driver. Add.

### "Multiple printers, only some show"
- Some printers are restricted (e.g., color printer requires permission). Ask IT for access.
- Or your driver is missing for a subset of printer models. Install the universal driver.

## When to escalate

| Situation | Path |
|---|---|
| Printer has no IP after power-cycle | L2 — network issue, possibly hardware fault |
| You can ping the IP but Windows still can't add | L2 — driver or firewall issue |
| All printers gone from your laptop after Windows update | L2 — possible spooler corruption |
| Need access to restricted printer (color, finance, etc.) | L1 — IT grants permission |
| Whole office can't see any printers | L2 — print server or network outage |

## Prevention

- After a major Windows feature update, take 60 sec to verify printers still work.
- Don't unplug office printer's Ethernet cable casually — it may take 5 minutes to fully re-register.
- For static-IP'd office printers, get the IP from IT and save it. If discovery breaks, you can always add by IP.
- Mac: if you swap networks (home / office / coffee shop) and one of those has the same SSID name with different setup, printers will get re-detected each time. Annoying but normal.

## What ARIA can help with

ARIA can walk you through Add-by-IP, identify whether your issue is network-layer / driver / permission, and find the right driver download link for your specific printer model. ARIA cannot physically check if the printer's power cable is plugged in.
