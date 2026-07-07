---
id: stub-hardware-triage
title: "Hardware break/fix triage (stub)"
category: hardware
support_level: L1
status: stub
keywords: [laptop, won't turn on, no power, black screen, won't charge, keyboard, trackpad, docking, battery, overheating]
---
## Won't power on / no lights
- Hold the power button 15–20s (hard reset). Try a different known-good charger + outlet.
- Remove the dock/peripherals; try power without them. Drain residual power (unplug, hold power 30s).
## Powers on but black screen
- Listen for fans/lights (booting?). Try external monitor to isolate panel vs GPU. Brightness keys.
- Force restart; if it posts to a logo then black → boot/OS issue (see boot-issues).
## Won't charge
- Confirm charger LED + correct wattage. Try another port. Check for bent/dirty USB-C pins.
- Battery report: `powercfg /batteryreport` for health/wear.
## Keyboard/trackpad dead
- External USB keyboard to confirm OS responds. Reseat dock. Update/reinstall input drivers.
## Docking station
- Reseat cable; update dock firmware + dock drivers; test ports directly on the laptop.
## Escalate
- No power after hard reset + known-good charger, burning smell, swollen battery, or liquid damage → hardware repair (do not keep powering on).
