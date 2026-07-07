# ARIA Sentinel Security Model

Audit timestamp: 2026-07-06 22:20 ET

## Non-Negotiable Rules

- No hidden autonomous changes.
- No permanent plaintext password storage.
- No fake unlock, fake reset, or fake live execution claims.
- No raw document text, credentials, file paths, URLs, or user content sent to AI APIs.
- No silent Windows default-app registry/UserChoice writes.
- No RDP or directory access grant without customer-owned authority, RBAC, expiration, revoke path, and audit.
- No broad production launch without signing, security review, legal review, and pilot evidence.

## Risk Levels

| Risk | Examples | Minimum Gate |
|---|---|---|
| Low | reload page, clear current-origin browser cache, read diagnostics, open walkthrough, list top CPU processes | May run in Autonomous if admin policy permits and verification/audit exists. |
| Medium | restart local app/service, clear app cache, repair profile, reset plugin settings, collect event logs | Confirmed mode or stronger; preflight, explicit approval, rollback/safe failure, audit. |
| High | unlock/reset account, change security settings, grant RDP, modify system configuration, disable security, bypass warning | Identity/admin verification, customer policy, RBAC, rate limiting, audit, test-tenant proof, explicit approval. |

## Identity Safety

Identity flows must include:

- Exact target user check.
- Directory-active and lock/reset eligibility checks.
- Employee/manager/secret-question policy verification where approved.
- Rate limiting and abuse detection.
- Local-only ID handling unless secure upload is explicitly approved.
- Manager notification only through approved company channel.
- Temporary forced-change credential or one-time reset link; never permanent password email.
- Full audit of success and failure without secrets.

Current status: production identity flows are BLOCKED until a safe test tenant and policy are available.

## Audit Requirements

Every action must record:

- Who/actor class.
- Device/session handle, content-blind.
- Signal/issue id.
- Requested mode.
- Risk level.
- Approval path.
- Preflight result.
- Execution result.
- Verification result.
- Rollback or safe-failure note.
- Timestamp.

## Abuse Prevention

- Rate-limit repeated identity and autonomous action attempts.
- Reject ambiguous identity targets.
- Keep high-risk actions unavailable in demo/static mode.
- Make malicious-site override admin-configurable and logged.
- Preserve kill-switch and cancel countdown for any local action with impact.

