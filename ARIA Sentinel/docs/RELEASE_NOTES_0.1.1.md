# ARIA Sentinel 0.1.1 Release Notes

Date: 2026-06-22  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.1 is a maintenance + UX release on the 0.1.0 MVP line. It adds the auto-OTA update pipeline and a consolidated settings UI. It remains a no-cost, unsigned Windows MVP with a Chromium extension companion — ready for local internal testing and demo walkthroughs, not yet broad enterprise deployment (code signing, MSI/Intune packaging, live ServiceNow OAuth, encrypted KB storage, production rollback validation, legal review and external security testing are still pending).

## What's new

- **Auto-OTA pipeline (RUN 23c).** GitHub Releases publisher, signed update manifest, version-bump tooling and a one-click admin publish button. Auto-update stays opt-out and content-blind.
- **Tier-0 executor binding (RUN 23b).** Five vetted safe-generic recipes can go live, gated by the supervisor critic + the 10-second countdown.
- **Self-service loop (RUN 23).** Process detectors, supervisor critic, countdown gate and quarterly cron.
- **Consolidated settings UI (RUN 23d).** The settings shell went from 17 tabs to 9: Dashboard (Overview + Performance + SLA), Compliance & Privacy, System (This Machine + Platform Support) and Settings (Mode + Hotkeys + Troubleshoot + Support + About). ServiceNow keeps its own tab. Old deep-links redirect to the new section anchors, so nothing breaks.

## Safety Defaults (unchanged)

- Manual mode is the default install mode.
- OS-changing actions are dry-run by default unless `ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=1` is deliberately set.
- Raw endpoint/user content is not sent to AI APIs; telemetry stays content-blind on the 6-host allowlist.
- ServiceNow live posting remains disabled until customer OAuth configuration exists.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path.
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
