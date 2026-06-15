---
id: l1-usb-001
title: "USB device not recognized / unknown device / 'malfunctioned'"
category: usb
support_level: L1
severity: medium
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - usb
  - usb device not recognized
  - unknown device
  - malfunctioned
  - usb-c
  - thunderbolt
  - dock
  - external drive
  - hub
  - port not working
  - code 43
related_articles:
  - l1-windows-006
  - l1-bluetooth-001
escalation_trigger: "Same device + same port fails after fresh OS install, or all USB ports fail simultaneously, or BIOS doesn't see USB devices at boot"
last_updated: 2026-05-08
version: 1.0
---

# USB device not recognized

## 1. Symptoms
- Tray notification: "USB device not recognized" or "The last USB device you connected to this computer malfunctioned."
- Device appears in File Explorer briefly, then disappears.
- External drive shows in Disk Management but with no drive letter.
- USB-C dock works on one machine, not another.
- One USB port doesn't detect anything; another port works fine.

## 2. Likely Causes
1. Underpowered port (especially older USB 2.0 on the front of a desktop).
2. Damaged or partially-inserted cable.
3. Driver in a bad state — Windows assigned a generic stub instead of the real driver.
4. Power-saving setting put the USB hub to sleep and it didn't wake.
5. USB-C cable that only carries power, not data (very common).
6. External drive needs more amperage than the port can deliver — shows up but disconnects under load.
7. USB controller froze; needs reboot.

## 3. Questions To Ask User
1. Did the device ever work on this computer?
2. Front port or back port? Hub or dock?
3. Different cable available to test with?
4. What's the device — flash drive, external drive, dock, phone, printer?
5. Any "malfunctioned" / "unknown device" pop-up text?

## 4. Troubleshooting Steps
1. **Try a different USB port.** Prefer a port directly on the laptop / desktop motherboard (back of tower), not a front port or hub.
2. **Try a different cable.** Many USB-C cables are charge-only. A known-good data cable rules cabling out.
3. **Test the device on another computer.** Confirms the device itself is alive.
4. **Reseat fully** — push until you feel/hear the click. Front USB-A ports often have a 1mm wiggle that stops contact.
5. **Reboot the PC.** Resets the USB host controller.

## 5. Resolution Steps
**If "USB device not recognized" toast keeps appearing:**
1. Device Manager → Universal Serial Bus controllers → look for entries with yellow ⚠.
2. Right-click each → Uninstall device. Don't tick "delete driver software" — just uninstall.
3. Action menu → Scan for hardware changes. Windows reinstalls them.

**If the device shows as "Unknown device" with code 43:**
1. Device Manager → right-click the unknown device → Properties → Driver tab → Uninstall device.
2. Unplug the device, wait 10s, replug.
3. If still code 43 → device or cable is failing on the host side; try another machine to confirm.

**If an external drive disappears under load:**
1. Powered USB hub fixes most underpowered-port issues. Cheap solution.
2. Self-powered (wall-plug) external drives don't have this problem — switch if available.

**Power-saving fix (Windows):**
1. Device Manager → Universal Serial Bus controllers → for each USB Root Hub: Properties → Power Management → uncheck "Allow the computer to turn off this device to save power".
2. Reboot.

**On macOS:**
1. System Information → USB → confirm the device shows up at all. If it doesn't, it's a hardware/cable issue.
2. Reset NVRAM (Intel Macs): shutdown → power on while holding ⌥+⌘+P+R until you hear the second startup chime.
3. Try a different USB-C-to-USB adapter — Apple's official ones are most reliable.

## 6. Verification Steps
- Device appears in Device Manager / System Information without warnings.
- File Explorer / Finder shows the drive letter / mount point.
- Read/write a small test file successfully.
- Device stays connected through 10 minutes of normal use.

## 7. Escalation Trigger
- All USB ports fail at the same time → motherboard or power supply issue.
- Code 43 persists after a fresh Windows install → hardware.
- BIOS/UEFI doesn't see USB devices at boot.
- → Escalate to **L2** with: device + cable + port + error code(s) + Device Manager screenshot.

## 8. Prevention Tips
- Keep one labeled "data cable" near your dock — most USB-C cables are charge-only.
- For external drives that move between machines, prefer a powered hub.
- Eject before unplugging — yanking under write can corrupt the partition table.
- Don't daisy-chain hubs; one hub max between PC and device.

## 9. User-Friendly Explanation
"USB issues come down to four things — port, cable, power, or driver. We'll rule them out in order. Try a different port first, then a different cable. If both check out, we'll reset the driver in about ten seconds. If a powered USB device drops out under load, that's almost always a port that can't push enough power, and a $15 powered hub fixes it permanently."

## 10. Internal Technician Notes
- Windows: `Get-PnpDevice -Status Error` quickly enumerates problem devices.
- Code 43 = the device reported a problem; can be hardware OR a driver that gave up.
- Code 28 = no driver; pull from OEM, not generic.
- Selective Suspend bug: `powercfg /change usb-selective-suspend-setting 0` disables the suspend that often kills external drives.
- USB-C cables: even brand-name ones lie about USB 3 / Thunderbolt support — test with `usbview.exe` to see negotiated speed.
- For Intune fleets, restrict USB storage with the Defender device control policies if data leakage is a concern.

## 11. Related KB Articles
- l1-windows-006 — App won't open
- l1-bluetooth-001 — Bluetooth pairing
- l2-drivers-001 — Driver fleet rollback

## 12. Keywords / Search Tags
usb, usb device not recognized, unknown device, malfunctioned, usb-c, thunderbolt, dock, external drive, hub, port not working, code 43, code 28, charge only cable
