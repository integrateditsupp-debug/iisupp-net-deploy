---
id: l1-teams-004
title: "Can't join a Microsoft Teams meeting — stuck connecting"
category: teams
support_level: L1
severity: high
estimated_time_minutes: 8
audience: end-user
os_scope: ["Windows 10", "Windows 11", "macOS"]
tech_generation: modern
year_range: "2022-2026"
eol_status: "Current."
prerequisites: ["You have the meeting link or it's on your calendar"]
keywords:
  - cant join teams meeting
  - teams meeting wont connect
  - teams stuck connecting
  - teams meeting link wont open
  - couldnt connect you to the meeting
  - teams join button does nothing
  - teams meeting wont load
  - join teams meeting on web
  - teams meeting keeps spinning
tags:
  - teams
  - meetings
  - join
  - top-50
related: [l1-teams-002-wont-load-stuck-splash, l1-teams-001-audio-not-working, l1-wifi-002-connected-no-internet]
---

# Can't join a Microsoft Teams meeting — stuck connecting

## Symptoms
- Clicking **Join** does nothing, or spins on "Connecting…" forever.
- "We couldn't connect you to the meeting."
- The meeting link opens a browser page that loops back to "Open Teams."
- You get in but immediately get dropped.

## Likely causes
- The Teams app is signed into the wrong account/tenant for this meeting.
- A stale session or cache in the desktop app.
- Network/VPN or a corporate proxy blocking the meeting media.
- A one-off glitch that a fresh join fixes.

## Safe steps
- **Join from the browser as a fast workaround:**
  - Open the meeting link → choose **Continue on this browser** → **Join now**. Getting into the meeting this way keeps you productive while you fix the app.
- **Confirm the right account:**
  - In Teams, click your profile picture (top-right) → make sure you're signed into the account/organization that owns the meeting. If it's a guest/partner meeting, switch org or join via browser.
- **Quick reset of the desktop app:**
  - Fully quit Teams (confirm no Teams process in Task Manager / Activity Monitor) → reopen → click **Join** again.
  - Restart the PC if it still spins — clears a stuck network state.
- **Check connectivity/VPN:**
  - Load any website to confirm internet is up. If you're on VPN, try disconnecting it (or connecting to the "internet-only" profile) and rejoin — some VPNs block meeting media. (See "connected but no internet" if the network is the issue.)
- **Clear the Teams cache if joining keeps failing:**
  - Fully quit Teams.
  - New Teams (Windows): delete the contents of `%localappdata%\Packages\MSTeams_8wekyb3d8bbwe\LocalCache`.
  - Classic Teams (Windows): delete the contents of `%appdata%\Microsoft\Teams`.
  - Relaunch and rejoin. (Full detail in the Teams "won't load" runbook.)

## Verify
- You reach the meeting pre-join screen and **Join now** connects.
- You stay connected (no immediate drop) and can see/hear participants.

## When to escalate (to L2 / IT)
- No one in the organization can join (check the service health page for a Teams incident).
- A corporate proxy / firewall is blocking meeting media and needs an admin change.
- Browser join works but the desktop app never connects after a cache clear + reinstall.

## Safety notes
- Joining via browser, signing into the correct account, and clearing the cache are safe, reversible steps.
- No meeting content is stored locally by these steps.

## What ARIA can help with
- ARIA can get you into the meeting via the browser immediately, then help sort the desktop app (account, cache, or network). It checks connection state only — never the meeting's audio, video, or chat.
