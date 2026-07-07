---
id: l1-teams-005
title: "Microsoft Teams screen sharing not working / can't present"
category: teams
support_level: L1
severity: high
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["You're in a Teams meeting or call"]
keywords:
  - teams screen share not working
  - teams cant share screen
  - teams share button greyed out
  - teams screen share black screen
  - teams presenting not working
  - cant present in teams
  - teams share screen frozen
  - teams screen share no motion
  - teams share content missing
tags:
  - teams
  - screen-share
  - meetings
  - top-50
related: [l1-teams-001-audio-not-working, l1-teams-002-wont-load-stuck-splash, l1-conference-001-conference-room-av-not-working]
---

# Microsoft Teams screen sharing not working / can't present

## Symptoms
- The **Share** button is missing or greyed out.
- You share, but attendees see a black screen or a frozen image.
- Screen share starts then immediately drops.
- You can share a window but not the whole desktop (or vice-versa).

## Likely causes
- macOS screen-recording permission isn't granted to Teams.
- The meeting role/policy doesn't let you present.
- A stale Teams cache or GPU/hardware-acceleration glitch.
- Bandwidth too low, so shared video is dropped.

## Safe steps
- **macOS permission (the #1 cause on Mac):**
  - **System Settings → Privacy & Security → Screen Recording** → tick **Microsoft Teams** → quit and reopen Teams, then rejoin.
- **Confirm you're allowed to present:**
  - If **Share** is greyed out, ask the organizer to make you a **Presenter** (Meeting options → Who can present), or check you're not in a view-only/webinar attendee role.
- **Share a specific window instead of the whole screen:**
  - Click **Share** → pick a single **Window** rather than **Screen**. This often works when full-desktop share is blocked or black.
- **Fix a black or frozen share:**
  - Stop sharing, then re-share.
  - Turn off GPU hardware acceleration: Teams **Settings → General** (New Teams: **Settings → App**) → disable **hardware acceleration** (or "Disable GPU hardware acceleration") → **fully quit and reopen Teams**.
- **Clear the Teams cache if it persists:**
  - Fully quit Teams (confirm no Teams process in Task Manager / Activity Monitor).
  - New Teams (Windows): delete the contents of `%localappdata%\Packages\MSTeams_8wekyb3d8bbwe\LocalCache`.
  - Classic Teams (Windows): delete the contents of `%appdata%\Microsoft\Teams`.
  - Relaunch Teams and rejoin. (See the Teams "won't load" runbook for full cache-clear detail.)
- **Rule out bandwidth:**
  - If your video/network is weak, turn off incoming video and try sharing a static window; a wired connection or closer Wi-Fi helps.

## Verify
- The **Share** button is available and starts a share.
- Attendees confirm they can see your screen moving (scroll something to prove motion).
- You can stop and restart the share cleanly.

## When to escalate (to L2 / IT)
- Sharing fails for everyone in the tenant (possible service incident — check the service health page).
- A managed policy blocks presenting and needs an admin change.
- Cache clear + reinstall + permission grant all fail.

## Safety notes
- Granting screen-recording permission and toggling hardware acceleration are safe, reversible settings.
- Clearing the Teams cache removes only local temporary files; your chats and files live in the cloud.

## What ARIA can help with
- ARIA can tell whether it's a **permission** (macOS), a **role/policy** (ask to be made presenter), or a **cache/GPU** issue, and guide the matching fix. It checks share availability and settings only — never the content you share.
