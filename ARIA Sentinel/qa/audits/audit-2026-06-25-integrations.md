# ARIA Sentinel — Integration Audit (2026-06-25)

**Auditor:** Cowork · **Build:** main (depth-1 clone) · **Method:** code-presence + automated test suites, Node v22 sandbox. Live-tenant + live-app portions gated (below).

## Integrations present in code
- Microsoft Entra / Graph (directory): `src/shared/entra-graph-client.mjs` + `directory.mjs` — OK
- ServiceNow — 12 files — OK
- IDV (PingOne / RSA / verifier middleman) — 15 files — OK
- Outlook / Exchange (+ Proofpoint-style secure delivery) — 7 files — OK

## Automated results (REAL, this run)
- `directory.test.mjs` — PASS (16 groups): read-only, content-blind, target-certainty, never-autonomous, admin-approval, IDV verified/unverified, manager reports-to, no-plaintext-password, biometric-never-reaches-brain, idempotent, network-drop, read-back-mismatch -> auto-rollback, permission/token failures, least-privilege, tamper-evident audit.
- `entra-graph-client.test.mjs` — PASS (8 groups): client-credentials token+cache+refresh, least-privilege `.default` scope, read-only Graph mapped to shape, secret never leaked, writes gated, end-to-end content-blind via directory.mjs, smoke flags unconfigured creds.
- Full suite (`run-all.mjs`) — **194 / 194 PASS**.

## Verdict (code/test level)
All discussed new integrations are PRESENT and FUNCTIONAL at the contract/test level, full cannot-mess-up protocol verified, no regressions.

## Gated / NOT-tested (recorded for tracking)
- **Live directory read vs a real tenant** — blocked: `DIRECTORY_TENANT_ID/CLIENT_ID/CLIENT_SECRET` not set; Azure MCP auth timing out. `graphReadOnlySmoke` returns configured:false.
- **Live ARIA Sentinel app pass (modes/scenarios on-device)** — deferred: desktop busy with the linkedin-easy-apply browser session; will not hijack a running agent task.
- **Azure MCP** `subscription_list` — timed out (auth not established).

## To close
- Ahmad: complete Azure sign-in + set the 3 `DIRECTORY_*` env vars -> live Graph read can run + be documented.
- Free desktop -> live Sentinel mode/scenario pass (Phase-5) + documented.
