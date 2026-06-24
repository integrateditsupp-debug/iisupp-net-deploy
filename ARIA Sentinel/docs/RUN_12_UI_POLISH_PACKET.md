# RUN 12 · UI Polish + Floating Globe v2 + Bug Sweep (~4hr)

> Cowork QA'd the freshly-built v0.1.0 .exe on Ahmad's Windows machine 2026-06-19 evening. This packet collects every observed defect + the UX upgrades Ahmad asked for. Single sitting, no scope creep.

## Pre-read
- `docs/ROADMAP_TO_V1.md`
- `docs/LOOP_COMPLETE_RUN_11.md`
- `src/renderer/index.html`, `src/renderer/renderer.js`, `src/renderer/overlay.html`, `src/renderer/overlay.js`, `src/renderer/sentinel.css`
- `src/main/main.mjs`, `src/preload/preload.mjs`

## Observed defects (live test on Ahmad's machine)

| # | Defect | Severity | Fix lane |
|---|---|---|---|
| 1 | At default window size the left nav rail clips off-screen — only the workspace pane is visible, user must maximize to see Mode/Recipes/etc. | **HIGH** — first-launch confusion | Settings shell CSS responsive |
| 2 | "OPEN ADMIN CONSOLE" button in Quick Controls does nothing on click | **HIGH** — admin console unreachable from Settings | renderer.js + main.mjs IPC handler |
| 3 | Floating globe overlay anchored to top-center — not free-roaming | UX flat | overlay.js + main.mjs window config |
| 4 | Globe overlay BLOCKS clicks beneath it (intercepts mouse) when present | **HIGH** — annoying | overlay.html `pointer-events: none` + setIgnoreMouseEvents |
| 5 | No user-facing toggle to hide the floating globe | UX gap | About tab → Display section + electron-store persist |
| 6 | Globe cursor-dodge exists but feels mechanical, not fluid | Polish | overlay.js easing + spring physics |
| 7 | UI overall feels static — no hover micro-animations, no panel reveal transitions, no button shine | Polish | sentinel.css `transition` + `@keyframes` additions |

## Build

### Fix 1 — Settings shell responsive (left rail never clips)

`src/renderer/sentinel.css`:
```css
.settings-shell { display: grid; grid-template-columns: 240px 1fr; min-width: 980px; }
@media (max-width: 900px) {
  .settings-shell { grid-template-columns: 1fr; }
  .settings-rail { position: sticky; top: 0; z-index: 5; }
  .settings-nav { display: flex; flex-direction: row; overflow-x: auto; }
  .settings-nav .nav-item { white-space: nowrap; }
}
```
Plus in `src/main/main.mjs` `createSettingsWindow`: set `minWidth: 1024, minHeight: 720, width: 1280, height: 820`. Default-launch big enough that the rail always shows.

### Fix 2 — Open Admin Console works

`src/renderer/renderer.js` — bind handler if missing:
```js
document.getElementById("openAdminConsole")?.addEventListener("click", () => {
  window.sentinel?.openAdminConsole?.();
});
```
`src/preload/preload.mjs` — expose:
```js
openAdminConsole: () => ipcRenderer.invoke("aria:open-admin-console"),
```
`src/main/main.mjs` — add IPC handler that opens (or focuses) the admin console window using existing `admin-console/index.html`:
```js
ipcMain.handle("aria:open-admin-console", () => openAdminConsole());
function openAdminConsole() {
  if (adminWindow && !adminWindow.isDestroyed()) { adminWindow.focus(); return; }
  adminWindow = new BrowserWindow({ width: 1440, height: 900, minWidth: 1100, minHeight: 700, title: "ARIA Sentinel · Admin Console", webPreferences: { preload: PRELOAD_PATH, contextIsolation: true } });
  adminWindow.loadFile(path.join(__dirname, "../../admin-console/index.html"));
  adminWindow.on("closed", () => { adminWindow = null; });
}
```
Add unit-test `tests/admin-console-open.test.mjs` — assert preload exposes `openAdminConsole`, main has handler, button exists in index.html.

### Fix 3+4+6 — Floating globe v2 (free-roam + click-through + smooth dodge)

`src/main/main.mjs` overlay window config:
```js
overlayWindow = new BrowserWindow({
  width: 120, height: 120,
  x: <random spawn in bottom-right quadrant>, y: <random>,
  transparent: true, frame: false, resizable: false,
  alwaysOnTop: true, focusable: false, skipTaskbar: true,
  hasShadow: false, webPreferences: { preload: PRELOAD_PATH }
});
overlayWindow.setIgnoreMouseEvents(true, { forward: true });  // CLICK-THROUGH by default
overlayWindow.setAlwaysOnTop(true, "screen-saver");
```

`src/renderer/overlay.js` — new motion model (pure, deterministic):
```js
// State: position {x,y}, velocity {vx,vy}
// Each tick (16ms via requestAnimationFrame):
//   1. apply gentle drift toward a randomly-chosen waypoint (re-pick every 8-15s)
//   2. apply mouse-repulsion force when cursor is within 180px radius
//      (force magnitude = max(0, 1 - dist/180)^2 * 0.8, direction = away from cursor)
//   3. velocity damping factor 0.92 each tick (water-like smoothness)
//   4. clamp to display work-area minus 24px padding
// Move window via ipcRenderer "overlay:move" -> main.setBounds
// Mouse position is forwarded from main via electron.screen.getCursorScreenPoint() polled at 50ms
```
- Spring-damped motion → looks like water flowing around the cursor.
- When user enables interaction mode (e.g. Ctrl+Alt+G hover), call `setIgnoreMouseEvents(false)` for 3s to allow click.

`src/renderer/overlay.html` body:
```css
html, body { background: transparent; pointer-events: none; }
.globe-button { pointer-events: auto; }  /* only the globe itself catches clicks when un-ignored */
```

### Fix 5 — User toggle "Show floating globe"

Add to `src/renderer/index.html` About tab (new card):
```html
<section class="panel">
  <p class="eyebrow">Display</p>
  <h2>Floating globe</h2>
  <label class="toggle-row">
    <input id="showFloatingGlobe" type="checkbox" checked />
    <span>Show the floating globe on my desktop</span>
  </label>
  <small>Hide it if you don't want a visible icon. Tray menu still works either way.</small>
</section>
```
`renderer.js`:
```js
const el = document.getElementById("showFloatingGlobe");
sentinel.getSettings().then(s => { el.checked = s.showFloatingGlobe ?? true; });
el.addEventListener("change", e => sentinel.setShowFloatingGlobe(e.target.checked));
```
`preload.mjs` exposes `getSettings`, `setShowFloatingGlobe`.
`main.mjs` persists via existing electron-store + on change calls `overlayWindow.show()/hide()`.

### Fix 7 — Classy professional effects (subtle, performance-cheap)

`src/renderer/sentinel.css` additions:
```css
/* Buttons — gold light-sweep on hover */
button { transition: transform .18s ease, box-shadow .25s ease, background .25s ease; position: relative; overflow: hidden; }
button:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(197,160,89,.25); }
button::after { content:""; position:absolute; top:0; left:-120%; width:50%; height:100%; background: linear-gradient(110deg, transparent, rgba(255,248,224,.18), transparent); transition: left .55s ease; }
button:hover::after { left: 140%; }

/* Panels — soft reveal on tab change */
.tab-panel { opacity: 0; transform: translateY(8px); transition: opacity .35s ease, transform .35s ease; pointer-events: none; }
.tab-panel.active { opacity: 1; transform: translateY(0); pointer-events: auto; }

/* Chips — subtle pulse for "live" state badges */
.chip.cyan { animation: chip-pulse 3s ease-in-out infinite; }
@keyframes chip-pulse { 50% { box-shadow: 0 0 12px rgba(122,251,255,.35); } }

/* Mode rows — selected glow */
.mode-row.selected { box-shadow: inset 0 0 0 1px rgba(241,220,167,.55), 0 0 24px rgba(197,160,89,.18); }

/* Status table rows — slide in on load */
.health-list > * { animation: row-rise .4s ease forwards; opacity: 0; transform: translateY(6px); }
.health-list > *:nth-child(1) { animation-delay: 0.05s }
.health-list > *:nth-child(2) { animation-delay: 0.10s }
.health-list > *:nth-child(3) { animation-delay: 0.15s }
@keyframes row-rise { to { opacity: 1; transform: none; } }
```
Performance budget: every effect uses transform/opacity only (GPU-cheap). No layout shift. Disable all of the above if low-power mode is on (RUN 9 toggle) — add `body.low-power *` reset.

## Tests
- `tests/ui-shell.test.mjs` extended — assert minWidth set on settings window config, assert showFloatingGlobe toggle exists in About panel
- `tests/admin-console-open.test.mjs` (new) — preload exposes the method, main handles the IPC, renderer binds the button
- `tests/overlay-physics.test.mjs` extended — assert click-through default, assert dodge force decays per spec (distance > 180px = 0 force), assert position stays within display work-area
- `tests/show-floating-globe.test.mjs` (new) — toggling persists + hides/shows overlay window

## Acceptance
- `npm test` = 39/39 green (was 36 + 3 new — give or take depending on which existing suites you extend vs split)
- Open at default size → left rail visible without maximizing
- Click "OPEN ADMIN CONSOLE" → admin console window opens (and re-focuses if already open)
- Globe drifts around the desktop, repels smoothly when cursor gets within ~180px
- Globe doesn't block clicks beneath it (try clicking through to a file on the desktop)
- About → "Show the floating globe" toggle hides/shows it instantly, persists across restart
- Hover any button → subtle lift + gold gleam sweep
- Switch between tabs → smooth 350ms fade-in instead of instant flash

## Locked rules
- Zero new deps · zero new permissions · denylist intact · no external send · nothing published
- All animations respect existing low-power mode (RUN 9) → no animation when low-power on
- Privacy verifier 6-host allowlist unchanged · telemetry-event schema unchanged
- Write `docs/RUN_12_REPORT.md` · update §0 checklist · bump ENTERPRISE_READINESS.md
- Commit with subject `[sentinel] RUN 12: UI polish + globe v2 + admin-console fix + bug sweep`

Ship it.
