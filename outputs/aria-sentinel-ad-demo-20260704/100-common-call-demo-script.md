# ARIA Sentinel 100-Call Demo Recording Script

Purpose: show ARIA Sentinel handling common corporate IT calls across Manual, Confirmed, and Autonomous safe-demo modes without creating real device damage or unsafe changes.

## Safety Boundary

- This is a simulation/demo lab inside Control Center.
- No Windows settings are changed by the demo lab.
- No account is locked, unlocked, deleted, or granted hidden access.
- Autonomous safe-demo controls the triage workflow only: read-only checks, dry-run repair previews, and approval stops for risky scenarios.
- Real production fixes still require the normal Sentinel gates: customer authority, supervisor approval, countdown, rollback notes, and kill-switch.

## Recording Flow

1. Open ARIA Sentinel.
2. Go to `ARIA`.
3. Ask: `My Teams microphone is not working, Outlook keeps asking for my password, and the printer queue is stuck. What should IT do first?`
4. Show the new ARIA answer card: headline, simple steps, source card, Resolve it for me.
5. Go to `Control Center`.
6. In `100+ common support calls`, click `Run Manual demo`.
7. Narrate: Manual gives walkthroughs only.
8. Click `Run Confirmed demo`.
9. Narrate: Confirmed stages fix cards and countdowns before action.
10. Click `Run Autonomous safe demo`.
11. Narrate: Autonomous controls triage, auto-previews only safe low-risk dry-runs, and stops for approval on high-risk calls.
12. Scroll the list to show coverage: Windows, network, printers, Outlook, Teams, Office/Adobe, OneDrive, identity, performance, browser, security, RDP, corporate apps.
13. Go to `Integrations` and show Office Safety Net: backup every 2 minutes, validation every 3 minutes, local-only, no macros.
14. Open `Admin Console` and show `Grant Asset RDP Access` safety wording: no hidden access, no credential storage, no policy bypass.

## Short Voiceover

ARIA Sentinel does not guess and does not secretly take over a machine. In Manual mode, it teaches the user. In Confirmed mode, it prepares the fix and waits for approval. In Autonomous mode, it controls the workflow for safe, proven, low-risk checks, but still stops for anything risky like identity, security, file loss, or remote access authority.
