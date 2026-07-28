---
id: l1-hardware-001
title: "Endpoint or peripheral device won't power on, won't boot, or stops responding"
category: hardware
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "Android", "iOS", "Embedded/Kiosk"]
prerequisites: []
keywords:
  - hardware
  - won't turn on
  - wont power on
  - won't boot
  - frozen
  - unresponsive
  - no display
  - black screen
  - workstation on wheels
  - wow cart
  - computer on wheels
  - cart pc
  - pos terminal
  - point of sale
  - cash drawer
  - self checkout
  - kiosk
  - touchscreen not responding
  - panel pc
  - hmi
  - rugged tablet
  - handheld
  - rf terminal
  - scanner gun
  - barcode scanner
  - label printer
  - thermal printer
  - docking station
  - dock not working
  - second monitor not detected
  - monitor blank
  - screen flickering
  - battery dead
  - not charging
  - overheating
  - smart card reader
  - cac reader
  - piv reader
  - badge reader
  - proximity reader
  - fingerprint reader
  - trading turret
  - squawk box
  - ticker screen
  - video wall
  - time clock kiosk
  - key encoder
  - kitchen display
  - weigh scale
  - forklift mounted computer
related_articles:
  - l1-usb-001
  - l1-printer-001
  - l1-bluetooth-001
  - l1-newdevice-001
escalation_trigger: "No power with a known-good outlet and known-good PSU/battery, visible physical damage, burning smell, repeated thermal shutdown, or the unit is a medical/production/POS device that halts patient care, a production line, or revenue capture"
last_updated: 2026-07-28
version: 1.0
---

# Endpoint or peripheral device won't power on, won't boot, or stops responding

This article covers physical device faults on any endpoint or attached peripheral — desktops, laptops, tablets, carts, kiosks, terminals, scanners, readers, docks, and displays — across clinical, retail, plant-floor, trading-desk, government, and hospitality environments. It is the first stop for anything phrased as "X won't turn on," "X is frozen," "X won't charge," or "X isn't detected," when the problem is the device itself rather than a network, account, or application.

## 1. Symptoms

- Device shows no lights, no fans, no boot chime — completely dead.
- Power light is on but the display stays black.
- Unit powers on and then shuts off again within seconds or minutes.
- Touchscreen is lit but ignores touch, or registers touches in the wrong place.
- Screen flickers, ghosts, or shows lines and artifacts.
- Battery drains fast, won't hold charge, or won't charge on the cart/dock/cradle.
- Device is hot to the touch, fans are loud, and it throttles or shuts down.
- Attached peripheral (scanner, reader, drawer, scale, encoder, printer) is not detected by the host.
- Docking station connects power but not video, network, or USB.
- Second monitor is not detected, or shows "No signal."
- Mobile/handheld unit works off the cradle but dies as soon as it's docked, or vice versa.

## 2. Likely Causes

1. Power delivery — dead outlet, failed brick, frayed cable, drained cart battery, tripped PDU/UPS.
2. Battery at end of life on a mobile cart, handheld, tablet, or laptop (very common on 3+ year old fleet devices).
3. Cable or connector fault — bent pin, charge-only USB-C cable, loose DisplayPort/HDMI, damaged dock connector.
4. Firmware or driver in a bad state after an update — device enumerates but doesn't initialize.
5. Thermal shutdown from blocked vents, dust, or an environment above rated temperature (plant floor, kitchen, pool deck, vehicle mount).
6. Physical damage or contamination — cracked digitizer, liquid ingress, food/grease, dust, disinfectant wipe damage on clinical touchscreens.
7. Host-side USB/hub failure rather than a peripheral failure.
8. Kiosk/embedded app crashed behind a frozen-looking screen; the hardware is fine.
9. RAM, SSD, or motherboard failure on an older unit.

## 3. Questions To Ask User

1. What exactly is the device, and where is it (room, floor, register, line, bay, desk)?
2. Any lights, fans, sounds, or beep codes at all when you press power?
3. Is it on mains power, battery, a cart, or a dock/cradle?
4. Did it work earlier today? What changed — a move, an update, a spill, a drop, a power event?
5. Does the same problem follow the device to a different outlet, dock, or cable?
6. Does a different device work in the same spot, with the same cable and same outlet?
7. Is anything visibly damaged, cracked, swollen, hot, or smelling burnt?
8. Is this blocking patient care, a production line, checkout, or a trading desk right now?

## 4. Triage: Is This Actually Hardware?

Confirm before spending time on hardware steps.

- If the device powers on and the OS is up but one app is stuck, it is an application issue, not hardware.
- If the device is up but can't reach anything, it is likely network — check for a wired/wireless issue first.
- If the device prompts for credentials and rejects them, it is an account issue.
- If the device is dark, dead, hot, physically damaged, or a peripheral is not enumerating, stay in this article.

## 5. Troubleshooting Steps

**A. Prove power (do this first, always).**
1. Test the outlet with a known-working device or a lamp. On carts, check the cart battery gauge; on desks, check the UPS/PDU for a tripped breaker or an alarm.
2. Swap in a known-good power brick and cable of the correct wattage. Underrated chargers make a device look dead or make it charge only while off.
3. For battery devices: plug in and wait 15 minutes before retrying. Deeply discharged batteries will not respond instantly.

**B. Force a hard reset.**
1. Hold the power button 15–30 seconds with power disconnected, then reconnect and power on. This drains residual charge and clears many "dead" states.
2. Laptops with removable batteries: remove battery + AC, hold power 30 seconds, reassemble.
3. Kiosks, panel PCs, HMIs, POS terminals, and encoders: use the documented hard-reset sequence or pull the power feed for 30 seconds.

**C. Prove the display path.**
1. Connect a known-good external monitor with a known-good cable. Video on the external means the panel or its cable is the fault.
2. Try a different port on the host (HDMI vs DisplayPort vs USB-C). Try the port directly on the machine, bypassing the dock.
3. Confirm the monitor's input source is set to the port actually in use.

**D. Prove the dock or cradle.**
1. Plug the device in directly, bypassing the dock. If everything works direct, the dock is the fault.
2. Power-cycle the dock: unplug its power for 30 seconds, then reconnect.
3. Swap in a known-good dock. Docks fail far more often than the devices attached to them.

**E. Prove the peripheral.**
1. Move the peripheral to a different port on the same host, then to a different host entirely.
2. Swap the cable — many USB-C cables carry power only and no data.
3. Re-pair or re-cradle wireless scanners and readers; confirm the base station has power.
4. For readers (smart card / CAC / PIV / proximity / RFID / fingerprint), check for a stuck, dirty, or physically damaged slot before touching software.

**F. Check thermal and physical condition.**
1. Clear vents and fans of dust, lint, flour, grease, or packaging debris.
2. Move the device out of direct heat, sun, steam, or an enclosed cabinet.
3. Inspect for a swollen battery, cracked glass, liquid ingress, or bent connector pins. Any of these stop L1 immediately — go to escalation.

## 6. Resolution Steps

**Device is dead with no lights:** confirmed-good power path plus a hard reset resolves most cases. If it stays dark after both, the unit needs bench service.

**Device powers on, screen black:** reseat the video cable, test an external display, and force the display-switch shortcut (Win+P on Windows). If external works and internal doesn't, the panel or its ribbon is the fault — bench service.

**Touchscreen unresponsive:** reboot first. If touch is still dead, uninstall the touch/HID device in Device Manager and scan for hardware changes. Clean the surface and bezel — clinical disinfectant residue and kitchen grease both cause dead zones. If touch is offset rather than dead, run the touch calibration utility.

**Peripheral not detected:** uninstall the device entry in Device Manager (do not delete the driver), then scan for hardware changes. Reinstall the OEM driver rather than a generic one. Reboot the host to reset the USB controller.

**Battery won't charge / won't hold charge:** confirm with a known-good charger. If the device runs on AC but shows 0% or drops instantly off AC, the battery is consumed — replace it. Do not keep a swollen battery in service.

**Overheating and shutting down:** clean the intake and exhaust, confirm the fan spins on boot, verify the device is inside its rated ambient temperature, and check whether an application is pinning the CPU. If it thermal-shuts-down when clean and idle, escalate.

**Kiosk / terminal / display frozen:** restart the kiosk application or its service before rebooting the whole unit. If it freezes again within the shift, capture the timestamp and escalate the application, not the hardware.

## 7. Verification Steps

- Device boots to the normal login or kiosk screen unassisted.
- Display, touch, and all attached peripherals work through one full normal workflow (scan, print, charge, read a badge, open the drawer, encode a key).
- Battery charges on its normal dock or cart and holds charge through a full shift.
- Device stays up through 15 minutes of real use without freezing, dropping out, or thermal throttling.
- User confirms in their own words that the device is working.

## 8. Escalation Trigger

Escalate to **L2 / field service** immediately when:

- The device stays dead after a proven-good outlet, proven-good power supply, and a hard reset.
- There is visible damage: cracked glass, swollen battery, liquid ingress, bent pins, burning smell, scorch marks.
- The unit thermal-shuts-down when clean and idle.
- The same unit has failed more than twice in 30 days — treat it as a replacement candidate, not a repeat repair.
- The device is safety-, care-, revenue-, or production-critical and is still down: clinical carts and monitors, POS and self-checkout, plant-floor terminals and scanners, trading turrets, government identity readers, front-desk key encoders.

Include with the escalation: device type, asset tag / serial, exact location, symptom, what was already tested (outlet, charger, cable, dock, external monitor, alternate host), any beep codes or error text, and business impact.

## 9. Prevention Tips

- Keep one known-good charger, one known-good data cable, and one spare dock per floor or department as a swap kit. Most "dead device" calls are resolved by a swap in under two minutes.
- Replace fleet batteries on a 24–36 month schedule instead of waiting for failures.
- Clean vents and touchscreens on a scheduled cadence in dusty, greasy, or high-traffic environments.
- Label carts, cradles, and docks so users can report the exact unit.
- Keep spares of high-failure peripherals in stock: scanners, card readers, receipt/label printers, handhelds.
- Put critical terminals on a UPS so power events don't corrupt them.

## 10. User-Friendly Explanation

"Almost every dead-device call comes down to one of four things: power, cable, battery, or the dock. We'll rule them out in that order, and each one takes about a minute. If the device is still dark after we've proven the outlet, the charger, and a hard reset, it's a hardware fault and we'll get you a working unit rather than keep you waiting. If this is stopping patient care, checkout, or the line, tell me now and I'll escalate it while we're still testing."

## 11. Internal Technician Notes

- Windows: `Get-PnpDevice -Status Error` enumerates failed devices quickly; `Get-CimInstance Win32_Battery` reports battery health on fleet laptops and carts.
- Beep/LED codes are OEM-specific — check the vendor table before assuming a motherboard fault.
- Docks: firmware mismatch between dock and host is a top cause of "no video through the dock." Update dock firmware before condemning hardware.
- Charge-only USB-C cables are the single most common false hardware failure. Keep labeled data cables in every swap kit.
- Clinical carts: check the cart battery and the inverter as separate items from the PC itself.
- Plant floor / warehouse: RF handhelds that die on the charger usually have contaminated charging contacts, not a bad battery.
- POS: a cash drawer that won't open is usually the printer's drawer-kick port, not the drawer.
- Card readers (CAC/PIV/smart card): a reader that enumerates but never reads is more often a middleware/certificate problem than hardware — confirm the reader shows up in Device Manager first.
- Record asset tag and serial on every hardware ticket; repeat-failure units should be retired, not repaired a third time.

## 12. Related KB Articles

- l1-usb-001 — USB device not recognized
- l1-printer-001 — Printer not printing
- l1-bluetooth-001 — Bluetooth pairing failed
- l1-newdevice-001 — New device first boot setup

## 13. Keywords / Search Tags

hardware, won't turn on, wont power on, won't boot, dead device, frozen, unresponsive, black screen, no display, no signal, workstation on wheels, wow cart, computer on wheels, cart pc, pos terminal, point of sale, cash drawer, self checkout, kiosk, touchscreen not responding, panel pc, hmi, rugged tablet, handheld, rf terminal, scanner gun, barcode scanner, label printer, thermal printer, docking station, dock not working, second monitor not detected, monitor blank, screen flickering, battery dead, not charging, overheating, thermal shutdown, smart card reader, cac reader, piv reader, badge reader, proximity reader, rfid reader, fingerprint reader, trading turret, squawk box, ticker screen, video wall, time clock kiosk, key encoder, kitchen display, weigh scale, forklift mounted computer, vital signs monitor, ecg workstation
