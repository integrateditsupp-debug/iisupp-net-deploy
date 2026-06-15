---
id: l1-camera-003
title: "Camera says 'in use by another app' — release the lock"
category: webcam
support_level: L1
severity: medium
estimated_time_minutes: 5
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
keywords:
  - camera in use
  - camera being used by another app
  - cant access camera
  - webcam locked
  - release camera
  - camera unavailable
  - 0xa00f4243
  - other app is using your camera
tags:
  - webcam
  - camera
  - top-50
related: [l1-webcam-001-camera-not-working, l1-webcam-002-virtual-background-filter, l1-meeting-audio-001-wrong-device]
---

# Camera locked by another app

### "Your camera is being used by another application"

Another app has an exclusive camera hold. Most common culprits in 2026: Microsoft Teams (background process), Zoom in system tray, an open browser tab with camera permission, OBS / Streamlabs, Snap Camera. Quit them all. Windows: Task Manager → end any ms-teams.exe, Zoom.exe, OBS64.exe. Mac: ⌘+Option+Esc → force quit. Retry the camera in your target app.

### Restart the camera-using app, not the camera

After releasing the lock, the new app sometimes still can't grab it because of a stale device handle. Fix: fully quit the app that needs camera, wait 10 seconds, reopen. Don't just minimize — fully quit. Then try again. Camera usually grants on the second try.

### Browser tabs holding camera silently

Chrome / Edge keep camera permission for open tabs even when the page seems idle. Click the camera icon in the browser address bar of the active tab → see which tabs have camera open. Or chrome://settings/content/camera → review allowed sites and block any you don't actively need. Close stale tabs.

### Snap Camera is installed — known cause of camera lock-up

Snap Camera (the filter app) registers itself as a virtual camera and frequently jams the real camera device. If you don't actively use Snap Camera: uninstall it. If you do: completely quit it from the system tray before opening meeting apps. Don't let it auto-start with Windows.

### Camera works on built-in but not on USB webcam (or vice versa)

Multiple cameras → app picks the wrong one or refuses both. In the meeting app's video settings, explicitly select the camera you want. In Windows: Settings → Bluetooth & devices → Cameras → click the camera → "Disable" the one you don't want, leaving only one active. Restart the meeting app.

### Camera physical privacy shutter is closed

Many laptops (ThinkPad, HP EliteBook, Dell Latitude) have a sliding privacy shutter over the lens. Visually check the webcam. If lens is covered, slide it open. The OS still reports "camera detected" because the device is electronically online, but no image gets through.

### Error code 0xA00F4243 — TROUBLEDLIST (Windows)

Specific Windows error meaning camera driver is in conflict with a service. Quick fix: Settings → Privacy & security → Camera → toggle "Camera access" OFF → ON. This bounces the camera service. If still fails: Device Manager → Cameras → right-click your camera → Disable → wait 10 sec → Enable.

### When to escalate to L2

Camera unavailable across every app, every restart, every browser. Camera shows in Device Manager with yellow exclamation mark (driver issue). Camera works in Voice Recorder but fails everywhere else. Brand-new laptop, camera never worked — possibly hardware DOA, return for replacement.
