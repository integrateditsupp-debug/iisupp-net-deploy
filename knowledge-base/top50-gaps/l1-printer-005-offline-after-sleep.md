---
id: l1-printer-005
title: "Network printer shows 'offline' after PC wake or reboot"
category: printing
support_level: L1
severity: medium
estimated_time_minutes: 6
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - printer offline
  - printer disconnected after wake
  - printer status offline
  - cant communicate with printer
  - printer ip changed
  - dhcp printer disappeared
  - use printer offline
  - reactivate network printer
tags:
  - printer
  - network
  - top-50
related: [l1-printer-001-not-printing, l1-printer-003-print-queue-stuck, l1-printer-004-cant-find-printer]
---

# Printer offline after sleep / wake

### Printer shows "Offline" — check Use Printer Offline isn't toggled

Common gotcha. Settings → Bluetooth & devices → Printers & scanners → click your printer → Open print queue → Printer menu (top-left) → uncheck "Use Printer Offline." Some Windows builds set this automatically when the printer becomes unreachable, then leave it stuck even after the printer is back. Toggle it off and try printing.

### Printer was on DHCP, IP changed after weekend reboot

Office printers should have static IPs. If yours got a new IP from DHCP overnight, your saved printer config points to the old IP. Walk to the printer, print the network configuration page (HP: Settings → Reports → Network Configuration; Brother: Network → Print Configuration). Note the new IP. On your PC: Settings → Printers & scanners → remove old printer → add by IP using the new address. Long-term fix: ask IT to reserve a static IP for office printers in DHCP.

### Restart Print Spooler — fixes 50% of "offline" states

Spooler service crashed during sleep. Press Win+R → `services.msc` → Enter. Scroll to **Print Spooler**. Right-click → Restart. Wait 10 seconds. Send a test print. If it works, the spooler was the issue — happens after Windows updates or driver glitches. If still offline, the printer or network is the problem.

### Printer's panel shows "Sleep" — wake it up

Some printers (especially HP, Brother) hibernate after 30-60 min of idle. They look "offline" to clients during deep sleep. Walk to the printer, press any panel button to wake. Try printing within 30 seconds. If this happens daily, increase the sleep timer on the printer's web admin page (browse to its IP) — default is often 15 min; bump to 60 min.

### Multiple PCs can't see the printer — it's the network

If only your PC reports offline, it's local. If everyone reports offline, the printer dropped off the network. Walk to the printer: is the network cable plugged in? Wi-Fi LED lit? Any error code on the panel? Power-cycle (off 30 sec, on). After it boots, wait 2 min for full network re-registration. If still offline org-wide, ask IT to check the print server / VLAN.

### Mac shows "Paused" or "Idle" but won't print

System Settings → Printers & Scanners → click printer → Open Print Queue → click "Resume Printer" if it shows that button. Sometimes paused on a previous error. If queue is empty and printer shows ready but jobs vanish: Reset printing system (System Settings → Printers & Scanners → right-click empty area → Reset printing system) → re-add printer.

### When to escalate to L2

Spooler won't start at all (service crashes immediately). Multiple users on same network printer all show offline despite power-cycle. Print server isn't reachable from any PC. Static-IP'd printer disappears after a Windows feature update (driver issue). Garbage prints after the offline clear — see KB l1-printer-002.
