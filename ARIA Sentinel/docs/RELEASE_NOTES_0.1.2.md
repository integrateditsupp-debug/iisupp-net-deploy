# ARIA Sentinel 0.1.2 Release Notes

Date: 2026-06-22  
Audience: Internal pilot, founder-led enterprise demos, controlled technical review

## Status

ARIA Sentinel 0.1.2 is the auto-license-funnel + hardening release on the 0.1.x line. It wires the desktop to the live licensing backend (keys are minted by Stripe and verified server-side — the secret never ships in the .exe), flips the execution defaults to match the chosen Mode, and adds a $0 content-blind crash reporter. It remains a no-cost, unsigned Windows MVP with a Chromium extension companion — ready for local internal testing and demo walkthroughs, not yet broad enterprise deployment (code signing, MSI/Intune packaging, live ServiceNow OAuth, encrypted KB storage, production rollback validation, legal review and external security testing are still pending).

## What's new

- **Server-side license resolve (RUN 24-A6).** The desktop never holds `SENTINEL_LICENSE_SECRET`; it POSTs the pasted key to the `sentinel-resolve` function, which resolves the plan + checks revocation server-side and returns only `{ plan, status }`. The verdict is cached locally (hash-only, no raw key) with graceful offline degradation — fresh ≤24h, "reconnect" nudge 24–72h, Personal fallback >72h.
- **Auto-license funnel (RUN 24-A1…A5).** Stripe webhook mints an HMAC license key → persists to the registry → emails the customer their key + the admin a notify; an admin "Licenses" tab lists / searches / resends / revokes / exports.
- **Mode-based execution defaults (RUN 29-A).** Dry-run is now keyed to the Mode: Manual keeps the dry-run safety ON (a fix only previews unless you opt in); Confirmed and Autonomous default to real execution. Every real execution is still gated by the supervisor critic + the 10-second countdown + the Ctrl+Alt+K kill-switch.
- **$0 crash reporter (RUN 29-D).** Uncaught errors are captured to a local queue and best-effort forwarded to the `sentinel-crash` sink on next launch — content-blind (no file contents, no screen pixels, no raw paths), R11-scrubbed, and it never blocks the UI.
- **First-run onboarding state (RUN 29-C).** Walkthrough state that shows once on a fresh install and never replays after the user completes or skips it.

## Safety Defaults

- Manual mode is the default install mode and keeps its dry-run preview safety.
- Real execution (Confirmed/Autonomous) always requires supervisor approval + the 10-second countdown + the kill-switch; a per-invocation override can force dry-run back on at any time.
- `SENTINEL_LICENSE_SECRET` is server-side only and is never bundled into the .exe.
- Raw endpoint/user content is not sent to AI APIs; telemetry stays content-blind on the 6-host allowlist.
- ServiceNow live posting remains disabled until customer OAuth configuration exists.
- 🔒 R11: the personal `Private pics and Vids` folder is never read, listed, scanned or referenced.

## Remaining Blocks Before Paid Enterprise Launch

- Windows Authenticode certificate and SmartScreen reputation path (decision documented in `docs/code-signing-decision.md`; no spend yet).
- MSI/SCCM/Intune packaging and silent install switches.
- Live ServiceNow OAuth app and customer assignment group mapping.
- Encrypted local KB store.
- Full rollback execution test matrix on real Windows pilot machines.
- External penetration test/security assessment.
- Legal DPA/EULA/SLA package.
