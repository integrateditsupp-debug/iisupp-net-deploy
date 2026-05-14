---
id: l1-teams-003
title: "Teams meeting — can't hear or be heard"
category: teams
support_level: L1
severity: high
estimated_time_minutes: 6
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - teams cant hear
  - teams no audio
  - mic not working teams
  - microphone disabled teams
  - teams cant be heard
  - teams device settings
  - teams audio cache
  - default device wrong
tags:
  - teams
  - meetings
  - audio
  - top-50
related: [l1-meeting-audio-001-wrong-device, l1-teams-001-audio-not-working, l1-bluetooth-002-airpods-headset-wont-reconnect]
---

# Teams meeting audio

### Mic in Teams is set to the wrong device

Most common cause. In the meeting: click More (...) → Device settings. Microphone dropdown should show your actual mic (headset, AirPods, USB mic). If it says "Default Communications Device," that's a wild card — pick the explicit name instead. Same for Speaker. Test by talking — the level meter should jump green. If meter is flat, you're still picking a dead device.

### Mic works in Windows but not in Teams

Teams doesn't have microphone permission. macOS: System Settings → Privacy & Security → Microphone → toggle Teams ON → quit and reopen Teams (mac doesn't apply mid-session). Windows: Settings → Privacy & security → Microphone → "Let apps access your microphone" ON → scroll to Teams → ON. Restart Teams.

### Joined meeting but no one can hear you — mic looks unmuted

Hardware mute is engaged. Headsets often have a physical mic-mute button on the cable or earcup. Press it — most have a small LED that indicates muted (red) or live (green/off). If no physical button, swap to a different mic via Device settings to confirm hardware vs Teams.

### Audio works during meeting then suddenly drops

Bluetooth profile flipped from Hands-Free to Stereo (or vice versa). Common with AirPods + corporate Teams. Quick fix: in Device settings, switch to the wired/built-in mic for the rest of the meeting. Permanent fix: see KB l1-bluetooth-002 — pin Hands-Free profile in Windows sound settings.

### Echo — others hear themselves

You don't have headphones on. Teams audio coming out of your laptop speakers is being picked up by your mic and re-broadcast. Plug in headphones. Or move away from the laptop mic. Software echo cancel only works so well; physical separation always wins.

### Teams crashes audio after USB headset hot-swap

Teams loses track of devices on mid-meeting USB swap. Don't swap mid-meeting if you can help it. If you did: leave the meeting and rejoin — Teams re-enumerates devices on fresh join.

### Clear Teams audio cache (last resort)

Quit Teams completely (Task Manager → End all ms-teams.exe / Teams.exe). Windows: delete contents of `%appdata%\Microsoft\Teams\Cache` and `%appdata%\Microsoft\Teams\blob_storage`. New Teams: `%localappdata%\Packages\MSTeams_8wekyb3d8bbwe\LocalCache`. Mac: `~/Library/Application Support/Microsoft/Teams/`. Reopen Teams → fresh device enumeration.

### When to escalate to L2

Mic works in Voice Recorder / Sound test but never in Teams after permissions + cache reset → L2 reinstalls Teams. Headset works on a different PC but not yours → L2 reinstalls audio driver. Multiple users in same office report mic dead today → L2 checks tenant + Teams service health.
