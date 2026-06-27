# ARIA Sentinel 0.1.19 Release Notes

Date: 2026-06-27  
Audience: Internal pilot, founder-led enterprise demos, flagship live-scenario testing

## Status

ARIA Sentinel 0.1.19 is the **flagship "supported case" + proactive-resolve** line. It turns the read-only
integrations into the full, **gated** case lifecycle — ServiceNow ticketing writes, Entra remediation,
end-to-end orchestration, and background self-resolution of safe issues — all read-back-verified and honest
by construction (RULE 14). Built on the 0.1.18 secure-credentials base. No-cost, unsigned Windows MVP.

## What's new — 4 modules

- **M1 · ServiceNow WRITE ticket lifecycle** (`servicenow.mjs`). Gated Table-API writes: create **Interaction**
  → create linked **Incident** (correlation_id) → update work notes → **resolve/close** with close notes →
  close the Interaction. Every write **refuses without approval**, **flags a missing instance / write-role or a
  401/403** instead of faking, and is **read-back-verified** — the reported ticket number comes from a real GET,
  never invented; an unconfirmed write is reported as "unverified", never success.
- **M2 · Entra gated remediation** (`entra-graph-client.mjs`). `remediateUser` does **revokeSignInSessions**
  (force re-auth) or **forcePasswordChange** — **honestly labeled**: a cloud Entra account is never "locked"
  like on-prem AD, so there is no fake "unlocked". Requires **exact target** (GUID/UPN or STOP), **approval**,
  and the consented **write scope** — a 401/403 returns **"Not authorized"**, never a faked success. Read-back
  GET confirms; carries a truthful rollback note.
- **M3 · Case orchestration** (`case-orchestrator.mjs`). web "Resolve it for me" → `aria-sentinel://` handoff →
  case → M1 Interaction+Incident → M2 remediation on the test user → **on a verified fix only**, resolve+close
  the incident → fire the existing **session-end email** with the case summary + real SLA. Outcome is
  **"resolved" only when the fix verified**; otherwise **"escalated"** (the email says escalated, never fixed).
  IPC `sentinel:run-support-case`.
- **M4 · Proactive silent resolution + user summary** (`proactive-resolve.mjs`). For **safe (green),
  non-destructive** issues, and **only in Confirmed/Autonomous** mode, ARIA resolves in the background (no
  prompt), logs a ServiceNow ticket per fix (M1), and on a cadence emails the user: *"ARIA resolved X and
  prevented Y so you weren't bothered."* **Risky/destructive fixes are never auto-run**; the summary counts
  only what actually ran (a failure is "needs attention", never "fixed"). IPC `sentinel:proactive-summary`.

## Safety / honesty (structural, RULE 14)

- Every write is **gated** (no approval → no network) and **read-back-verified**.
- **No fabricated ticket numbers, no fake "unlocked".** Missing ServiceNow instance/write-role or Entra write
  scope is surfaced as a flagged gap, not faked.
- Remediation requires an **exact** user target or it STOPs. Nothing is autonomous on a risky write.
- Write bodies stay **content-blind** (assertContentSafePayload + symbolic notes). 🔒 R11 unaffected.

## Tests

- 4 new suites — `servicenow-write` (8), `entra-remediation` (9), `case-orchestrator` (5), `proactive-resolve`
  (8) — locking gating, honest failure modes, read-back verification, and content-safety. Full suite
  **194/194 green**.

## Operator configuration (instance/tenant — not Sentinel code)

See `sales/setup-video-guides/05-flagship-write-role-and-notifications.md`:
- ServiceNow write-enabled integration user (itil / interaction write role).
- Entra write scope (`User.RevokeSessions.All` / `User.ReadWrite.All`) + admin consent + a test user.
- ServiceNow **email notification rule** (incident created/resolved → `integrateditsupp@gmail.com`) — the
  company-side notification; ARIA's own session-end email is separate and already built.

## Not in this build (tracked follow-ups)

- Code signing (unsigned MVP; locally grantable). The dedicated Dynamics/Dataverse read connector.
- The renderer "case" UI surface is minimal — the case runs via the orchestrator IPC + the existing
  Resolve/handoff and session-email surfaces; a dedicated case timeline view is a follow-up.

## Build / deploy note

`npm run package:win` runs on Ahmad's machine; customer build excludes admin-console, tests, fixtures,
design-review, docs and `axis/`. Installed locally for on-device testing only — no OTA publish, no binary upload.
