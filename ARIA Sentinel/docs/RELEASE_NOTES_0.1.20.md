# ARIA Sentinel 0.1.20 Release Notes

Date: 2026-06-27  
Audience: Internal pilot, founder-led enterprise demos, flagship live-scenario testing

## Status

ARIA Sentinel 0.1.20 fixes the **audit-tamper FALSE ALARM on version upgrade** and carries forward the
0.1.19 flagship "supported case + proactive-resolve" modules. No-cost, unsigned Windows MVP.

## What's fixed

- **Audit integrity no longer false-alarms on an app update.** Previously, installing a new build (which
  kills the old app and re-launches the new one) could trip the tamper-evident hash chain and show
  *"Security alert: Audit log tampered"* even though nothing was tampered — it was just an upgrade. The seal
  is now **version-stamped** (`appVersion`), and at session start the verifier distinguishes:
  - **Version upgrade** (the stored seal's version differs, or it's a legacy version-less seal) → the chain
    is **re-sealed silently** and logged as benign `AUDIT` maintenance — **no tamper alert, no banner**.
  - **Same build, off-app edit** of the on-disk log → still raises the **SECURITY** alert + admin banner.
  So real tampering is still caught; only the upgrade false positive is removed. (`classifyIntegrity` in
  `src/shared/audit-integrity.mjs`; `verifyAuditIntegrity` in `main.mjs` uses the real build version via
  `app.getVersion()`.)
- New suite `tests/audit-version-migration.test.mjs` (8 cases) locks: upgrade re-seals silently, legacy seal
  migrates, and a same-version modify/truncate still alerts. Full suite **195/195 green**.

## Carry-forward (0.1.19 → 0.1.20)

- The 4 flagship modules — ServiceNow WRITE ticket lifecycle, Entra gated remediation (honest cloud labels),
  case orchestration, and proactive silent-resolve + user summary — plus the secure safeStorage credentials
  form and W5 Integrations tab, are all carried forward and green.

## Safety / honesty (RULE 14)

- Tamper detection is **preserved** — a real, same-version edit of the audit log still alerts the admin. The
  fix only removes the upgrade false positive; it never weakens detection of genuine tampering.
- All flagship writes remain gated + read-back-verified; missing ServiceNow instance / Entra scope is flagged,
  never faked. 🔒 R11 unaffected.

## Not in this build (tracked follow-ups)

- Code signing (unsigned MVP; locally grantable). The dedicated Dynamics/Dataverse read connector.
- The live customer run (real ServiceNow/Entra) + its screenshots remain Cowork's computer-use step with
  Ahmad's provisioned creds (in progress).

## Build / deploy note

`npm run package:win` runs on Ahmad's machine; the customer build excludes admin-console, tests, fixtures,
design-review, docs and `axis/`. Installed locally for on-device testing only — no OTA publish.
