---
id: l1-teams-001
title: "Microsoft Teams: no audio in meetings (mic or speaker not working)"
category: teams
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - teams
  - no audio
  - can't hear
  - mic not working
  - microphone
  - speaker
  - other people can't hear me
  - audio device not detected
related_articles:
  - l1-teams-002
  - l1-windows-005
escalation_trigger: "USB audio device not detected by Windows at all (driver/hardware), or all users on tenant report similar"
last_updated: 2026-05-07
version: 1.0
---

# Teams: no audio in meetings

## 1. Symptoms
- "Other people can't hear me" — mic not picking up.
- "I can't hear anyone" — speaker silent.
- Mic icon shows muted/disabled greyed out.
- Audio device dropdown empty or shows wrong device.
- Echo, distortion, or one-way audio.
- Bluetooth headset connects but Teams can't use it.

## 2. Likely Causes
1. Wrong audio device selected in Teams (laptop speakers vs headset).
2. Windows app permission denied to microphone.
3. Headset USB cable / Bluetooth connection issue.
4. Another app holding exclusive access to audio device (Zoom, Webex, browser).
5. Outdated Teams version with known audio bug.
6. Driver issue with Realtek / USB audio.
7. System mute toggled (laptop hardware mute key).

## 3. Questions To Ask User
1. Are you using laptop built-in mic, USB headset, or Bluetooth headset?
2. Can you hear yourself in Windows Sound settings → "Test microphone"?
3. Is the issue happening in only Teams, or also in other apps (Zoom, browser)?
4. Have you joined another meeting today that worked?
5. Do you see your headset listed in Teams Settings → Devices?

## 4. Troubleshooting Steps
1. Teams → ⋯ menu → Settings → Devices → confirm correct Speaker, Microphone, and Camera selected from dropdowns.
2. Click "Make a test call" (Settings → Devices) — leave a test message; Teams plays it back.
3. Windows Settings → System → Sound → input/output devices match physical device.
4. Settings → Privacy & security → Microphone → Microsoft Teams toggle = ON.
5. Close any other audio app (Zoom, Spotify, browser tabs with media).
6. Unplug + replug USB headset; for Bluetooth, disconnect + reconnect.

## 5. Resolution Steps
**If wrong device selected:**
- In Teams Settings → Devices, pick the correct hardware. Teams will remember per device.

**If permission denied:**
- Settings → Privacy → Microphone → Enable for Teams. Restart Teams.

**If exclusive access conflict:**
- Right-click speaker icon (taskbar) → Sound settings → More sound settings → Recording tab → device → Properties → Advanced → uncheck "Allow apps to take exclusive control".

**If Teams is misbehaving:**
- Quit Teams completely (right-click tray icon → Quit, AND Task Manager kill `Teams.exe` and `ms-teams.exe`).
- Clear Teams cache:
  - Classic Teams: `%appdata%\Microsoft\Teams` — close, delete contents, reopen.
  - New Teams: `%localappdata%\Packages\MSTeams_8wekyb3d8bbwe\LocalCache` — close, delete contents, reopen.
- Reopen Teams, sign back in.

**If Bluetooth headset:**
- Pair fresh: Settings → Bluetooth & devices → Remove device → re-pair.
- Many headsets require selecting "Hands-free profile" vs "Stereo" — Teams audio works on hands-free.

**If Windows doesn't see device at all:**
- Device Manager → Audio inputs and outputs → check for warnings.
- Update driver (right-click → Update driver).
- For Realtek issues, get latest from OEM support page (NOT third-party "driver booster").

## 6. Verification Steps
- Teams test call records and plays back voice clearly.
- In a real meeting, two-way audio confirmed by other party.
- No echo or feedback.
- Audio holds for 30+ minutes without dropouts.

## 7. Escalation Trigger
- Windows fails to detect a working USB audio device → driver/hardware (escalate to L2).
- Issue affects every meeting and every device chosen — system-level.
- Audio drops every 5–10 min consistently — likely driver/firmware.
- Multiple users on same tenant report same issue at same time — service-side, escalate.
- → Escalate to **L2** with: device make/model, Teams version, output of `dxdiag` audio section, sample call ID from Settings → About → Diagnostics.

## 8. Prevention Tips
- Standardize on a known-good headset model (Jabra Evolve, Poly Voyager, Logi Zone) for fewer driver issues.
- Don't run Zoom and Teams simultaneously — they fight over audio devices.
- Keep Teams updated; restart it weekly.
- Bluetooth is more failure-prone than wired — wired USB-C / USB-A is the gold standard for reliability.
- Disable headset's "auto-pause when removed from ear" if false-pausing meetings.

## 9. User-Friendly Explanation
"Teams is sending audio to the wrong place, or Windows hasn't given Teams permission to use your mic. We'll point Teams at your real headset, run a quick test call so you can hear yourself, and check Windows didn't block the microphone. Most calls fix in under five minutes. If your headset isn't even showing up, we'll look at drivers next."

## 10. Internal Technician Notes
- New Teams (MSIX): cache path is `%localappdata%\Packages\MSTeams_8wekyb3d8bbwe\`.
- Classic Teams cache: `%appdata%\Microsoft\Teams\` — `Cache`, `Code Cache`, `databases`, `GPUCache`, `IndexedDB`, `Local Storage`, `tmp`.
- Diagnostic logs: Ctrl+Alt+Shift+1 (Classic) / Settings → Get logs (New) — needed for L2 escalation.
- Common Bluetooth profile mismatch: "Headset (HFP)" mono vs "Headphones (A2DP)" stereo — Teams uses HFP for two-way.
- For Realtek pop/crackle: disable "Audio enhancements" in device Properties → Enhancements tab.
- For meeting-room USB audio devices (e.g. Logitech MeetUp), firmware updates via vendor app often resolve.

## 11. Related KB Articles
- l1-teams-002 — Teams won't load / stuck on splash
- l1-windows-005 — Audio not working at OS level

## 12. Keywords / Search Tags
teams, no audio, can't hear, mic not working, microphone, speaker, other people can't hear me, audio device, bluetooth headset
