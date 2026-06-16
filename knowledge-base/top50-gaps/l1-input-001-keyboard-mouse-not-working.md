---
id: l1-input-001
title: "Keyboard or mouse not working — wired, wireless, or specific keys"
category: hardware
support_level: L1
severity: high
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: []
keywords:
  - keyboard not working
  - mouse not working
  - bluetooth keyboard
  - bluetooth mouse
  - usb keyboard
  - dongle
  - logitech unifying
  - mx keys
  - mx master
  - magic keyboard
  - magic mouse
  - dead keys
  - sticky keys
  - mouse lag
  - cursor jumping
related_articles:
  - l1-bluetooth-001-pairing-failed
  - l1-usb-001-device-not-recognized
escalation_trigger: "Multiple keyboards / mice fail on this laptop AND wired+wireless both fail → laptop USB controller or Bluetooth radio dead. Escalate to L2 / hardware service."
last_invoked: 2026-05-12
last_updated: 2026-05-12
version: 1.0
---

# Keyboard or mouse not working

## 1. Symptoms
- Keyboard stops typing.
- Mouse cursor frozen / disappeared.
- Specific keys not working (e.g., spacebar, Enter).
- Bluetooth keyboard / mouse disconnects randomly.
- Mouse jumps or lags.
- Laptop's built-in keyboard stops but external works (or vice versa).

## 2. Step-by-Step Triage

### Step 1 — Power / Battery
- **Wireless / Bluetooth:** check the device's power switch is ON. Replace batteries (or charge if rechargeable). Most "dead" wireless keyboards just have flat batteries.
- **Wired:** confirm USB cable is fully seated.

### Step 2 — Try a different USB port (wired)
- Front vs back USB ports, USB-A vs USB-C — try them all.
- If using a USB hub or dock, try plugging directly into the laptop.

### Step 3 — Reconnect Bluetooth pairing
**Windows:**
1. Settings → Bluetooth & devices.
2. Find your keyboard / mouse → click ⋯ menu → **Remove device**.
3. Power-cycle the device (off/on).
4. Click **Add device** → **Bluetooth** → put the device in pairing mode (consult its manual — often hold a button until LED flashes) → select it.

**macOS:** System Settings → Bluetooth → click the X next to the device → re-pair.

### Step 4 — Update or reinstall drivers (Windows)
1. Press **Win + X** → **Device Manager**.
2. Expand **Keyboards** OR **Mice and other pointing devices**.
3. Right-click your device → **Uninstall device**.
4. Reboot. Windows re-detects + reinstalls fresh driver.

### Step 5 — Battery in wireless devices
- For Logitech MX Master / MX Keys: plug in via USB-C to charge. They work while charging.
- For Magic Mouse / Magic Keyboard (Apple): Lightning charge cable. Magic Mouse 1 has annoying bottom-mounted port.
- Replace AA / AAA batteries in non-rechargeable wireless keyboards.

### Step 6 — Specific key not working (mechanical fix)
- **Crumbs / dust under key.** Use compressed air. Hold can upright, short blasts.
- **Sticky from spill?** Power off → flip keyboard upside down → let dry 48 hours → may or may not recover. Spills often kill membranes permanently.
- **Laptop key popped off?** Look up the model's keycap re-attachment video (different mechanisms — butterfly / scissor / mechanical). Don't force it — easy to break the latch.

### Step 7 — Cursor jumping / mouse lag
- **Bluetooth interference:** USB 3.0 ports near a Bluetooth receiver interfere with 2.4 GHz. Move the receiver / dongle to a different port.
- **Surface:** glass tables and very dark surfaces confuse optical sensors. Use a mousepad.
- **Wireless dongle far from device:** plug the dongle into a USB extension cable closer to the mouse (within 30 cm).
- **Old driver:** update from manufacturer (Logitech Options+, Razer Synapse, Apple software update).

### Step 8 — All inputs dead simultaneously (laptop)
- Hard reset: hold power button 10 seconds → power back on → log in.
- For Mac (Apple Silicon): just shut down and start again. For Intel Mac: SMC reset (Apple Menu → Shut Down → after off, press and hold Shift + Control + Option + Power for 10 seconds → release → power on normally).

### Step 9 — Built-in laptop keyboard dead
- Check filter keys / sticky keys: Settings → Accessibility → Keyboard → toggle these OFF.
- BIOS/UEFI test: reboot, press F2 / Del / F10 (depending on maker) before Windows loads → keyboard works in BIOS? If yes, it's a Windows / driver issue. If no, hardware.

## 3. Verification Steps
- Open Notepad / TextEdit → all keys type correctly.
- Mouse moves smoothly across both monitors.
- Bluetooth devices show "Connected" status in settings.

## 4. When to Call IT
- Multiple keyboards/mice fail on the same laptop → USB controller or Bluetooth radio likely failed.
- BIOS keyboard test fails → motherboard hardware. Service ticket.
- Laptop keyboard with spilled liquid — replace, don't keep nursing.
- New laptop, never worked → may need vendor-specific keyboard driver from maker's support page.

## 5. Prevention Tips
- **Charge wireless devices weekly** instead of waiting for them to die.
- **Keep a wired USB keyboard / mouse in the desk drawer** as a backup.
- **Don't eat over the keyboard.** Crumbs kill keys.
- **Compressed air every 6 months** to blast dust out.
- **Update mouse / keyboard software quarterly** (Logitech Options+, Razer, Corsair).

## 6. User-Friendly Explanation
Most input problems are: dead batteries (replace or charge), bad USB connection (try another port), or stuck Bluetooth pairing (remove and re-pair). If a specific key isn't working, compressed air usually fixes it. If your laptop's built-in keyboard suddenly dies and an external one works, restart and check BIOS. If nothing works at all, hold the power button 10 seconds and restart.

## 7. Internal Technician Notes
- Logitech Unifying Receiver: one dongle pairs up to 6 devices. Use Logitech Connection Utility / Options+ to re-pair.
- Bolt receiver (newer Logitech): replaces Unifying. Better security (Bluetooth Low Energy Secure Connections).
- USB 3.0 + 2.4 GHz interference: documented since 2013. Intel whitepaper recommends >10 cm separation between USB 3.0 port and 2.4 GHz receiver.
- Magic Mouse multi-touch surface: requires macOS Bluetooth daemon healthy. Restart bluetoothd: `sudo killall -9 bluetoothd`.
- For sticky keys / repeat issue: registry keys at `HKCU\Control Panel\Accessibility\StickyKeys` (Win); Universal Access prefs (Mac).
- Apple Silicon Mac SMC reset doesn't exist — just shutdown/startup.

## 8. Related KB Articles
- `l1-bluetooth-001` — Bluetooth pairing failed
- `l1-usb-001` — USB device not recognized

## 9. Keywords / Search Tags
keyboard not working, mouse not working, bluetooth keyboard, bluetooth mouse, usb keyboard, dongle, logitech unifying, mx keys, mx master, magic keyboard, magic mouse, dead keys, sticky keys, mouse lag, cursor jumping, smc reset
