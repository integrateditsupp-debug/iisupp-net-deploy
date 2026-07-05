# ARIA Sentinel 100-Call Demo Recording Script

Purpose: show ARIA Sentinel handling common corporate IT calls across Manual, Confirmed, and Autonomous safe-demo modes without creating real device damage or unsafe changes.

## Safety Boundary

- This is a simulation/demo lab inside Control Center.
- No Windows settings are changed by the demo lab.
- No account is locked, unlocked, deleted, or granted hidden access.
- Autonomous safe-demo controls the triage workflow only: read-only checks, dry-run repair previews, and approval stops for risky scenarios.
- Real production fixes still require the normal Sentinel gates: customer authority, supervisor approval, countdown, rollback notes, and kill-switch.

## Recording Flow

1. Open ARIA Sentinel from the rebuilt workspace package so the rail shows `v0.1.20`.
2. Go to `Control Center`.
3. Scroll to `Live demo lab`.
4. Click `Run live capture demo`.
5. Let the capture finish and show `VERIFIED`.
6. Narrate the visible proof chain: Before evidence -> Capture symptom -> Collect evidence -> Diagnose cause -> Choose safe action -> Run safe remediation -> Verify result -> Write proof report.
7. Show the proof report: `ARIA-CAPTURE-DEMO-PRN-001`, before/after queue state, dry-run remediation, and verification.
8. Click `Run Manual demo`.
9. Narrate: Manual gives walkthroughs only.
10. Click `Run Confirmed demo`.
11. Narrate: Confirmed stages fix cards and countdowns before action.
12. Click `Run Autonomous safe demo`.
13. Narrate: Autonomous controls triage, uses read-only/dry-run remediation for demo-safe cases, and stops for approval on risky cases.
14. Go to `ARIA`.
15. Ask: `My Teams microphone is not working, Outlook keeps asking for my password, and the printer queue is stuck. What should IT do first?`
16. Show the ARIA answer card: headline, simple steps, source card, collapsed KB detail, Resolve it for me.
17. Go to `Integrations` and show Office Safety Net: backup every 2 minutes, validation every 3 minutes, local-only, no macros.
18. Open `Admin Console` and show `Grant Asset RDP Access` safety wording: no hidden access, no credential storage, no policy bypass.

## Short Voiceover

ARIA Sentinel does not guess and does not secretly take over a machine. It captures the symptom, collects evidence, diagnoses the likely cause, chooses a safe action, runs a dry-run remediation for the demo, verifies the result, and writes a proof report. In production, real changes still require the right mode, authority, supervisor gate, rollback notes, and kill-switch.
