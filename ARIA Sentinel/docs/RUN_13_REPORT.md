# RUN 13 Report — IA reorg + trial gate + mode behaviors + network detect + luxe UI + support + chrome ext

**Date:** 2026-06-19 · **Suite:** 46/46 green · **`node --check`:** clean · **Deps added:** 0 · **New Chrome perms:** 0 · **Runtime privacy allowlist:** unchanged (6 hosts) · **Published:** nothing

> Packet paths assumed `src/preload/preload.mjs`, `createSettingsWindow`, `detection/windows/…`. Mapped onto the real code: `src/main/preload.cjs`, `createMainWindow`, `src/sub-agents/detection/network-watcher.mjs`, main-driven overlay.

## Built (sections 1–15)
- **§1/§15 IA reorg + luxe** — 10-tab rail in order: Control Center · Mode · Recipes · Knowledge · Privacy · Hotkeys · Troubleshoot · ServiceNow · Support · About. Branded header (gold globe + "Integrated IT Support Inc.") + animated globe footer; gold active-tab treatment.
- **§2 Control Center** (new tab) — Quick Controls moved here; every button wired button→preload→main (`show-globe`, `set-paused`, `self-diagnose`, `self-repair`, `open-admin-console`) + the status table.
- **§3 Mode** — "Choose how ARIA helps" centered (max-width 560) + an always-visible chat dock ("Ask ARIA anything…", routes to the existing reasoner).
- **§4 Mode behaviors** — pure `mode-behavior.mjs` + `applyModeBehavior(mode)`: manual = free-roam/click-through; confirmed/autonomous = pinned `screen-saver` always-on-top + interactive. The free-roam click-through restore is now gated to manual mode.
- **§6 Network detect** — `evaluateConnectivity` (2 consecutive reachability fails → `NET.DOWN`, edge-triggered) wired into the watcher tick; new **yellow** `net-down-troubleshoot-v1` recipe (release/renew · flushdns · restart Dnscache,Dhcp · re-test).
- **§7 Trial gate** — replaced the 30-day flow with a **12-hour** trial (`computeTrialStatus`/`isUnlocked`/`trialBadge`, `~/.aria-sentinel/trial.json`); top-right countdown badge; post-expiry **plan-picker modal** (5 tiers → Stripe checkout in default browser) gating the app.
- **§8 License/login** — About account panel: enter key (login), logout, "Manage subscription" → Stripe portal (default browser).
- **§9 Chrome ext** — install-instructions UI (Knowledge tab) + bundled `chrome-extension/**` & `edge-extension/**` in `build.files`.
- **§10 Clip fix** — health/restore/source/log/chat lists forced to `min-height:0; overflow:visible` (no half-cut cards).
- **§11 Hotkeys** — `Ctrl+Alt+A` (toggle chat) · `Ctrl+Alt+G` (show/hide globe) · `Ctrl+Alt+P` (pause 24h) via `globalShortcut`, unregistered on quit; UI marked **Active**.
- **§12 Support** (new tab) — phone/email/WhatsApp/web-chat/status (open default app) + company address block.
- **§13/§14** — About company footer; **Troubleshoot** (new tab) consolidates run-diagnostic + restore points + circuit-breaker entry.

## Tests (39 → 46 suites)
New: `trial-gate`, `network-detect`, `mode-behavior`, `ia-tabs`, `quick-controls`, `chrome-ext-install`, `hotkeys`. Updated: `recipe-runner` (5 yellow), `scenario-suite` (75 cases/77 recipes), `privacy-audit` (+`wa.me` for the support link — a user-initiated external open, NOT a telemetry-verifier change).

## Acceptance
- [x] `npm test` = 46/46 green · `node --check` clean
- [x] 10-tab order + branded header/footer · Control Center buttons wired · Mode chat dock + centered
- [x] applyModeBehavior pins globe in confirmed/autonomous, free-roams in manual
- [x] 2 consecutive net failures → NET.DOWN + yellow troubleshoot recipe
- [x] 12h trial badge + post-expiry plan modal; login/logout; Manage subscription → Stripe (browser)
- [x] Chrome ext install UI + bundled in build.files · hotkeys A/G/P registered · clip fixed · Support tab
- [x] Runtime privacy 6-host allowlist + telemetry schema UNCHANGED · 0 deps · 0 new Chrome perms

## Known follow-ups (not gating)
- Globe chat **bubble** (§5) over the overlay is minimal — chat fully works via the Mode dock; the hotkey sends `globe:toggle-chat` (overlay listener is a future polish).
- About has both the RUN 10 license panel and the new account panel (could be merged in a polish pass).
