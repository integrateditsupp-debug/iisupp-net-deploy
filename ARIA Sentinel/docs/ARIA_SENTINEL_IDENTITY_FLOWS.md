# ARIA Sentinel Identity Flows

Audit timestamp: 2026-07-06 22:20 ET

## Current Truth

The codebase has Microsoft Entra scaffolding and tests for read-only probes plus limited high-risk remediation primitives (`revokeSignInSessions`, `forcePasswordChange`). It does not yet have a production-ready account unlock or password reset flow. That is correct and safer than a fake unlock/reset.

## Account Unlock Target Flow

1. User requests unlock from ARIA Central or a future lock-screen helper.
2. ARIA collects approved identity fields only: user ID, full name, employee ID, manager name, secret answers, and optional ID upload if customer policy permits.
3. Uploaded ID stays local unless customer policy explicitly approves secure upload.
4. ARIA verifies exact target, active account, employee ID, manager match, secret answers, lock state, rate limit, and suspicious attempt rules.
5. If all checks pass in the approved tenant, ARIA unlocks or runs the correct customer-defined equivalent.
6. If any check fails, ARIA refuses, explains verification failed, offers live support, and logs the failure safely.

## Password Reset Target Flow

1. Use the same identity verification as unlock.
2. Prefer secure one-time reset link or temporary forced-change credential.
3. Never email a permanent password.
4. Manager notification must use approved company channel and template.
5. User is told to contact manager/admin through approved channel.
6. All success/failure paths are logged without secrets.

## Required Controls Before Implementation Is GREEN

- Safe Microsoft Entra/AD test tenant.
- Test users with locked/resettable states.
- Admin-consented scopes and least-privilege app registration.
- RBAC and policy controls in admin dashboard.
- Rate limits and abuse lockouts.
- Secret question storage/verifier design.
- Local ID name-matching design and retention policy.
- Manager email template and secure delivery provider.
- Automated success/failure/abuse tests.
- Manual security review.

## Current Status

| Flow | Status | Reason |
|---|---|---|
| Read-only directory health | YELLOW | Entra scaffold exists; needs tenant config for live proof. |
| Revoke sessions / force password change primitive | BLOCKED | High-risk write needs test tenant/admin approval. |
| Account unlock | BLOCKED | No safe tenant/policy/verification model yet. |
| Password reset | BLOCKED | No safe tenant/policy/manager notification model yet. |
| Secret question verification | RED | Not implemented. |
| Uploaded ID matching | RED | Not implemented. |
| Manager verification/notification | RED/BLOCKED | Needs directory/policy/mail provider. |

