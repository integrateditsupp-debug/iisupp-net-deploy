---
id: l1-display-001
title: "External monitor not detected — laptop won't show video on second screen"
category: hardware
support_level: L1
severity: medium
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: []
keywords:
  - external monitor
  - second monitor
  - no signal
  - hdmi not working
  - displayport not working
  - usb-c monitor
  - usb c display
  - thunderbolt display
  - monitor blank
  - extend display
  - duplicate display
  - docking station
related_articles:
  - l1-windows-006-app-wont-open
  - l1-usb-001-device-not-recognized
  - l1-windows-be-001-windows-11-25h1-copilot-plus
escalation_trigger: "Monitor works on another laptop but not yours, AND laptop's HDMI / USB-C port doesn't work with any monitor → port hardware failure, requires service ticket / replacement."
last_updated: 2026-05-12
version: 1.0
---

# External monitor not detected — laptop won't show video on second screen

## 1. Symptoms
- Connected an HDMI / DisplayPort / USB-C cable from laptop to monitor.
- Monitor shows "No Signal" or stays black.
- Laptop screen still works but won't extend to second display.

## 2. Step-by-Step Triage

### Step 1 — The dumb stuff (works 40% of the time)
1. **Monitor power on?** Look at the monitor's own power indicator light.
2. **Right input selected on monitor?** Press the monitor's **Source** / **Input** button. Cycle through HDMI 1, HDMI 2, DisplayPort, USB-C until you find the active one.
3. **Cable both ends fully seated.** Unplug, plug back in firmly until click.

### Step 2 — Try a different cable
- HDMI cables fail more often than people think — especially long ones, or ones that have been bent.
- Borrow a known-good cable. Replace the monitor cable.

### Step 3 — Try a different port on the laptop
- Most laptops have multiple HDMI / USB-C / Thunderbolt ports. Try a different one.
- If ONLY one port is failing → that port is broken. Use a different port permanently and ignore.

### Step 4 — Force display detection
**Windows 11:**
1. Right-click on desktop → **Display settings**.
2. Scroll down → click **Detect** (or **Detect other displays**).
3. Wait 5 seconds.

**Windows 10:** same path.

**macOS:**
1. **System Settings** → **Displays**.
2. Hold **Option** key — a **Detect Displays** button appears at the bottom right.
3. Click it.

### Step 5 — Project / Duplicate / Extend
Sometimes the laptop detects the monitor but routes nothing to it.

**Win:** Press **Win + P** → choose **Extend** (typical) or **Duplicate** to test.

**Mac:** System Settings → Displays → click the second monitor representation → set "Use As" to "Extended display" not "Mirror."

### Step 6 — Reboot
Yes. After all the above. Reboot. Then try again. Resolves stuck driver state ~25% of the time.

### Step 7 — USB-C / Thunderbolt specific
If using USB-C:
- Confirm your laptop's USB-C port supports **DisplayPort Alternate Mode (DP Alt Mode)**. Cheaper USB-C laptops (e.g., budget Chromebooks) only support data + power, not display.
- Check cable rating. Standard USB-C cables that came with phone chargers OFTEN don't carry video. You need a USB-C / Thunderbolt cable rated for video — usually labeled "DisplayPort Alt Mode supported" or "Thunderbolt 3/4."
- Try a USB-C to HDMI / DisplayPort adapter as a test.

### Step 8 — Docking station triage
If you're going through a USB-C dock or Thunderbolt dock:
- Dock power supply plugged in? Many docks won't drive external monitors on bus power alone.
- Restart the dock (unplug USB-C from laptop, wait 10 seconds, replug).
- Try the monitor cable plugged DIRECTLY to laptop, bypassing the dock. If direct works → dock is the issue (try firmware update, or warranty replace).

### Step 9 — Driver / firmware
**Windows:**
1. Settings → Windows Update → Optional updates → Driver updates → install GPU driver if listed.
2. OR visit your laptop maker's support page (Dell / HP / Lenovo / ASUS) → download the latest GPU driver (Intel / NVIDIA / AMD) → install → reboot.

**Mac:** macOS Software Update; no separate display driver.

### Step 10 — Monitor firmware
Some monitors (Dell, LG, Samsung high-end) have firmware. Visit manufacturer support, check for updates. Usually requires USB stick to update.

## 3. Verification Steps
- Monitor shows the Windows desktop or Mac wallpaper.
- Display settings shows TWO displays.
- You can drag a window from laptop screen to monitor.

## 4. When to Call IT
- Multiple monitors work fine on YOUR laptop but yours specifically — usually display configuration; IT to check.
- Monitor works on ANOTHER laptop but yours doesn't, AND swap port/cable didn't fix → laptop hardware (replace port or laptop).
- Office docking station: known docks (Dell WD22, HP USB-C Dock G5, etc.) sometimes need a firmware push from IT.

## 5. Prevention Tips
- **Buy quality cables.** Cheap HDMI cables from no-name brands fail. Stick to Belkin, Anker, AmazonBasics, StarTech.
- **Match the standard.** 4K@60Hz needs HDMI 2.0 or higher; 8K needs HDMI 2.1. Buying a Wi-Fi-7 router and pairing with a Wi-Fi-5 laptop wastes the upgrade — same applies to displays.
- **Label cables** at both ends if you have multiple monitors.

## 6. User-Friendly Explanation
First check the monitor's input button to make sure it's set to the input you plugged into. Then try a different cable and a different port on the laptop. Windows: press Win+P to force display mode. Mac: System Settings → Displays → Detect (hold Option). If none of that works, restart the laptop. Most monitor problems are bad cables or wrong input selected — not the laptop.

## 7. Internal Technician Notes
- Windows display device pipeline: GPU driver → DXGI → DDI → monitor EDID handshake. Failure often at EDID — try another cable.
- EDID parsing failure: `Get-PnpDevice -Class Monitor | Select-Object FriendlyName, Status` (PowerShell) — Inactive status often indicates EDID issue.
- USB-C DP Alt Mode pin layout: 4 SuperSpeed pairs used as 4 DP lanes. Cable must implement it; many phone chargers don't.
- Thunderbolt 3 / 4 over USB-C: 40 Gbps, full DP 1.4 (4K@120Hz, 8K@60Hz).
- Common silly causes: monitor in standby (timer set short), HDR mode mismatch (Windows expects HDR, monitor doesn't), refresh rate mismatch.
- Dell laptop+dock combo: latest dock firmware from Dell Command | Update tool. Often resolves "missing 2nd monitor" issues.
- macOS notebook lid closed → external monitor expected to drive screen. Some macOS versions reject this if no external keyboard/mouse detected — wake by USB device.

## 8. Related KB Articles
- `l1-windows-006` — App won't open
- `l1-usb-001` — USB device not recognized
- `l1-windows-be-001` — Win 11 Copilot+ PC features (some new display tricks)

## 9. Keywords / Search Tags
external monitor, second monitor, no signal, hdmi not working, displayport not working, usb-c monitor, usb c display, thunderbolt display, monitor blank, extend display, duplicate display, docking station, dock, edid, dp alt mode
