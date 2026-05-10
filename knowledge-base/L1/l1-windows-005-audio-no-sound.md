---
id: l1-windows-005
title: "Windows: no sound at all from the computer"
category: windows
support_level: L1
severity: medium
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11"]
prerequisites: []
keywords:
  - no sound
  - no audio
  - speakers not working
  - audio missing
  - no audio output device
  - red x speaker icon
  - audio service not running
related_articles:
  - l1-teams-001
  - l2-drivers-003
escalation_trigger: "Audio device not detected after driver reinstall, or hardware failure suspected"
last_updated: 2026-05-07
version: 1.0
---

# Windows: no sound at all

## 1. Symptoms
- Speaker icon in taskbar shows red X.
- "No audio output device is installed".
- Volume slider works but no sound.
- Sound only on headphones, not speakers (or vice versa).
- Sound suddenly cut out mid-use.

## 2. Likely Causes
1. Wrong default playback device.
2. Volume muted or extremely low.
3. Headphone jack disconnected (sometimes detection sticks).
4. Audio driver glitch.
5. Audio service not running.
6. Bluetooth profile issue.
7. Recent Windows Update broke audio (rare).

## 3. Questions To Ask User
1. Have you ever heard sound from this PC?
2. Are you using built-in speakers, USB, or Bluetooth?
3. Is volume in taskbar non-zero and not muted?
4. Are there headphones plugged in?
5. Did this start after an update?

## 4. Troubleshooting Steps
1. Click speaker icon → confirm not muted.
2. Click speaker icon → check device dropdown — pick correct output.
3. Right-click speaker → Sound settings → scroll Output → confirm device.
4. Test sound: Settings → System → Sound → Test (button next to device).
5. Unplug then replug headphones (refreshes detection).
6. Run audio troubleshooter: Settings → System → Sound → Troubleshoot.

## 5. Resolution Steps
**Wrong default:**
- Settings → Sound → Output → set correct device.

**Service not running:**
1. Win+R → `services.msc`.
2. Find "Windows Audio" and "Windows Audio Endpoint Builder" → both should be Running, Automatic.
3. Right-click → Restart.

**Driver glitch:**
1. Device Manager → Sound, video and game controllers.
2. Right-click your audio device → Uninstall device → check "Delete the driver software" → OK.
3. Reboot. Windows reinstalls automatically.
4. If issue persists, install OEM driver from manufacturer's support page.

**Headphone jack stuck "plugged in":**
- Sometimes after physical unplug, OS still believes headphones are present. Plug + unplug 2–3 times, or restart.

**Bluetooth audio:**
- Settings → Bluetooth & devices → device → make sure "Connected voice/audio" is on.
- Re-pair if needed.

**After Windows Update broke audio:**
- Settings → Windows Update → Update history → uninstall most recent update.
- Or roll back driver: Device Manager → device → Properties → Driver → Roll Back Driver.

## 6. Verification Steps
- "Test" button plays the chime.
- Music in browser plays clearly.
- Headphone test (plug + unplug) routes correctly.
- 30 minutes of mixed use without dropout.

## 7. Escalation Trigger
- Audio device not visible at all in Device Manager after driver reinstall.
- Hardware failure suspected (no jack works, board-level).
- Bluetooth audio works only on Hands-free, not Stereo (firmware issue).
- → Escalate to **L2** with: device make/model, Device Manager screenshot, OS build, recent update history.

## 8. Prevention Tips
- Don't unplug headphones mid-volume — pop sounds can blow drivers (rare, but real).
- Keep audio driver current via OEM utility.
- Don't disable "Audio Endpoint Builder" / "Windows Audio" services.
- Avoid third-party audio "enhancers" — they often break standard playback.
- For Bluetooth, charge headset regularly; low battery = poor profile negotiation.

## 9. User-Friendly Explanation
"Windows is sending sound somewhere it shouldn't, or the audio bit is asleep. We'll point sound at the right speaker, restart the audio piece, and re-detect your headphones if you're using them. Most no-sound issues fix in two minutes."

## 10. Internal Technician Notes
- Audio service dependencies: `Windows Audio` depends on `Multimedia Class Scheduler`, `Windows Audio Endpoint Builder`, `RPC`. Issues with any cascade.
- Realtek HD Audio Manager often shipped with OEMs — its enhancements can override defaults; ensure correct playback device is selected in BOTH OS sound and Realtek manager.
- For HDMI audio not switching when monitor connects, check `mmsys.cpl → Playback → Set Default → Default Communications Device` (sometimes Teams hijacks default).
- For "no audio output device" with no devices visible: `Get-PnpDevice -Class Media -Status OK` to confirm WMI sees it; if not, real driver/hardware issue.
- DirectX audio issues: `dxdiag` → Sound tab → check for "no problems found".

## 11. Related KB Articles
- l1-teams-001 — Teams audio not working (different scope)
- l2-drivers-003 — Driver rollback strategies

## 12. Keywords / Search Tags
no sound, no audio, speakers not working, audio missing, no audio output device, red x, audio service
