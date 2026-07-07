# ARIA Sentinel Master PRD

Audit timestamp: 2026-07-06 22:20 ET

## Product Position

ARIA Sentinel is a local-first autonomous IT support platform made of:

- Electron desktop app: ARIA Central, floating globe, local bridge, diagnostics, recipes, audit, Office safety, and user modes.
- Browser extensions: Chrome and Edge MV3 companion surfaces for site-specific browser detection and safe browser fixes.
- Admin console: local/static admin shell plus token-gated Netlify endpoints for licensing, updates, and future fleet operations.
- Knowledge/runbook system: structured recipes, Tier-0 safe-generic fixes, ARIA Chat, and issue-specific walkthroughs.
- Enterprise connectors: ServiceNow, Microsoft Entra/M365, CRM, RSA, Slack/Teams, and remote-assist scaffolds where customer configuration is required.

The product must never behave as a hidden admin backdoor. It explains, asks, executes only within policy, verifies, reports, and logs.

## North-Star UX

When Sentinel detects an issue, the floating ARIA globe should show a calm card:

- "Here is the issue we found."
- "Would you like me to resolve it?"
- Autonomous: "We will resolve it for you."
- Manual: "Take me to a walkthrough."
- Live help: show the configured support number or escalation path.

Manual opens ARIA Chat in ARIA Central with the exact issue context and a step-by-step walkthrough. Autonomous uses the approved action path, verifies the result, and writes an audit/troubleshoot history entry.

## Modes

- Manual: default. Sentinel detects and guides. No automatic system changes.
- Confirmed: Sentinel stages approved fixes and runs after explicit user approval/countdown.
- Autonomous: opt-in. Only low-risk actions may run silently; medium/high-risk actions still require confirmation, admin policy, or escalation.

## MVP Scope

MVP pilot scope is allowed only for:

- Local desktop diagnostics and read-only detection.
- Resolution tab with searchable fixes and real-or-empty Fix History.
- Browser cache/service-worker scoped fixes.
- ARIA Chat guided answers and issue-specific walkthroughs.
- Office File Safety Net local backup/validation.
- Proactive user-error guard for `.txt` default-app drift, using notify-and-open-settings, not silent registry writes.
- Demo lab/live capture proof mode clearly marked as demo/simulation.

MVP pilot must not include real account unlock/password reset, live RDP grants, malicious-site override enforcement, or production directory writes until those flows pass test-tenant validation and policy review.

## Core Requirements

| Area | Requirement |
|---|---|
| Browser | Detect browser/site errors, show clear prompt, offer resolve/manual/live paths, keep fixes scoped to current origin. |
| Desktop | List running apps, read event/error signals, classify local/system/app/browser/network/vendor/identity issues, trigger globe prompts. |
| Runbooks | Every fix maps to issue name, detection signal, cause, eligibility, manual steps, permissions, rollback/safe failure, escalation, and tests. |
| Autonomous engine | Detect -> diagnose -> ask/approve -> execute -> verify -> report -> log. |
| Identity | Test-tenant first, identity verification first, no permanent plaintext passwords, rate-limited, admin policy controlled. |
| Admin | Show users/devices/issues/actions/logs/policy/integration health; writes require live authenticated backend and explicit approval. |
| Security | RBAC, least privilege, audit logs, secret redaction, content-blind telemetry, no hidden changes, no bypass claims. |
| Observability | Structured logs, action history, extension/desktop health, failed automation tracking, privacy-safe metrics. |
| Release | Signed installer/store submissions/legal/pen test/customer pilot gates before broad production launch. |

## Acceptance Criteria

An item can be marked GREEN only when it is implemented, integrated, tested, documented, and not dependent on an unproven credentialed production path. Partial code, static mock UI, or test-only adapters are YELLOW. Missing or unsafe capability is RED. Missing credentials/access/customer policy/test tenant is BLOCKED.

