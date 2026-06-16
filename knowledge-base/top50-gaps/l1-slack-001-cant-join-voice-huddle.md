---
id: l1-slack-001
title: "Slack / Discord huddle or call won't connect — audio, mic, or join error"
category: collaboration
support_level: L1
severity: medium
estimated_time_minutes: 10
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS", "iOS", "Android"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["App installed and signed in"]
keywords:
  - slack huddle wont start
  - cant join slack call
  - discord voice not working
  - slack audio missing
  - huddle no sound
  - slack mic not working
  - discord cant connect to voice
  - mic muted in slack
  - slack screen share black
  - no input audio device
tags:
  - slack
  - discord
  - voice
  - top-50
related: [l1-meeting-audio-001-wrong-device, l1-bluetooth-002-airpods-headset-wont-reconnect, l1-teams-001-audio-not-working]
---

# Slack / Discord call won't connect — diagnose and fix

## Symptoms

- Click "Start huddle" in Slack → nothing happens
- Discord shows "Connecting..." indefinitely
- Joined the call but no audio either direction
- Your mic shows muted even when you click unmute
- Screen share is a black rectangle
- "Couldn't access microphone/camera" error
- Audio works for music but Slack/Discord can't hear you

## Step 1 — Permissions (most common cause)

### macOS
1. **System Settings → Privacy & Security → Microphone**.
2. Make sure **Slack** (and **Discord**) are toggled ON.
3. **Camera** — same check.
4. **Screen & System Audio Recording** — required for screen share + sometimes for huddle audio sharing.
5. **Quit and reopen the app** after any change.

### Windows
1. Settings → Privacy & security → Microphone → "Let apps access your microphone" → On.
2. Scroll down to Slack / Discord → On.
3. Same for Camera.

### iOS / Android
1. Phone Settings → Apps → Slack (or Discord) → Permissions.
2. Microphone + Camera + (optionally) Notifications → Allow.

## Step 2 — Right input/output device

Inside the app:

### Slack desktop
1. Click your profile → Preferences → Audio & video.
2. **Microphone** dropdown — pick your actual mic (not "Default" which Slack may have wrong).
3. **Speaker** dropdown — pick where you want to hear.
4. **Camera** dropdown — pick your real camera.
5. Click "Test" — does the mic level meter respond when you talk?

### Discord
1. Discord Settings (gear) → Voice & Video.
2. INPUT DEVICE → pick your mic.
3. OUTPUT DEVICE → pick your speakers/headset.
4. Scroll to "Voice Settings" → set Input Mode to "Voice Activity" (auto detect) or "Push to Talk."
5. **Reset Voice Settings** button at the bottom — nukes stuck state.

## Step 3 — Slack-specific huddle issues

### "Huddle won't start" — Slack hangs
- Update Slack to latest version (Help → Check for Updates).
- Restart Slack.
- If it persists: signOut/signIn (Slack → workspace name → Sign out → sign back in).

### "Huddle audio is robotic / laggy"
- Slack Huddles use WebRTC. Quality drops on weak Wi-Fi.
- Move closer to router OR switch to wired Ethernet.
- Disable any VPN — it adds latency.

### Screen share black in huddle
- macOS: System Settings → Privacy & Security → Screen Recording → enable Slack. Then quit + reopen Slack.
- Windows: usually a GPU acceleration issue. Slack → Preferences → Advanced → uncheck "Hardware acceleration" → restart.

## Step 4 — Discord-specific issues

### "Stuck on RTC Connecting"
- Discord can't reach its voice servers. Try:
  1. Different network (mobile hotspot test).
  2. Disable VPN.
  3. Discord Settings → Voice & Video → Voice Region → change to a closer one or "Automatic."
  4. Restart Discord.

### "No Route" error
- Firewall blocking Discord. Either disable host firewall temporarily OR allow Discord in Windows Defender Firewall.

### "Mic always shows muted"
- Hold the slash key (/) — Discord push-to-talk override default.
- Or your hardware mute button on headset is engaged. Check headset.
- Or input device is wrong (Step 2).

### "Other people sound robotic, I sound fine"
- Receive-side codec issue. Have THEM update Discord, restart, OR change voice region.

## Step 5 — Other apps stealing mic/camera

If Slack / Discord can't access the mic but Voice Recorder can, another app has it locked.

### Common culprits
- Microsoft Teams (background process even when window closed)
- Zoom (running in tray)
- OBS / Streamlabs
- Snap Camera (notorious — uninstall if not actively used)
- Web tabs with camera permission still open in another browser window

### Fix
- Quit all of the above completely (Task Manager / Force Quit).
- Reopen Slack / Discord — mic should work now.

## Step 6 — Headphones / Bluetooth specifics

If using AirPods or other Bluetooth headset, see `l1-bluetooth-002-airpods-headset-wont-reconnect` first.

Quick:
- Switch Bluetooth profile to **Hands-Free** mode for calls (better mic, lower stereo quality).
- For consistent quality on Windows, use wired or a dedicated USB headset dongle.

## Step 7 — Slack mobile huddle issues

### "Huddle invite came but I can't join"
- Update Slack mobile to latest version.
- Phone Permissions → mic + camera allowed for Slack.
- Phone Settings → Focus / Do Not Disturb → off (might be silencing the join).
- Force-quit + reopen Slack.

### "Can hear them, they can't hear me"
- Hardware: another app is using the mic. Phone Settings → see what's recently used mic.
- Reboot phone — clears mic claim.

## When to escalate

| Situation | Path |
|---|---|
| Permissions reset every reboot | L2 — possibly MDM / Intune policy |
| Slack / Discord crashes on every call | L2 — reinstall + check OS compatibility |
| All voice/video apps have issues | L2 — driver / audio subsystem |
| Workplace mass issue | L2 — Slack / Discord status page, possibly outage |
| Corporate firewall blocks Slack voice | L2 — IT whitelists Slack IP ranges |

## Prevention

- After OS major upgrade: spend 60 sec verifying mic + camera permissions for collaboration apps.
- Keep Slack, Discord, Teams, Zoom updated. They all auto-update by default — leave it on.
- Pick **one** primary mic/headset and stick with it.
- For Discord: enable Krisp / built-in noise suppression for cleaner calls.
- For Slack: huddles work best on stable Wi-Fi or wired. Avoid coffee shop Wi-Fi for critical huddles.

## What ARIA can help with

ARIA can walk through the permission stack live for your specific OS, identify which app stole the mic from your description, and reset Slack/Discord audio settings step-by-step. ARIA cannot click the OS permission dialog for you.
