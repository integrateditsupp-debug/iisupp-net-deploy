---
id: l1-zoom-003
title: "Zoom camera or microphone not working in a meeting"
category: zoom
support_level: L1
severity: high
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["You can join the Zoom meeting (this is about audio/video inside it)"]
keywords:
  - zoom camera not working
  - zoom no one can see me
  - zoom video not showing
  - zoom microphone not working
  - zoom no audio
  - cant hear in zoom
  - zoom others cant hear me
  - zoom wrong camera selected
  - zoom camera in use by another app
  - zoom mic muted
tags:
  - zoom
  - audio
  - video
  - meetings
  - top-50
related: [l1-zoom-002-wont-start-black-screen, l1-webcam-001-camera-not-working, l1-teams-001-audio-not-working]
---

# Zoom camera or microphone not working in a meeting

## Symptoms
- Your video is black or others say they can't see you.
- No sound — you can't hear others, or they can't hear you.
- Zoom shows the wrong camera or the wrong speaker/mic.
- "Camera is being used by another application."

## Likely causes
- The wrong device is selected in Zoom, or you're muted / video stopped.
- Another app (Teams, browser, camera app) is holding the camera.
- The OS is blocking Zoom's microphone/camera permission.
- Zoom's audio didn't connect when you joined.

## Safe steps
- **Check the obvious in the meeting toolbar first:**
  - Bottom-left: is **Mute**/**Unmute** showing muted? Is **Start Video**/**Stop Video** showing stopped? Toggle them.
  - Click the **^** arrow next to **Mute** → pick the correct **Microphone** and **Speaker**; use **Test Speaker & Microphone**.
  - Click the **^** arrow next to **Start Video** → pick the correct **Camera**.
- **Make sure audio actually joined:**
  - If you see **Join Audio** in the toolbar, click it → **Join with Computer Audio**.
- **Free the camera from another app:**
  - Close other apps that use the camera (Teams, browser tabs, the Camera app), then in Zoom re-select the camera. Only one app can use a webcam at a time.
- **Grant OS permission:**
  - Windows: **Settings → Privacy & security → Camera** (and **Microphone**) → make sure **Zoom** and "let desktop apps access" are **On**.
  - macOS: **System Settings → Privacy & Security → Camera / Microphone** → tick **zoom.us** → you may need to quit and reopen Zoom.
- **Reset if devices still misbehave:**
  - Leave the meeting, fully quit Zoom (Windows: check the system tray; macOS: Quit), reopen, rejoin.
  - Zoom → **Settings → Video / Audio** to confirm the right devices before the next meeting.

## Verify
- Your self-view shows your video; the audio test shows the mic bar moving and plays back sound.
- Others confirm they can see and hear you.

## When to escalate (to L2 / IT)
- The camera/mic works in every other app but never in Zoom after reinstall.
- A managed/locked-down laptop blocks camera or microphone by policy.
- An external webcam/headset isn't detected by the operating system at all (that's a device/driver issue — see the webcam runbook).

## Safety notes
- Selecting devices and granting camera/mic permission are safe, reversible settings changes.
- No meeting content is captured — this is about device selection only.

## What ARIA can help with
- ARIA can walk you through the in-meeting device pickers and OS permissions, and — with your confirmation — run the vetted, reversible Zoom device-reset helper (`zoom-weird-v1`). It checks device selection only and never accesses your camera feed or microphone audio.
