---
id: l1-hardware-001
title: "Hardware break/fix triage — power, display, input, dock"
category: hardware
support_level: L1
severity: medium
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
keywords:
  - hardware
  - won't turn on
  - no power
  - black screen
  - won't charge
  - keyboard
  - trackpad
  - docking station
  - battery
  - overheating
  - dead laptop
related_articles: []
escalation_trigger: "See the Escalate section in the body."
last_updated: 2026-06-27
version: 1.0
status: active
---
# Hardware break/fix triage

## Won't power on / no lights
- Hold the power button 15–20s for a hard reset. Try a different known-good charger and wall outlet.
- Remove the dock and all peripherals, then try power without them. Drain residual power (unplug, hold power 30s).

## Powers on but black screen
- Listen for fans/lights (is it actually booting?). Connect an external monitor to isolate the panel vs the GPU. Try the brightness keys.
- Force restart; if it shows a logo then goes black, that's a boot/OS issue, not the display.

## Won't charge
- Confirm the charger LED and correct wattage. Try another port. Check for bent or dirty USB-C pins.
- Run `powercfg /batteryreport` for battery health and wear level.

## Keyboard / trackpad dead
- Plug in an external USB keyboard to confirm the OS responds. Reseat the dock. Update/reinstall input drivers.

## Docking station
- Reseat the cable; update dock firmware and dock drivers; test the ports directly on the laptop.

## Stop and escalate to repair
- No power after a hard reset + known-good charger, a burning smell, a swollen battery, or liquid damage → hardware repair. Do not keep powering it on.

## Keywords
hardware, won't turn on, no power, black screen, won't charge, keyboard, trackpad, docking station, battery, overheating, dead laptop
