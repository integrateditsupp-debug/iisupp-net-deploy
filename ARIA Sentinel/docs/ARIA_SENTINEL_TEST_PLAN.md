# ARIA Sentinel Test Plan

Audit timestamp: 2026-07-06 22:20 ET

## Current Automated Coverage

`tests/run-all.mjs` currently lists 228 suites. Recent verified runs before this documentation pass showed the suite green after Resolution/File Association work. Coverage includes extension, privacy, recipes, Tier-0, autonomous guards, process detectors, Windows error sweep, ARIA Chat readability/alignment, common-call demo, RDP policy module, Office safety, Entra client scaffolding, admin console tabs, license/update paths, and release gates.

## Required Browser Tests

- Cache clear and reload.
- Monitoring toggle on/off.
- 404 detection.
- Certificate error detection.
- Proxy error detection.
- DNS/network detection.
- Malicious site warning.
- Override flow with policy.
- Vendor/outage classification.
- Manual walkthrough launch.
- Autonomous fix success/failure.

Current status: partial. Add missing live-extension E2E tests for browser error classes and malicious-site policy.

## Required Desktop Tests

- Running app scan.
- Event log scan.
- App crash detection.
- System vs app classification.
- Office issue detection.
- Safe remediation.
- Failed remediation.
- Logging/Fix History.

Current status: strong local coverage, but app-specific vendor tests should expand.

## Required Identity Tests

- Valid account unlock.
- Invalid user ID.
- Wrong secret questions.
- Wrong manager.
- Mismatched ID name.
- Inactive account.
- Already unlocked account.
- Locked account.
- Password reset success/failure.
- Manager email success/failure.
- Rate limit abuse.
- Audit logs.

Current status: BLOCKED until safe test tenant and policy are available. Existing Entra tests are scaffolding, not production identity proof.

## Required Admin Tests

- Policy changes.
- Role permissions.
- High-risk action approval.
- Logs visible.
- Export/reporting.
- Browser override policy.
- RDP grant unavailable until configured.

Current status: partial/static shell tests exist; live RBAC/backend tests missing.

## Required E2E Tests

- Browser issue -> alert -> autonomous fix -> verify -> log.
- Browser issue -> manual walkthrough -> resolved -> log.
- App issue -> event log -> classification -> fix prompt.
- Office changed file -> backup -> validation -> retry -> status.
- File association drift -> detection -> globe prompt -> approved settings path -> log.
- Account locked -> ARIA identity verification -> unlock -> log. BLOCKED.
- Password reset -> verification -> manager notification -> log. BLOCKED.

