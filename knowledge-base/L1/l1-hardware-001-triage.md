---
id: l1-hardware-001
title: "Laptop/PC hardware triage — won't power on, black screen, won't charge, dead keyboard, dock"
category: hardware
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - hardware
  - wont turn on
  - no power
  - black screen
  - wont charge
  - battery
  - keyboard
  - trackpad
  - docking station
  - no display
  - fan
---

# Hardware break/fix triage

## 1. Won't power on / no power
1. Confirm the charger LED is on + the outlet works (try another outlet).
2. **Hard reset:** unplug, hold power 30s, replug, power on.
3. Remove all USB/dock devices, try again.
4. Still dead → likely PSU/battery/board → **escalate for hardware service** (log the asset tag).

## 2. Black / blank screen but powered
- Listen for fans; connect an **external monitor** (Win+P). If external works, the panel/cable is faulty.
- Force display wake: **Win+Ctrl+Shift+B**.

## 3. Won't charge / battery drains
- Try a known-good charger + cable; clear debris from the port.
- Run `powercfg /batteryreport` to confirm wear → request a replacement if degraded.

## 4. Dead keyboard / trackpad
- Try an external USB keyboard. If that works, the built-in keyboard is faulty → service.
- Check Device Manager (HID); reinstall the driver.

## 5. Docking station
- Reseat the dock cable; update dock firmware + the laptop's USB-C/Thunderbolt driver.
- Test the monitor directly on the laptop to isolate dock vs laptop.

## 6. When to escalate
Physical faults (no power, cracked panel, failed SSD, swollen battery) need a technician — log a hardware ticket with the asset tag.
