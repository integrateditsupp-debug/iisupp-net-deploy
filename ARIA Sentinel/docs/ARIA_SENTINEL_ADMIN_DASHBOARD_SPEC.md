# ARIA Sentinel Admin Dashboard Spec

Audit timestamp: 2026-07-06 22:20 ET

## Current Evidence

`admin-console/index.html` includes views for overview, release gate, endpoints, policies, recipes, KB bundles, stop codes, audit events, reports, integrations, settings, access, Grant Asset RDP Access, system, updates, fleet performance, quarterly reports, cohort SLA, and licenses. Several update/license paths call admin-token-gated Netlify functions. Much of the fleet data is synthetic/mock until live backend wiring is completed.

## Required Views

- Users/devices.
- Detected issues.
- Running app alerts.
- Browser alerts.
- Application alerts.
- Account unlock requests.
- Password reset requests.
- Autonomous actions attempted.
- Successful fixes.
- Failed fixes.
- Manual walkthrough usage.
- Live agent escalations.
- Security warnings.
- Malicious-site overrides.
- Policy settings.
- Risk settings.
- Audit logs.
- Integration health.

## Required Admin Settings

- Support phone/email/escalation path.
- Autonomous mode availability.
- Allowed low-risk actions.
- Allowed medium-risk actions.
- High-risk approval rules.
- Browser override policy.
- Identity verification requirements.
- Manager email templates.
- Log retention.
- App-specific runbooks.

## Current Status

YELLOW. The UI shell is broad and useful for demos, but production admin readiness requires live tenant RBAC, backend persistence, customer-owned secrets, audit export, and policy enforcement tied into every local/extension action.

## RDP Access Tab Boundary

The current `Grant Asset RDP Access` view is policy-only. It must remain disabled for live grants until signed endpoint service, customer authority, admin RBAC, expiration/revoke cleanup, and audit storage exist. It must not claim it can recover files from powered-off, pre-boot, BitLocker-locked, or blue-screen states without a reachable recovery environment.

