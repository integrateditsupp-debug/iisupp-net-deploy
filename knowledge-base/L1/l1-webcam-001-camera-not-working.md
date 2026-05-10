---
id: l1-webcam-001
title: "Webcam / camera not working in Teams, Zoom, or other apps"
category: webcam
support_level: L1
severity: high
estimated_time_minutes: 12
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
prerequisites: []
keywords:
  - webcam
  - camera
  - video off
  - camera not working
  - camera not detected
  - black screen video
  - integrated camera
  - external webcam
  - logitech
  - privacy shutter
  - camera in use
related_articles:
  - l1-teams-001
  - l1-windows-005
  - l1-windows-006
escalation_trigger: "Camera not detected in Device Manager / System Information after driver reinstall, or hardware shutter physically broken"
last_updated: 2026-05-08
version: 1.0
---

# Webcam / camera not working

## 1. Symptoms
- Black or frozen image where the video preview should be.
- "Other apps are using the camera" or "We can't find your camera" error.
- Camera works in one app but not another.
- Tiny LED next to the lens never lights up during a call.
- A second app stays on the camera and locks out the next one.

## 2. Likely Causes
1. Privacy shutter or physical sliding cover is closed.
2. App-level camera permission turned off (Windows Settings or macOS System Settings).
3. Another app is holding the camera (Teams, Zoom, OBS, browser tab).
4. Driver is corrupt or fell back to a generic device.
5. USB hub is underpowered for an external webcam.
6. External webcam plugged into a USB-C dock that doesn't pass video.

## 3. Questions To Ask User
1. Is the camera built-in or USB? Brand?
2. Does the LED next to the lens turn on?
3. Does it work in any other app (the Camera app for Windows, Photo Booth on Mac)?
4. When did this start — sudden, after an update, after plugging in something new?
5. Is there a physical privacy shutter? (Many laptops have one and it's easy to miss.)

## 4. Troubleshooting Steps
1. **Privacy shutter check.** Look at the lens — if there's a sliding cover, slide it open.
2. **Close every app** that might be holding the camera — Teams, Zoom, OBS, browser tabs that use video. Then reopen only the one you need.
3. **Test in the OS Camera app** — Windows: Camera (Start menu). macOS: Photo Booth. If the OS app shows video, the issue is app-side.
4. **Check OS-level camera permission** — Windows: Settings → Privacy & security → Camera → ensure it's On for the app. macOS: System Settings → Privacy & Security → Camera → toggle the app on.
5. **Unplug + replug** an external webcam. If on a USB-C dock, plug directly into the laptop instead.
6. **Reboot.** Resets the camera service if a process is stuck.

## 5. Resolution Steps
**If OS Camera app works but Teams/Zoom doesn't:**
1. Sign out and back into the app.
2. In Teams: Settings → Devices → Camera dropdown → pick the right device.
3. In Zoom: Settings → Video → Camera dropdown.

**If OS Camera app shows "We can't find your camera" (Windows):**
1. Device Manager → Cameras → right-click your device → Update driver → Search automatically.
2. If still failing → right-click → Uninstall device → reboot. Windows will reinstall on boot.

**If on macOS and the Camera privacy panel doesn't list the app:**
1. Quit the app completely (Cmd+Q).
2. Re-open. macOS will prompt for camera permission on first use.

**External webcam not detected at all:**
1. Try a different USB port (preferably directly on the laptop, not a hub).
2. Test on another machine to rule out hardware failure.

## 6. Verification Steps
- LED next to lens lights up when the app shows the preview.
- You can see yourself in the in-app preview.
- A test call shows your video to the other side.
- Camera does NOT stay locked when you close the app — opening another video app works immediately.

## 7. Escalation Trigger
- Device Manager shows error code 10/45 on the camera that persists after driver reinstall.
- Camera doesn't appear in Device Manager / System Information at all.
- Hardware shutter is physically jammed.
- → Escalate to **L2** with: brand/model of webcam, OS build, screenshot of Device Manager, what the OS Camera app reports.

## 8. Prevention Tips
- Don't run multiple video apps simultaneously — they fight over the camera.
- For external webcams, plug directly into the laptop. Cheap USB-C docks often pass data but not video.
- If you use a privacy slider, develop a habit of opening it before a call, not during.
- Keep webcam drivers updated through OEM tools (Dell Update, Lenovo Vantage, HP Support Assistant).

## 9. User-Friendly Explanation
"Cameras get tripped up in three usual ways: a sliding cover, a permission switch, or another app that's already holding the camera. We'll check all three in under a minute. If the LED next to your camera lights up but you still see black, that's almost always an app permission. If the LED never comes on at all, it's the cover or a driver. Either way, this is a quick fix."

## 10. Internal Technician Notes
- Windows: `Get-PnpDevice -Class Camera` quick lists all camera devices and state.
- Code 45 in Device Manager almost always means the device is disconnected at the bus level — physical reseat or different port.
- Logitech Capture and Logi G Hub both background-hold cameras even when minimized — kill via Task Manager if they're not actively in use.
- macOS: `system_profiler SPCameraDataType` enumerates connected cameras.
- For Intune-managed devices, ensure no Camera-restriction policy is in effect (`Settings catalog → Privacy → Let Windows apps access the camera`).

## 11. Related KB Articles
- l1-teams-001 — Teams audio + mic
- l1-windows-005 — No sound on Windows
- l1-windows-006 — App won't open

## 12. Keywords / Search Tags
webcam, camera, video off, camera not working, camera not detected, black screen video, integrated camera, external webcam, logitech, privacy shutter, camera in use, camera app
