---
id: l1-zoom-002
title: "Zoom won't start, black screen, or stuck loading — fix and join the meeting"
category: meetings
support_level: L1
severity: high
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["Zoom app installed and signed in (or web join available)"]
keywords:
  - zoom black screen
  - zoom wont start
  - zoom stuck loading
  - zoom crashes
  - zoom freezes
  - cant share screen zoom
  - zoom cant see other participants
  - zoom no video
  - zoom unable to launch
tags:
  - zoom
  - meetings
  - top-50
related: [l1-meeting-audio-001-wrong-device, l1-teams-002-wont-load-stuck-splash, l1-windows-006-app-wont-open]
---

# Zoom won't start or shows a black screen — fix and join

## Symptoms

- Click Zoom icon → nothing happens, or icon bounces then disappears
- Zoom opens but screen is fully black
- Zoom stuck on "Loading..." or "Connecting..." for 30+ seconds
- Joined the meeting but you see participants as black tiles (or you appear black to others)
- Screen share is just a black rectangle
- Zoom crashes immediately on join

Most of these fall into 4 buckets: GPU acceleration, permissions, network, or a stale install.

## Step 1 — Fast path (often fixes it)

### Force-quit and restart Zoom

**Windows:**
1. Ctrl + Shift + Esc → Task Manager.
2. Find every process named "Zoom" or "Zoom Meetings."
3. Right-click each → End task.
4. Wait 15 seconds.
5. Reopen Zoom.

**macOS:**
1. ⌘ + Option + Esc → Force Quit Applications.
2. Select Zoom → Force Quit.
3. Wait 15 seconds.
4. Reopen.

### Try joining via browser
While Zoom desktop is broken, you can still attend:
1. Click the meeting link → "Join from your browser" option appears at the bottom of the page (sometimes hidden).
2. Or paste the meeting URL into Chrome directly.

Browser join has limited features (no breakout rooms, no virtual backgrounds, weaker audio mixing) but **you'll make the meeting**. Fix the app afterward.

## Step 2 — Disable GPU acceleration (fixes most "black screen" issues)

90% of Zoom black-screen issues are GPU acceleration conflicts. Disable it.

### Inside Zoom (if you can get into Settings)
1. Zoom app → Settings (gear) → Video → **Advanced**.
2. Uncheck **"Enable hardware acceleration for video processing"**.
3. Same panel: uncheck **"Enable hardware acceleration for sending video"** and **"...receiving video"**.
4. Sign out of Zoom → sign back in.

### If Zoom won't open at all (edit the config file)
**Windows:**
1. Close Zoom completely (Task Manager → End all Zoom processes).
2. Open File Explorer → paste in address bar: `%APPDATA%\Zoom\data`
3. Find `Zoom.cfg` or `zoomus.conf` file.
4. Open in Notepad.
5. Add (or edit) the line: `enableHardwareAccel=false`
6. Save. Reopen Zoom.

**macOS:**
1. Force-quit Zoom.
2. Finder → ⌘ + Shift + G → paste `~/Library/Application Support/zoom.us/`
3. Edit the config files similarly.

## Step 3 — Permissions (Camera / Microphone / Screen Recording)

### macOS — most common cause of "you appear as black tile"
1. **System Settings → Privacy & Security**.
2. Click **Camera** → ensure Zoom is enabled.
3. Click **Microphone** → ensure Zoom is enabled.
4. Click **Screen & System Audio Recording** → ensure Zoom is enabled (required for screen sharing).
5. **Quit and reopen Zoom** after any change — macOS doesn't apply mid-session.

### Windows
1. Settings → Privacy & security → Camera → "Let apps access your camera" → On → Zoom → On.
2. Same for Microphone.

## Step 4 — Conflicting apps

### Windows
- Other video apps holding the camera lock will black-screen Zoom. Close:
  - Microsoft Teams
  - Skype
  - Web browsers using camera (check tabs)
  - OBS, Streamlabs, screen recorders
  - Snap Camera (notorious for black screens — uninstall if not actively using)

### macOS
- Same — close all other camera-using apps.
- If you use a virtual camera (OBS, mmhmm, Snap), restart it after killing Zoom.

## Step 5 — Network / corporate firewall

Zoom needs these ports/protocols:
- TCP 443, 80
- UDP 8801-8810 (audio/video)
- Various Zoom CDN IPs

### Symptoms of network block
- Stuck on "Connecting..."
- Audio works but video doesn't
- Screen share fails with "unable to connect"

### Fixes
- Try a different network (mobile hotspot test — does Zoom work? Then your office network is the issue).
- VPN: disconnect VPN and try.
- Corporate proxy: ask IT — they may need to whitelist Zoom IPs.

## Step 6 — Stale install / corrupted update

If Zoom auto-updated and now misbehaves:
1. **Windows:** Settings → Apps → Installed apps → Zoom → Uninstall → reinstall fresh from zoom.us/download.
2. **macOS:** drag /Applications/zoom.us.app to Trash → reinstall from zoom.us/download. Or use Zoom's official uninstaller tool.
3. After reinstall, sign in fresh.

## Step 7 — Display / monitor issues

### "Zoom only black on my external monitor"
- Graphics driver / scaling issue.
- Right-click desktop → Display settings → ensure your scaling matches across monitors.
- Update Nvidia / AMD / Intel graphics driver from manufacturer site.

### "Zoom window opens off-screen"
- Right-click Zoom in taskbar → Maximize. Or Win+Arrow keys to snap back.

## When to escalate

| Situation | Path |
|---|---|
| Black screen persists after disabling GPU accel + reinstall | L2 — possibly graphics driver or codec issue |
| Connecting... times out on every network | L2 — possible account / SSO issue |
| Crashes on every meeting join, all networks | L2 — clean reinstall + Zoom Support diagnostic logs |
| Works on personal account, fails on work SSO | L2 — identity provider config issue |
| Screen share fails specifically (rest works) | L2 — screen recording permission or driver |

## Browser join — always-available fallback

When desktop is broken and you NEED to make the meeting:
1. Click the meeting link.
2. Bottom of the page: **"Join from your browser"** (sometimes you have to click "Launch Meeting" first; the browser option appears after).
3. Works in Chrome, Edge, Firefox, Safari.
4. Use the dial-in number from the invite as backup-backup.

## Prevention

- Keep Zoom updated. Stable channel auto-updates by default — leave it on.
- Restart your computer once a week — Zoom driver state accumulates.
- If you switch headsets / cameras often, do a 60-second test meeting before any important call.
- For Macs: macOS major version updates often break permissions — recheck after each upgrade.

## What ARIA can help with

ARIA can walk you through GPU acceleration disable, the permission resets, force-quit steps, and the browser-join fallback — live, while you're trying to make a meeting. ARIA cannot reinstall Zoom for you (admin action).
