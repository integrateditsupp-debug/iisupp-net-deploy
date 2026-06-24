# RUN 11 Report — MSP/RMM table stakes: patch + remote control + multi-tenant + PWA

**Date:** 2026-06-19 · **Suite:** 36/36 green · **`node --check`:** clean · **Deps added:** 0 · **Published:** nothing

## Built
- **Patch management v1** — `src/shared/patch-management.mjs`: 6 vendors (Chrome · Edge · Firefox · Adobe · Zoom · Java) version-checked against a **dedicated pinned `PATCH_VENDOR_ALLOWLIST`** (official hosts, GET-only, version-string only) + Windows-update count. `patchNeeded` / `buildPatchPlan` → one `PATCH.AVAILABLE` signal and **`requiresRestorePoint: true`** before any install. New `patch-available-v1` recipe (yellow, confirm in Manual/Confirmed; restore-point before install). The content-blind telemetry verifier allowlist stays at 6 hosts (unchanged) — patch version-checks are a separate, documented outbound class, so sanitization rules were not widened.
- **Remote control** — `src/shared/remote-control.mjs`: Whereby-host-pinned, https-only, **10-minute** scoped session, **`recording:false` + `keystrokeCapture:false`** (privacy R7). Tray gains "Allow remote control (10 min)" / "End remote control" (driven by `WHEREBY_URL`).
- **Multi-tenant dashboard** — `src/shared/fleet.mjs`: `aggregateFleet` (one row per customer: handle · endpoints · health avg · fixes/week · last seen), `filterFleet`, `fleetTotals`. **Handles only, per R11** — a real name passed in is dropped. Admin Overview grid upgraded to per-customer rows with last-seen + click-to-drill.
- **PWA-responsive admin** — `admin-console/manifest.webmanifest` + `service-worker.js` (install/activate/fetch, offline shell fallback) + SW registration + phone breakpoints (`@media max-width:720px`). "Add to Home Screen" works; no native app.

## Tests (33 → 36 suites)
- `patch-management.test.mjs` (new) — 6 vendors, pinned-host allowlist (+ suffix-spoof rejection), version compare, **restore-point-before-install** contract, content-blind plan.
- `multi-tenant.test.mjs` (new) — fleet aggregation math, handle-only privacy (real name never surfaces, bad handle sanitized), filter; + Whereby guard (https/host-pinned, 10-min, no recording/keystroke).
- `pwa-manifest.test.mjs` (new) — valid installable manifest, SW install+fetch (offline), manifest link + SW registration + responsive breakpoint in the admin HTML.

## Acceptance
- [x] `npm test` = 36/36 green
- [x] 6 patches ship (Chrome, Edge, Firefox, Adobe Reader, Zoom, Java)
- [x] Whereby tray integration (real button; room from `WHEREBY_URL`, mocked in test)
- [x] Allowlist extended (separate patch-vendor allowlist) **without** widening sanitization rules
- [ ] **Manual:** multi-tenant dashboard responsive on a phone (screenshot) — breakpoints in place
