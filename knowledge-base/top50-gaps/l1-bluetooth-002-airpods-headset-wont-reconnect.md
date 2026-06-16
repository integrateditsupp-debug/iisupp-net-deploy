---
id: l1-bluetooth-002
title: "AirPods / Bluetooth headset paired but won't connect — fix the handshake"
category: bluetooth
support_level: L1
severity: low
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["Headset has battery", "Headset is already paired to the device"]
keywords:
  - airpods wont connect
  - bluetooth paired not connected
  - headphones connected but no sound
  - bluetooth keeps disconnecting
  - airpods only one side working
  - bluetooth latency
  - cant connect airpods to pc
  - bluetooth handover not working
  - re-pair bluetooth
tags:
  - bluetooth
  - airpods
  - audio
  - top-50
related: [l1-bluetooth-001-pairing-failed, l1-meeting-audio-001-wrong-device, l1-windows-005-audio-no-sound]
---

# AirPods / Bluetooth headset paired but won't connect

## Symptoms

- AirPods in your ear, paired to MacBook + iPhone + iPad, but only randomly connect
- Bluetooth headset shows "Connected" but no audio
- Only the left or right earbud works
- Disconnect mid-meeting and won't reconnect
- After unpairing one device, the others stop seeing the headset
- Constant latency / sync issues on calls

The fix depends on whether you want it on **Apple ecosystem** (AirPods + iPhone/Mac auto-switching) or **mixed** (AirPods + Windows PC) or **generic Bluetooth + anything**.

## Fast path — reset the headset

This fixes 70% of "paired but won't connect" issues.

### AirPods (1st-4th gen, Pro, Max)
1. Put both AirPods in the case (don't close the lid).
2. Hold the **setup button** (small button on the back of the case) for 15 seconds.
3. The status light flashes amber, then white = factory reset.
4. Remove from every device's Bluetooth list (Settings → Bluetooth → "i" icon next to AirPods → Forget This Device).
5. Open the case next to your iPhone — the iCloud-linked pairing flow appears.
6. Pair fresh. The pairing propagates to your other Apple devices via iCloud.

### Generic Bluetooth headphones (Sony, Bose, Sennheiser, Beats, Jabra)
- Each has its own reset procedure. Common pattern:
  - Power off the headset.
  - Hold power button for 10-30 seconds while off.
  - LED flashes blue + red, indicating pairing mode and reset.
- Check the manufacturer's manual for your specific model.

### Then re-pair to each device

Pairing memory after reset is wiped. Set up fresh on each device.

## Apple ecosystem — AirPods auto-switching not working

AirPods are supposed to follow you between iPhone, iPad, Mac. When it breaks:

### Requirements
- All devices signed into same iCloud account.
- All devices on recent OS (iOS 14+ / macOS Big Sur+).
- "Connect to This Mac" / "Connect to This iPhone" set to **Automatically** for the device you want as priority.

### Fix
1. On Mac: System Settings → Bluetooth → click "i" next to AirPods → "Connect to This Mac" → **When Last Connected to This Mac**.
2. On iPhone: Settings → Bluetooth → "i" next to AirPods → "Connect to This iPhone" → **When Last Connected to This iPhone**.
3. Or set to **Automatically** for fully passive switching (less reliable).

### Force switch
- Click the speaker / volume icon in the Mac menu bar → click AirPods → "Connect."

### "Sometimes only one AirPod plays"
- Battery imbalance — one side is way lower than the other.
- Put both in case, charge for 15 minutes, retry.
- If persists after charging, that AirPod may be dying. Genius Bar can replace single AirPods.

## Windows PC — Bluetooth headset issues

Windows has historically poor Bluetooth audio. Common issues:

### "Connected" but no audio
1. Right-click speaker icon in taskbar → Sound settings.
2. Output device dropdown — pick your headset.
3. If multiple entries for the same headset (Hands-Free vs Stereo), pick **Hands-Free** for calls/mic, **Stereo** for music-only.
4. Inside meeting apps: explicitly set Audio device to the same entry.

### Disconnects mid-call
Windows Bluetooth stack often drops headset on apps switching profiles. Workarounds:
1. Update Bluetooth driver via Device Manager (Windows key + X → Device Manager → Bluetooth → Right-click adapter → Update driver).
2. Disable "Allow the computer to turn off this device to save power" (Properties → Power Management).
3. If headset has a USB dongle option (Logitech, Jabra Engage), use that instead of native Bluetooth — way more reliable on Windows.

### Audio is choppy / robotic / laggy
- Windows Bluetooth bandwidth issue. Mostly fixed in Windows 11 22H2+.
- Move closer to PC. 2.4GHz Wi-Fi router nearby can interfere.
- Try a USB Bluetooth 5.0/5.2 dongle if your PC's built-in Bluetooth is old.

## Android — headphones won't reconnect

1. Settings → Connected devices → tap gear next to headset → **Forget**.
2. Power-cycle headset + put in pairing mode.
3. Settings → Pair new device.

If still flaky:
- Disable + re-enable Bluetooth in Settings.
- Restart phone.
- Some Android OEMs (Samsung) have aggressive battery saving that kills Bluetooth — Settings → Battery → Bluetooth → don't restrict.

## Edge cases

### "AirPods connect to my work Mac, not my personal Mac, when I want personal"
- Both Macs see them as available. AirPods are responding to whichever Mac sends the connect request first.
- On the Mac you DON'T want it on: System Settings → Bluetooth → "i" next to AirPods → "Connect to This Mac" → **Never** (option exists on some versions).
- Or simply put AirPods in case + close lid for 5 seconds → reopen near the Mac you want.

### "AirPods Pro 2 noise canceling stopped working"
Different issue — usually wax on the mesh. Clean with dry toothbrush. Or Settings → Bluetooth → AirPods → toggle noise canceling off + on.

### "Headset works for music but mic doesn't work in Teams"
- See l1-meeting-audio-001-wrong-device. It's a profile-selection issue inside the meeting app.

### "Two headsets paired, neither connects"
- Forget both, repair one at a time. Bluetooth pairing memory can get confused with too many devices.

## When to escalate

| Situation | Path |
|---|---|
| Reset + repair multiple times, still fails | L2 — possibly hardware failure on adapter or headset |
| Only happens on corporate-managed device | L2 — possibly endpoint security blocking certain BT profiles |
| Bluetooth disappears from device entirely | L2 — driver / firmware reinstall |
| Latest macOS update broke pairing | L2 — known macOS bugs, may need version-specific fix |

## Prevention

- Don't pair the same headset to 5+ devices. Pick 2-3, forget the rest.
- Keep firmware up to date — Sony, Bose, Jabra all have companion apps with firmware updates.
- For AirPods: keep them in the case when not in use (case charges them; case also resets handshakes).
- For Windows + Bluetooth: invest $15 in a USB Bluetooth 5.2 dongle if your PC is older than 2021.

## What ARIA can help with

ARIA can identify whether your issue is profile (Hands-Free vs Stereo), pairing memory (stale), hardware (one earbud), or OS-side (Windows driver) from your symptoms. ARIA cannot physically press the reset button on your headset.
