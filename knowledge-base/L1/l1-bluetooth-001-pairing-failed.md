---
id: l1-bluetooth-001
title: "Bluetooth: device won't pair, keeps disconnecting, or audio cuts out"
category: bluetooth
support_level: L1
severity: medium
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - bluetooth
  - pair
  - won't pair
  - keeps disconnecting
  - airpods
  - bose
  - sony
  - jabra
  - mouse keyboard
  - audio cuts out
  - latency
  - bluetooth missing
related_articles:
  - l1-teams-001
  - l1-windows-005
escalation_trigger: "Bluetooth radio not detected in Device Manager / System Information at all, or hardware antenna damaged"
last_updated: 2026-05-08
version: 1.0
---

# Bluetooth pairing / connection problems

## 1. Symptoms
- Device shows up in pairing list but pairing fails halfway through.
- Connects, then drops within seconds or minutes.
- Headphones connect for music but not for calls (or vice-versa).
- Audio is choppy, robotic, or noticeably delayed (lip-sync off).
- Bluetooth toggle missing entirely from Settings.

## 2. Likely Causes
1. Battery on the accessory is too low to maintain a stable link.
2. The device is paired to two hosts simultaneously and the other host is fighting.
3. Driver crashed; the radio needs a restart.
4. 2.4 GHz Wi-Fi or USB 3.0 interference (USB 3 ports radiate noise).
5. For headsets: Windows is using the wrong "audio profile" (A2DP for music vs. Hands-Free for calls).
6. Device firmware needs an update.

## 3. Questions To Ask User
1. What device — exact brand and model?
2. Pairing for the first time, or it used to work?
3. Has the device been used with another phone/PC recently?
4. Is the issue voice/calls, music, or both?
5. How close is the device to the PC right now?

## 4. Troubleshooting Steps
1. **Charge the accessory** to at least 30%. Low battery causes flaky pairing.
2. **Forget + re-pair.** Settings → Bluetooth → click the device → Remove. Then pair fresh.
3. **Move the accessory off other hosts.** Most modern earbuds connect to the last 2 hosts; turn off Bluetooth on your phone temporarily and try again.
4. **Toggle the radio.** Turn Bluetooth off, wait 10 seconds, on again.
5. **Move closer** — within 3 feet, line of sight, away from microwaves and USB 3 hubs.
6. **Reboot the PC.** Cleans up a stuck radio service.

## 5. Resolution Steps
**If pairing keeps failing on Windows:**
1. Settings → Bluetooth & devices → Devices → click the device → Remove.
2. Put the accessory in pairing mode (usually hold the action button for 5–7 seconds until the LED blinks fast).
3. Add device → Bluetooth → wait for it to appear.
4. If it still won't appear: Device Manager → Bluetooth → right-click your radio → Disable, wait 10s, Enable.

**If headset connects but Teams/Zoom can't hear:**
1. Sound settings → Input → pick the Hands-Free profile of the headset (different from the Stereo / A2DP entry).
2. In Teams: Settings → Devices → Speaker AND Microphone → set both to the Hands-Free entry.
3. Audio quality drops to mono on calls — that's expected; Bluetooth can't run hi-fi music and a mic at the same time.

**If audio cuts out periodically:**
1. Move USB 3 / USB-C dongles 2 feet away from the Bluetooth dongle (USB 3 emits 2.4 GHz noise).
2. Switch your Wi-Fi to 5 GHz if you're on 2.4 GHz.
3. Update the Bluetooth driver from the OEM site (not Windows Update — OEMs often ship newer firmware).

**On macOS:**
1. Bluetooth menu → ⌥+click for advanced reset → Reset the Bluetooth module.
2. If that fails: System Settings → Bluetooth → forget the device → re-pair.

## 6. Verification Steps
- Pair holds for a 10-minute call without dropping.
- Music sounds clean (no robot artifacts).
- LED on accessory shows the steady "connected" state.
- Stays connected when you move 10 feet away with line of sight.

## 7. Escalation Trigger
- Bluetooth radio missing from Device Manager / System Information.
- Code 43 / 28 on the radio after driver reinstall.
- Pairing fails for every Bluetooth device, including a known-good test accessory.
- → Escalate to **L2** for hardware diagnosis or driver package from OEM.

## 8. Prevention Tips
- Charge accessories before important calls.
- Don't pair the same earbuds to phone + PC and expect both to work seamlessly — pick one host per session.
- Keep accessories within 10 feet, line of sight when possible.
- Update Bluetooth drivers from OEM tools quarterly.

## 9. User-Friendly Explanation
"Bluetooth is finicky — most issues come down to one of three things: low battery on the accessory, signal interference from other USB devices or Wi-Fi, or the accessory still being connected to your phone. We'll forget the device, re-pair fresh, and switch you to the right audio mode. Should take about three minutes. If pairing works but you can't be heard on calls, that's almost always the wrong audio profile and we'll fix that in two clicks."

## 10. Internal Technician Notes
- Windows BT stack lives at `services.msc → Bluetooth Support Service` — restart it if pairing UI hangs.
- HFP vs A2DP: Windows 11 22H2+ supports LE Audio which mostly fixes the music-vs-call profile dance, but you need both ends compatible.
- USB 3 radiation: Intel whitepaper documents this; physical separation is the only fix.
- For managed devices, check Intune for any Bluetooth restriction CSP (e.g., `Bluetooth/AllowAdvertising`, `Bluetooth/AllowDiscoverableMode`).
- macOS Bluetooth log: `log show --predicate 'subsystem == "com.apple.bluetooth"' --last 10m`.

## 11. Related KB Articles
- l1-teams-001 — Teams audio + mic
- l1-windows-005 — No sound on Windows

## 12. Keywords / Search Tags
bluetooth, pair, won't pair, keeps disconnecting, airpods, bose, sony, jabra, mouse keyboard, audio cuts out, latency, bluetooth missing, hands-free profile, a2dp, hfp
