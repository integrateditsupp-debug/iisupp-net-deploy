# ARIA Sentinel Product Vision and Gap Review

Date: 2026-06-27
Scope: Windows-first ARIA Sentinel desktop, ARIA web parity, SaaS readiness, and customer-facing claim hygiene.

## Purpose

ARIA Sentinel is the Windows-first desktop version of ARIA: a resident, privacy-aware IT support agent that watches for endpoint problems, explains them in plain English, and routes the user into one of three safe outcomes:

- Guided walkthrough: the user stays in control and follows short steps.
- Confirmed fix: Sentinel prepares a local or connector-backed action and runs it only after approval.
- Autonomous mode: explicit opt-in only, limited to low-risk green recipes, with cooldowns, caps, audit logs, and a kill switch.

The original vision was a persistent on-device resolver: a floating globe that detects crashes, errors, and friction; BSOD recovery hooks; local-first diagnostics; and escalation to a human when automation is unsafe. The commercial vision is a SaaS-style support layer for businesses, MSPs, and eventually individual users, starting on Windows and expanding later to browser, macOS, and mobile surfaces.

## Current Product Truth

- Desktop package is at 0.1.20, and the local Sentinel suite passed 195/195 tests in this review pass.
- "Resolve it for me" exists in Sentinel desktop as a gated local control-plane path, not as a browser-only web fix.
- Licensing is server-side: the desktop does not carry `SENTINEL_LICENSE_SECRET`; it resolves through the Netlify `sentinel-resolve` function and caches only hash/status data locally.
- Enterprise connector work exists for ServiceNow, Entra, profile/session email, encrypted local connector credentials, evidence packs, audit integrity, weekly digests, status pages, and admin surfaces.
- AXIS is still a voice-layer scaffold. Wake word, speaker lock, STT, encrypted brain, and TTS round-trip must be treated as roadmap/prototype unless implemented and tested.

## Issues Found In This Review

- Web ARIA still shipped a source-level fake auto-resolution path: hardcoded "AUDIT TRAIL - LIVE", device IDs, downtime saved, ticket cost, and a final "Done" card. A runtime transform tried to gray it out, but that was fragile.
- The Sentinel sales one-pager said "no credential storage" even though optional encrypted connector credentials now exist. The safer claim is no plaintext credential storage.
- The same one-pager said no autonomous action without explicit permission, but the real product has opt-in Autonomous mode. The accurate claim is off-by-default autonomy with confirmation for higher-risk actions.
- The RUN 24 funnel checklist still labeled a client-license-secret issue as a hard blocker even though current builds use server-side license resolve.
- Roadmap and audit files mix historical state, completed work, and remaining blockers. That creates real risk of a builder or salesperson making stale claims.

## Changes Completed

- Replaced the web "Resolve it for me" flow with an approval-ready preview path. It now says no device change was run from the web page and points execution to Sentinel desktop or IIS.
- Updated the web transform from "COMING SOON" disabling to a non-blocking "PREVIEW" badge.
- Corrected the Sentinel one-pager autonomy and credential-storage claims.
- Added a dated note to the funnel checklist marking the old client-secret blocker as resolved in current builds.

## Highest-Leverage Next Work

1. Windows launch hardening: Authenticode signing, installer trust flow, SmartScreen notes, MSI/Intune packaging, and a real Windows VM install/uninstall test.
2. First paid pilot package: one-page SOW, DPA/EULA/SLA review, pilot success criteria, install checklist, rollback checklist, and weekly value report template.
3. Live funnel smoke: Stripe test purchase to license email to installer download to license activation to revocation downgrade.
4. Claims cleanup pass: client-facing docs should say "Windows-first", "approved connector workflows", "encrypted local connector credentials", and "Autonomous mode off by default".
5. AXIS boundary: keep voice as prototype/roadmap until wake gate, speaker lock, STT, TTS, privacy indicators, and no-transcript-before-wake tests exist.
6. SaaS admin maturity: RBAC, tenant isolation proof, audit export, support handoff workflow, status page, and admin onboarding screenshots should be packaged into one buyer evidence folder.

## CEO Final-Action Readiness

Ready for Ahmad review now:

- Decision received 2026-06-27: corrected wording and one-pager claim cleanup are approved.
- Production push/publish is explicitly held for now; do not deploy these changes until Ahmad gives a separate publish/push approval.
- Decide whether the first commercial push is "Sentinel paid pilot" or "AI Help Desk Blueprint implementation" so pricing and SOW drafts can be aligned.
