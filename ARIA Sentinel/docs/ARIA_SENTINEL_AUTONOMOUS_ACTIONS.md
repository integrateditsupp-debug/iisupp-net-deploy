# ARIA Sentinel Autonomous Actions

Audit timestamp: 2026-07-06 22:20 ET

## Required Action Contract

No autonomous action may ship unless it has:

- Trigger.
- Diagnosis.
- User prompt or documented silent eligibility.
- Execution path.
- Verification path.
- Rollback or safe-failure path where possible.
- Audit event.
- Test coverage.
- Risk level.
- Policy requirement.

## Current Registry Snapshot

| Action | Risk | Status | Evidence | Missing Before Broad Launch |
|---|---|---|---|---|
| Clear current-origin browser cache and reload | Low/Medium | YELLOW | Extension `background.js`, recipes, extension tests | Complete browser-class prompts/manual fallback and live E2E. |
| Reload/retry page without cache | Low | YELLOW | Extension background reload path | Tie to 404/DNS/proxy/cert detection matrix. |
| Open ARIA walkthrough | Low | GREEN | ARIA Chat/readable answer/Resolution UI tests | Expand exact-step state for every runbook. |
| Flush DNS | Low/Medium | GREEN for controlled local/Tier-0 scope | Tier-0 catalog/tests | Keep policy-gated; verify on pilot endpoints. |
| Restart safe local services | Medium | YELLOW | Tier-0 service recipes/tests | Require customer policy and rollback/safe failure docs. |
| Office rescue backup/validate | Low | GREEN for local backup scope | `office-file-safety`, `office-safety-service`, tests | Restore UI/fleet reporting/encrypted vault remain future. |
| `.txt` Adobe/Notepad association warning | Low | GREEN for warning/listing | `file-association-guard`, recipes/tests | Pre-commit prevention requires shell/policy hook. |
| `.txt` default app correction | Medium | YELLOW | Opens Windows Default Apps via user-approved path | Do not silently write registry; needs customer policy for stronger endpoint control. |
| ServiceNow incident draft | Low/Medium | YELLOW | ServiceNow modules/tests | Live customer config and OAuth required. |
| Entra revoke sessions / force password change | High | BLOCKED | `entra-graph-client.mjs` scaffolding/tests | Safe test tenant, approval, RBAC, rate limit, manager policy. |
| Account unlock | High | BLOCKED | No fake unlock; case orchestrator stops when target absent | Test tenant and full identity verification flow. |
| RDP grant asset access | High | BLOCKED | `rdp-access.mjs` policy module/tests; admin static tab | Signed endpoint service, customer-owned authority, expiration/revoke, live audit. |

## Autonomy Ladder

- Manual: show recommendation and walkthrough only.
- Confirmed: stage a safe action, require explicit approval, then verify and log.
- Autonomous: only low-risk, policy-approved, verified, rate-limited actions may run without asking. Anything medium/high risk falls back to Confirmed or escalates.

