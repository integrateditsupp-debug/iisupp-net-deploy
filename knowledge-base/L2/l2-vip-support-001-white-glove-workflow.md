---
id: l2-vip-support-001
title: "VIP / executive / white-glove support workflow"
category: vip-support
support_level: L2
severity: high
estimated_time_minutes: 30
audience: admin
os_scope: ["Multi-platform"]
prerequisites: ["VIP list maintained", "after-hours on-call rota"]
keywords:
  - vip
  - executive support
  - white glove
  - c-suite
  - board member
  - personal assistant
  - desk-side
  - priority response
  - vvip
  - travel support
  - speakers needed at event
related_articles:
  - l2-onboarding-001
  - l3-security-001
  - l1-mfa-001
escalation_trigger: "VIP issue impacting board meeting, earnings call, customer demo, or live event in next 4 hours"
last_updated: 2026-05-08
version: 1.0
---

# VIP / white-glove support

## 1. Symptoms / triggers
- CEO assistant calls about a Teams meeting that won't connect.
- CFO can't open a spreadsheet during a board prep session.
- VP travelling internationally, VPN failed, demo in 90 minutes.
- Executive's spouse / family member needs help on a personal device they use for work.
- Board observer joining the network for the first time.

## 2. Likely causes (procedurally, not diagnostically)
1. The technical problem is usually L1, but the time pressure is L3.
2. VIP is using a non-standard device or app for the first time.
3. Stakes (earnings call, customer demo, regulator) raise the cost of any miss.
4. VIPs rarely run troubleshooting steps themselves — they expect the tech to drive.
5. Outage may be on the network/SaaS side, not their device.

## 3. Questions to ask the EA / VIP directly
1. What's the deadline (precise time + timezone)?
2. Is this from their work device, personal device, or hotel/conference network?
3. Are others affected (assume "no" until proven — VIPs notice everything).
4. Can we schedule a ride-along (you on the call) or do they need silent support?
5. What's the fallback if we can't fix in time — different device, dial-in, postpone?

## 4. Triage rules
1. **Confirm priority** — VIP issue with a deadline = always P1, even if technically minor.
2. **Two-tech rule** — assign a second tech to the queue so a backup exists.
3. **Direct dial** — never put a VIP through ticketing; you take it personally.
4. **Document silently** — write the ticket *after* the call, not during.
5. **Bias to redundancy** — give them two paths to success (e.g., "your laptop is fixing, here's a phone dial-in for the same call as a backup").

## 5. Resolution playbook
**During the call:**
1. Calm, low-jargon voice. Mirror their pace. No "have you tried turning it off and on" without context.
2. Lead with a fallback: "While we fix this, here's how to join from your phone in 30 seconds."
3. If you're remote-controlling, narrate: "I'm clicking Settings, then Devices."
4. If hardware issue and >30 min from deadline, dispatch desk-side immediately.
5. If software issue, fix on the device — never reinstall an app on the VIP's machine in the middle of a deadline session.

**After resolution:**
1. Send a 2-line follow-up email: what happened, what we did, what to watch for.
2. File a P1 ticket with the resolution.
3. After-action review with whichever VIP / EA was involved.
4. Add the root cause to the VIP profile (e.g., "headset's bluetooth flakey above 80% battery").

## 6. Verification
- VIP confirms the meeting/demo went through.
- No follow-up complaint within 24 hours.
- The issue is captured in the VIP profile so the next tech sees the pattern.

## 7. Escalation trigger
- Outage is wider than the VIP — declare a P1 incident, run l3-security-001 if it could be a breach.
- Issue requires vendor (Microsoft, Cisco, etc.) — open vendor P1 ticket immediately, don't wait for next-business-day.
- VIP is travelling and locked out of MFA — admin reset path, see l1-mfa-001 + identity-proof the VIP via a known-trusted second channel.

## 8. Prevention
- Maintain a VIP profile per executive: device, travel pattern, recurring issues, EA contact, preferred call channel.
- Pre-stage a known-good loaner device for execs travelling international.
- Quarterly "drill" with the EA — confirm dial-ins, MFA recovery, VPN profile still working.
- Pre-publish dial-in numbers and backup devices in the EA's runbook.
- Keep an executive-only Teams channel for IT to push status updates during outages.

## 9. User-friendly explanation
"We treat VIP support like an emergency room — known patient, known stakes, no waiting. We pick up the phone, we drive the fix, and we make sure there's a backup path so the meeting still happens. After it's fixed, we write up what went wrong and add it to a profile so the next time it never gets that close."

## 10. Internal technician notes
- VIP list lives under HR + IT joint-ownership; refresh after every org chart change.
- Auto-route inbound calls from the VIP / EA phone numbers to the L2 queue, never L1.
- For C-suite, build a Conditional Access policy that *excludes* their accounts from the most aggressive risk policies (with compensating controls — token-bound device, hardware key) so they're never blocked at a wedding/demo/board meeting.
- Have a "break-glass" admin password sealed with a date stamp; if a tech opens it during a VIP incident, force a password rotation after.
- Telemetry: tag VIP tickets with `vip=true` so they show up on a separate SLA report.

## 11. Related KB articles
- l1-mfa-001 — MFA recovery (VIPs hit this most).
- l2-onboarding-001 — New executive provisioning.
- l3-security-001 — Incident response (most VIP issues escalate here).

## 12. Keywords / search tags
vip, executive support, white glove, c-suite, board member, personal assistant, desk-side, priority response, vvip, travel support, ceo, cfo, coo, board meeting, demo
