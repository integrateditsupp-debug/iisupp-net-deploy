# ARIA Sentinel Architecture

Audit timestamp: 2026-07-06 22:20 ET

## Components

| Component | Responsibility | Current State |
|---|---|---|
| Electron main process | Local bridge, IPC, detectors, Office safety, recipes, audit, packaged app lifecycle | Implemented in `src/main`. |
| Renderer / ARIA Central | Tabs, ARIA Chat, Resolution, Fix History, mode controls, Integrations, Control Center | Implemented in `src/renderer`. |
| Floating globe overlay | Ambient assistant, issue prompt, self-diagnose/self-repair entry | Implemented in `src/renderer/overlay.*`. |
| Chrome/Edge extension | In-page globe, current-origin browser fixes, bridge status, popup | Implemented with partial browser issue coverage. |
| Recipe/runbook core | Structured issue/fix registry, risk, actions, matching, walkthrough text | Implemented in `src/shared/recipes.mjs` and Tier-0 recipes. |
| Autonomous plan engine | Plan validation, hash-chained journal, supervisor checks, rollback ordering | Implemented as Stage-3 foundation; broader execution remains gated. |
| Admin console | Owner/admin views for fleet, policies, audit, access, updates, licenses | Static/local shell plus some token-gated endpoint calls. |
| Netlify functions | Public recipe/update/license/admin endpoints | Implemented for several lanes, customer config required for live use. |
| Obsidian/coordination docs | Human and agent memory/handoff | Updated separately after this pass. |

## Data Flow

1. Local detector or browser extension produces a symbolic signal.
2. Signal is sanitized/content-blinded before storage or network boundary.
3. ARIA Central maps signal to recipe/runbook or ARIA Chat answer.
4. User chooses Manual, Confirmed, Autonomous, or Live help.
5. Execution path checks mode, risk, admin policy, preflight, countdown/supervisor, and kill switch.
6. Result is verified where possible.
7. Outcome is written to audit/transparency log and surfaced in Fix History.

## Local vs Cloud Boundary

Local-only:

- Office backups and validation copies.
- File association scans.
- Windows event/process/system checks.
- User-facing ARIA Central state.
- Dry-run/confirmed local recipes.
- Audit/Fix History source logs.

Cloud/backend allowed only with policy:

- License resolution.
- Signed recipe/update bundles.
- ServiceNow incident drafts/live actions when configured.
- Customer-approved integration health checks.
- Future fleet/admin telemetry with content-blind schema.

High-risk identity and remote access writes must not run from static UI or demo code. They require customer-owned authority, tenant credentials, RBAC, approval logs, and safe test-tenant validation.

## Permission Boundaries

- User mode: read local diagnostics, open walkthroughs, request approved fixes.
- Admin mode: configure policy, support number, allowed risk levels, integration settings.
- System/service mode: execute only signed/allowlisted actions with local policy and audit.
- External/customer authority: owns directory writes, RDP grants, manager notifications, and production secrets.

