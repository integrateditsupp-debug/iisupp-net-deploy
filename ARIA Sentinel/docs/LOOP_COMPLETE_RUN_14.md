# LOOP COMPLETE — through RUN 14

**Date:** 2026-06-19 · **Final suite:** 52/52 green · **`node --check`:** clean · **Readiness:** 9.9/10 · **Pushed to live:** no · **Published:** nothing

RUN 13 (resumed + committed `7c64352`) and RUN 14 (this turn) are both done, each green + `node --check`-clean + committed locally. The build phase to a v1.0 release candidate is effectively complete.

## RUN 13 — IA reorg + trial + modes + network + luxe + support + chrome ext (46 suites)
10-tab luxe IA · Control Center (wired) · Mode chat dock + centered · per-mode globe behaviors (manual free-roam / confirmed+autonomous pinned) · internet-down detection + yellow troubleshoot recipe · 12-hour trial + countdown badge + plan-picker modal · login/logout + Stripe portal · Chrome/Edge ext install UI + bundling · Ctrl+Alt+A/G/P · Support + Troubleshoot tabs · clip fix. (+7 suites)

## RUN 14 — self-hosted auto-update + admin push + per-license rollback (52 suites)
- **electron-updater** — the ONE documented dep exception (dynamically guarded; suite green with or without it installed).
- Per-license self-hosted **update manifest** (pin → rollback, latest-non-disabled, staged rollout %); admin **publish/disable/rollout**.
- **User** update history + per-version rollback + get-latest link; auto-update defaults ON with opt-out.
- **Admin Updates tab** — search by license/name/company; per-license / bulk / **all-machines** rollback (double-confirm + admin-token re-entry).
- **License registry** — idempotent device check-in (pin survives).
- **Privacy** — allowlist +EXACTLY 2 paths (manifest + `/sentinel-binaries/` prefix), `update-channel` direction; 6-host telemetry verifier + schema unchanged; explicit test proves no other iisupp.net path passes. (+6 suites)

## Readiness trajectory
9.1 (R4) → 9.2 → 9.3 → 9.4 → 9.5 → 9.6 → 9.65 → 9.7 (R11) → 9.7 (R12) → 9.8 (R13) → **9.9 (R14)**.

## What's true / what's pending
- **Code-complete v1.0 RC.** All build-acceptance items across the roadmap are implemented and unit-gated. 52 suites green; `electron-updater` is the only dependency added across the entire 5→14 program.
- **Local only.** Every run is its own commit on `sprint-0-backend`; nothing pushed to live iisupp.net; no Chrome/Edge store submission; Netlify functions + status/badge/CI/PWA assets all project-local; no binary uploaded.
- **Remaining = Ahmad's wallet items (RUN 15+):** Authenticode EV cert + sign Windows binary; Apple Developer ID + notarize macOS; Chrome Web Store + Microsoft Partner Center submissions; live ServiceNow OAuth; legal DPA/EULA/SLA; external pen test; first paid pilot. Plus the operational ship steps Ahmad runs by hand (build .exe, upload to `public/sentinel-binaries/`, deploy the Netlify functions, set `ARIA_ADMIN_TOKEN` + Stripe/Resend env).

## Manual on-hardware checks (logic is unit-gated; these need a real machine)
RUN 13: tab order/branding, every Control Center button, 12h countdown + plan modal, mode→globe behavior, wifi-off bubble, hotkeys, Support links, Stripe portal. RUN 14: About update history, admin search-by-name, publish 0.1.1 + bump to 0.1.2 then roll back one device.

**STOP.** RUN 15 (wallet items) requires Ahmad to buy certs / sign legal / pay — not auto-startable.
