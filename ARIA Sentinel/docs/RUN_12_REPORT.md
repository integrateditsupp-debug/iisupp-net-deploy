# RUN 12 Report — UI polish + floating globe v2 + admin-console fix + bug sweep

**Date:** 2026-06-19 · **Suite:** 39/39 green · **`node --check`:** clean on every touched file · **Deps added:** 0 · **Permissions added:** 0 · **Published:** nothing

> Packet paths assumed a different layout (`src/preload/preload.mjs`, `createSettingsWindow`, `aria:` IPC). Mapped every fix onto the real RUN 1–11 code: `src/main/preload.cjs`, `createMainWindow`, the existing `sentinel:` channels, and **main-driven** overlay physics.

## Fixes (all 7 from the QA packet)
1. **HIGH · Left rail clips** — `createMainWindow` now opens **1280×820, minWidth 1024 / minHeight 720**; `.settings-shell` carries `min-width: 980px`. The rail is always visible without maximizing.
2. **HIGH · "Open Admin Console" dead** — replaced the silent `shell.openPath` with a dedicated `BrowserWindow` loading `admin-console/index.html` (focus-if-already-open, cleaned up on quit). Channel stays `sentinel:open-admin-console`.
3+4+6. **Globe v2** — new pure `tickFreeRoam` + `repelForce` in `overlay-physics.mjs`: free-roam drift toward random waypoints (re-picked every 8–15s), spring repulsion `(1 − dist/180)² × 0.8` away from the cursor, **0.92 damping**, clamped to the work area minus 24px. **Click-through by default** (`setIgnoreMouseEvents(true,{forward:true})`, `pointer-events:none` on the overlay body, `auto` only on the globe button) — it never blocks a click. **Ctrl+Alt+G** grants a 3-second interaction window. Card mode stays interactive. Random bottom-right spawn.
5. **UX · Show/hide globe** — About → Display "Show the floating globe" toggle, persisted via electron-store (`showFloatingGlobe`, default true); main shows/hides instantly and suppresses the ambient globe when off (a detection card still pops). `getSettings`/`setShowFloatingGlobe` over IPC.
7. **POLISH · Static UI** — `sentinel.css`: button hover-lift + gold gleam sweep, panel fade-in on tab change (`panel-rise`, display model unchanged), `.chip.cyan` pulse, `.mode-row.selected` glow, `.health-list` staggered rise. All transform/opacity only. **Every effect is killed by `body.low-power`** (RUN 9) — the renderer toggles that class from `state.lowPower`.

The edge-hugging `tickPhysics` is retained (still exercised by `overlay-physics.test.mjs`); the live app now uses `tickFreeRoam`.

## Tests (36 → 39 suites)
- `ui-shell.test.mjs` extended — settings window `minWidth:1024`/`minHeight:720`, About globe toggle present.
- `admin-console-open.test.mjs` (new) — button → preload `sentinel:open-admin-console` → main opens a dedicated window (focus-if-open); old `shell.openPath` gone.
- `show-floating-globe.test.mjs` (new) — toggle → preload `getSettings`/`setShowFloatingGlobe` → main persist + show/hide; store default true; ambient globe gated.
- `globe-roam.test.mjs` (new) — repel force decays to **0 beyond 180px** + spec value at half-radius + monotonic; free-roam stays in the padded work area over 6000 ticks; flees a parked cursor; **click-through default** asserted in overlay.html + main.mjs.

## Acceptance
- [x] `npm test` = 39/39 green
- [x] Default window size shows the left rail without maximizing
- [x] "Open Admin Console" opens (and re-focuses) the admin window
- [x] Globe free-roams + repels smoothly within ~180px; **doesn't block clicks beneath it**
- [x] "Show floating globe" toggle hides/shows + persists (electron-store)
- [x] Button hover gleam + 350ms tab fade-in; all animations off under low-power
- [x] Privacy verifier 6-host allowlist + telemetry-event schema unchanged · 0 deps · 0 new permissions

## Notes
- Manual-on-hardware checks (visual feel of the dodge, click-through to a desktop file, restart persistence) are documented; logic is unit-gated.
