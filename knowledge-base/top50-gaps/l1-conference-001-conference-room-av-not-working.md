---
id: l1-conference-001
title: "Conference room AV not working — projector, mic, camera, Teams Room"
category: hardware
support_level: L1
severity: high
estimated_time_minutes: 15
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS 12+"]
tech_generation: current
year_range: "Current"
eol_status: "Current"
prerequisites: []
keywords:
  - conference room
  - meeting room
  - av
  - audio video
  - projector
  - tv
  - teams room
  - zoom room
  - microphone
  - mic
  - camera
  - poly
  - logitech rally
  - crestron
  - hdmi
  - dongle
  - airplay
  - miracast
  - chromecast
related_articles:
  - l1-display-001-external-monitor-not-detected
  - l1-teams-001-audio-not-working
  - l1-teams-002-wont-load-stuck-splash
escalation_trigger: "Conference room hardware physically dead (no power, no display) OR scheduled meeting starting in <5 min and ALL options failing → call IT emergency line for in-person help."
last_updated: 2026-05-12
version: 1.0
---

# Conference room AV not working

## 1. Symptoms
User in a conference room, meeting starting soon (or in progress), and the AV won't cooperate. Common patterns:
- TV / projector won't turn on or shows wrong input.
- Their laptop won't share screen.
- Mic doesn't work for remote attendees.
- Camera doesn't show or freezes.
- Teams Room / Zoom Room console is unresponsive.

## 2. The 60-Second Triage (do FIRST)

1. **TV / Projector power.** Press the remote's power button. Look for power LED on the device.
2. **Right input?** TV remote → Source / Input → cycle through HDMI 1, HDMI 2, USB-C, etc.
3. **Cable both ends seated.** Wiggle and re-seat the HDMI / USB-C cable into your laptop and into the wall plate.
4. **Try a different cable.** Most conference rooms have spares in the credenza / cabinet. Cheap HDMI cables fail constantly.

If still no joy after 60 seconds, continue.

## 3. Sharing Your Laptop to the Room TV

### Wired path (most reliable, do first)

1. Plug the room's HDMI / USB-C cable into your laptop.
2. Press **Win + P** (Windows) or **System Settings → Displays** (Mac).
3. Choose **Duplicate** (mirror) or **Extend**.
4. Set the room TV to the input matching the wall plate.

If the TV says "No signal" with a working cable:
- Switch laptop's display mode (Win+P → cycle through PC screen only / Duplicate / Extend / Second screen only).
- Resolution mismatch: Settings → Display → Resolution → try 1920×1080 explicitly. Some older TVs hate higher rates.

### Wireless paths

**Microsoft Teams Room:**
- Open Teams on laptop → click your meeting → click **Join** with content sharing → select "Cast to this room" if Bluetooth proximity detected.
- OR get the room's join code (displayed on the room console) → enter from your laptop.

**Zoom Room:**
- Open Zoom → Share Screen → enter the room's sharing key (visible on the room console).

**AirPlay (Apple TV in room or Mac mini receiver):**
- Click the AirPlay icon in Mac's menu bar → select the room's name.

**Miracast (Windows-native cast):**
- Win+K → select the room's display (if room has Miracast receiver).

**Google Chromecast / Meet hardware:**
- Chrome → 3-dot menu → Cast → select the room.

## 4. Microphone Problems

In a meeting, mic isn't picking up:

1. **Mute button on table mic / ceiling mic.** Look for a physical button with a red light. Tap it.
2. **In meeting app:** Teams / Zoom / Meet → check mic input device. Should be "[Room name] Mic" or "Crestron Mic" or similar — NOT your laptop's built-in.
3. **Test:** click test mic in Teams → speak normally → should show level bar moving.

If mic shows in input list but no audio:
- Sometimes a power-cycle of the AV system reset (if there's an "End/Restart" button on the room console) fixes it.

## 5. Camera Problems

- **Lens cover.** Some Poly / Logitech cameras have privacy covers. Push to retract.
- **Wrong camera selected** in meeting app: Settings → Video → choose the room camera (e.g., "Poly Studio X70" not "Integrated Webcam").
- **Camera frozen:** restart the room console — usually a button labeled "Reboot Console" on Crestron / Poly / Logitech panels.

## 6. Teams Room / Zoom Room Console Unresponsive

- Press the screen firmly — may have gone to sleep.
- Wait 30 seconds — sometimes loading.
- Look for a hidden RESET pinhole on the console (usually back / bottom).
- If still dead: power-cycle by unplugging the console for 10 seconds and re-plug. Console reboot takes ~3 minutes.

## 7. Last-Resort Workarounds (meeting starting NOW)

- **Use your laptop's screen + speakers** for the meeting (forget the TV). Lean into the laptop's mic. Works in person with smaller groups.
- **Phone hotspot for connectivity** if room Wi-Fi is also down.
- **Move meetings to another room** — most offices have multiple.
- **Send the meeting link to attendees and join from your laptop, not the room system.** Attendees on Zoom / Teams won't care which device you're on.

## 8. When to Call IT (Emergency)

- Meeting starts in < 5 minutes AND nothing in this guide is helping.
- The whole AV system in the room is unresponsive (no screen, no console, no lights).
- Sound system feedback / loud noises (turn down volume immediately, call IT).
- Network connectivity confirmed dead in the room (Wi-Fi + Ethernet both fail in that room).

**Tell IT:**
- Room name + building.
- Meeting start time.
- What's failing.
- What you already tried.

## 9. Prevention Tips
- **Arrive 5 minutes early** — gives buffer for "30-second AV issue" turning into a real problem.
- **Familiarize yourself with the room's panel** at low-stakes time, not during a board meeting.
- **Keep a USB-C → HDMI dongle in your laptop bag.** Solves 30% of AV problems.
- **Reserve rooms with known-good AV** for important meetings.
- **Test the room** 24h before customer demos: walk in, run a quick share + mic + camera test.

## 10. User-Friendly Explanation
Most conference room AV issues are: wrong input on the TV (use the remote's Source button), cable not seated (re-plug), or wrong audio/video device selected in Teams/Zoom (change in app settings). If a meeting is starting in 5 minutes and nothing works, just join from your laptop screen + speakers, or use a different room. Don't lose 20 minutes wrestling with the AV — your meeting matters more.

## 11. Internal Technician Notes
- Common AV stacks:
  - **MS Teams Room (MTR) systems:** Logitech Tap + Rally Bar, Poly Studio X70/X50, Crestron Flex, Lenovo ThinkSmart, Yealink MVC.
  - **Zoom Rooms:** Logitech Rally, Neat Bar, Poly Studio.
  - **Decoupled:** TV + soundbar + USB camera (e.g., Logitech MeetUp).
- Console reboot path varies; commonly a hidden button or in admin settings.
- Network: AV systems often on isolated VLAN. If room network down, console can't connect even if Wi-Fi works for laptops.
- Daily reboot scheduled at 2 AM is best practice — keep firmware drift low.
- For demanding meetings, dedicated MTR (always-on, ready-to-join) > BYOD share-from-laptop.

## 12. Related KB Articles
- `l1-display-001` — External monitor not detected
- `l1-teams-001` — Teams audio not working
- `l1-teams-002` — Teams won't load

## 13. Keywords / Search Tags
conference room, meeting room, av, audio video, projector, tv, teams room, mtr, zoom room, microphone, mic, camera, poly, logitech rally, neat bar, crestron, hdmi, dongle, airplay, miracast, chromecast
