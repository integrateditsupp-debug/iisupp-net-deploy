# RUN 13 · IA Reorg + Trial Gate + Mode Behaviors + Network Detect + Luxe UI + Support + Chrome Ext (~6hr)

> Ahmad's full second-pass after installing the RUN 12 build. Major surface changes. Single sitting if possible; if context tight, write `docs/RUN_13_CHECKPOINT.md` and resume.

## Pre-read
- `docs/RUN_12_REPORT.md` (just-shipped state)
- `src/main/main.mjs`, `src/preload/preload.cjs`, `src/renderer/index.html`, `src/renderer/renderer.js`, `src/renderer/overlay.html`, `src/renderer/overlay.js`, `src/renderer/sentinel.css`
- `admin-console/index.html`
- `chrome-extension/manifest.json`, `chrome-extension/content.js`, `chrome-extension/popup.html`
- `src/shared/license.mjs` (RUN 10 — will be rewritten for 12h trial)
- `src/sub-agents/detection/windows/network-watcher.mjs` (existing — extend)

═══════════════════════════════════════════════════════════════════════
## §1 · Information architecture — new tab structure
═══════════════════════════════════════════════════════════════════════

Reorganize Settings nav (left rail). **Order top-to-bottom:**

1. **Control Center** (NEW — pulls all Quick Controls out of Mode tab into its own tab)
2. **Mode**
3. **Recipes**
4. **Knowledge & policy**
5. **Privacy verifier**
6. **Hotkeys**
7. **Troubleshoot** (NEW — moves Self check + Repair ARIA + run-diagnostic from About + Mode here)
8. **ServiceNow**
9. **Support** (NEW — IIS contact channels)
10. **About**

Header above the nav (top of left rail):
```
[gold globe SVG icon, centered, 48px]
Integrated IT Support Inc.    ← serif weight 600, gold #c5a059
ARIA Sentinel · Manual mode    ← smaller secondary
```

Footer below the nav (bottom of left rail):
```
[ARIA globe from iisupp.net/aria — animated SVG, ~120px, centered]
Resident agent
v0.1.0
```

═══════════════════════════════════════════════════════════════════════
## §2 · Control Center tab (NEW)
═══════════════════════════════════════════════════════════════════════

Move the existing "Quick controls" panel here. **Every button must work end-to-end:**

| Button | Action | IPC channel | Main handler |
|---|---|---|---|
| Show globe | overlayWindow.show() + setBounds to center | `sentinel:show-globe` | exists, verify wiring |
| Pause 1 hour | persist `pausedUntil = Date.now() + 3600000`, disable watchers, gray tray | `sentinel:pause` | NEW |
| Resume watching | clear pausedUntil, re-enable watchers | `sentinel:resume` | NEW |
| Self check | run self-diagnostic, show results inline | `sentinel:self-diagnose` | exists |
| Repair ARIA | re-init watchers + clear queues + restart overlay | `sentinel:self-repair` | exists |
| Open admin console | open admin window (RUN 12 fixed this — verify still works) | `sentinel:open-admin-console` | exists |

Below the buttons, keep the existing status table (single-instance, bridge, overlay, main-window, dry-run, content-boundary).

═══════════════════════════════════════════════════════════════════════
## §3 · Mode tab — simplified + chat
═══════════════════════════════════════════════════════════════════════

**Move the "Choose how ARIA helps" panel to vertical center**, narrower (max-width 560px). Three modes as cards in the same layout as today.

**Below the mode cards**, add a chat dock (always visible in Mode tab):
```html
<section class="aria-chat-dock">
  <div class="chat-stream" id="chatStream"></div>  <!-- ARIA messages + user messages -->
  <div class="chat-input">
    <input id="askAria" placeholder="Ask ARIA anything…" />
    <button id="sendAria">Ask</button>
  </div>
</section>
```

Chat behavior:
- User types → POST to local main process → main forwards to existing reasoner module (`src/shared/reasoner.mjs` if present, else stub for v1)
- ARIA replies **short** (1-3 sentences) + "what it's doing" status line
- If reply length > 600 chars OR step count > 5: ARIA says "This needs more space — open the Mode tab in the ARIA app (taskbar or Start menu) for the full answer." and the full version is queued to the chat stream
- Globe also gets the same `Ask ARIA anything…` input — see §5

═══════════════════════════════════════════════════════════════════════
## §4 · Mode-specific globe behaviors (CRITICAL — Ahmad's spec)
═══════════════════════════════════════════════════════════════════════

When user switches mode, the globe behavior changes:

### Manual (default · free)
- Globe is the default RUN 12 v2 (free-roaming, click-through, repels from cursor)
- Globe shows the "Ask ARIA anything…" input on click/hover
- Chat happens in globe bubble OR in Mode tab
- ARIA finds issue → silently surfaces it in Mode tab chat. NO popup interrupt.

### Confirmed (paid)
- Globe `alwaysOnTop: true` "screen-saver" level (above ALL windows including fullscreen)
- When ARIA detects issue → globe expands into fix-card bubble: "ARIA found: <issue>. Want me to fix this? [Yes] [Not now]"
- User clicks Yes → recipe runs (with existing gate). Clicks Not now → bubble dismisses, issue logged.

### Autonomous (paid · opt-in)
- Globe `alwaysOnTop: true` "screen-saver"
- Globe is **always visible front-of-everything** (never hidden by other apps)
- Green-risk recipes auto-fire without asking; yellow still asks (RUN 6 gate intact)
- Globe color pulse changes on auto-fix: cyan ring spin for 2s, brief "Fixed: <one-line>" toast

Switching mode → main calls `applyModeBehavior(mode)`:
```js
function applyModeBehavior(mode) {
  if (mode === "manual") {
    overlayWindow.setAlwaysOnTop(false);
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  } else if (mode === "confirmed" || mode === "autonomous") {
    overlayWindow.setAlwaysOnTop(true, "screen-saver");
    overlayWindow.setIgnoreMouseEvents(false);  // allow interaction with bubble
  }
  store.set("mode", mode);
}
```

═══════════════════════════════════════════════════════════════════════
## §5 · Globe chat bubble
═══════════════════════════════════════════════════════════════════════

When user clicks the globe (or hovers for 800ms), expand into a small floating bubble:

```
┌───────────────────────────────┐
│  [gold A globe]               │
│  ─────────────────────────    │
│  > Ask ARIA anything…  [Ask]  │
│  ─────────────────────────    │
│  ARIA: <last short reply>     │
└───────────────────────────────┘
```

- Width 320px, height auto, transparent rounded card with gold border
- Click outside or press Esc → collapses back to globe
- In Confirmed/Autonomous mode, also surfaces detected-issue cards here (with [Fix] [Dismiss])

═══════════════════════════════════════════════════════════════════════
## §6 · Network detection + alert (Ahmad: "globe should pop a message")
═══════════════════════════════════════════════════════════════════════

Extend `src/sub-agents/detection/windows/network-watcher.mjs`:
- Poll every 8s: `Test-NetConnection -ComputerName 1.1.1.1 -Port 53 -InformationLevel Quiet` (or equivalent net-call; if PS unavailable, try `ping -n 1 1.1.1.1`)
- If 2 consecutive failures → emit `NET.DOWN` event with detection record
- New recipe `NET.DOWN.TROUBLESHOOT`:
  - Description: "Internet seems down."
  - Steps: ipconfig /release · ipconfig /renew · ipconfig /flushdns · Restart-Service Dnscache,Dhcp · re-test connectivity
  - Risk: yellow (requires confirm even in Autonomous — restarts services that affect connectivity)
- Globe behavior on NET.DOWN: regardless of mode, bubble pops:
  > "Internet seems down. Want me to troubleshoot? [Yes, try fixing] [Not now]"
- After fix → bubble updates: "Connectivity is back" OR "Still no internet — opened a manual checklist in the Troubleshoot tab"

═══════════════════════════════════════════════════════════════════════
## §7 · Trial gate (REPLACES RUN 10's 30-day trial)
═══════════════════════════════════════════════════════════════════════

**12-hour trial** from first launch, stored at `~/.aria-sentinel/trial.json`:
```json
{ "started_at": "2026-06-19T22:00:00Z", "device_id": "<machine GUID>" }
```

Trial = 12 × 3600 × 1000 ms from `started_at`.

**During trial:** all features unlocked, but every button click shows a small "Trial · Xh Ym left" badge in top-right of Settings.

**After trial expires:**
- Every button click in Settings → modal: "Your 12-hour trial has ended. Please choose a plan to keep using ARIA Sentinel."
- Modal shows the 5 plan cards (Personal $599/mo · Pro $1,500/mo · SMB $156K/yr · Mid-Size $312K/yr · Enterprise $625K/yr) + a "Visit iisupp.net for full details" link
- Each card has a "Choose" button → opens Stripe checkout for that tier in default browser (env vars from project_instructions: STRIPE_PERSONAL_MONTHLY_URL etc.)
- Globe also disabled (tray icon goes gray, tooltip "Trial ended — choose a plan")
- The ONLY working buttons post-trial: "Choose a plan", "Enter license key", "Logout", "Help/Support contact"

`src/shared/license.mjs` rewrite:
```js
export function trialStatus() {
  const f = readJSON("~/.aria-sentinel/trial.json");
  if (!f) return { state: "not-started" };
  const elapsed = Date.now() - new Date(f.started_at).getTime();
  const remaining = (12 * 3600 * 1000) - elapsed;
  return { state: remaining > 0 ? "active" : "expired", remainingMs: Math.max(0, remaining) };
}
export function startTrial(deviceId) { /* writes trial.json */ }
export function validateLicense(key) { /* existing HMAC check */ }
export function isUnlocked() {
  return validateLicense(readLicenseKey()) || trialStatus().state === "active";
}
```

═══════════════════════════════════════════════════════════════════════
## §8 · License + login/logout (NEW)
═══════════════════════════════════════════════════════════════════════

In About tab (or new Account tab — your call):
- Show current state: "Trial · 8h 12m left" OR "Licensed to: <email> · Plan: Pro" OR "Logged out"
- "Enter license key" → modal with input + validate → save to `~/.aria-sentinel/license.json` `{ key, email, plan, validated_at }`
- "Logout" → clears license.json, returns to trial state (if trial still active) or expired state
- "Manage subscription" → opens existing Stripe customer portal URL in default browser (RUN 10 wired this — verify route works)

`Manage subscription` button MUST go to the Stripe Customer Portal where user can upgrade/downgrade/cancel. If license.json has no email, fall back to a generic Stripe Customer Portal entry link from env var STRIPE_PORTAL_URL.

After Stripe checkout completes (user purchases), backend (Netlify function existing) generates HMAC license key + emails it via Resend. User pastes key into "Enter license key" → unlocked.

═══════════════════════════════════════════════════════════════════════
## §9 · Chrome extension (CRITICAL — Ahmad noted it's not installed)
═══════════════════════════════════════════════════════════════════════

`chrome-extension/` files exist but extension isn't loaded in Chrome.

Add to Settings → Knowledge & policy (or new Browser tab):
```
Browser companion
─────────────────
ARIA Chrome extension: [Install instructions]  [Open chrome://extensions]

[Install instructions] → opens modal:
  1. Click "Open chrome://extensions" below
  2. Enable "Developer mode" (top-right toggle)
  3. Click "Load unpacked"
  4. Select: <Sentinel install path>\resources\chrome-extension
  5. Done — the gold A appears in your Chrome toolbar
```

Same for Edge → `edge://extensions`.

Bonus: bundle the extension folder into the NSIS install so it lands at a predictable path. Update `package.json` `build.files` to include `chrome-extension/**/*` and `edge-extension/**/*` in the asar bundle.

═══════════════════════════════════════════════════════════════════════
## §10 · Layout bug — "sustained-high-memory" clip
═══════════════════════════════════════════════════════════════════════

In renderer (likely a recipe card or detection record), one card titled "Sustained high memory" is clipped half-cut. Find it in `index.html` or admin-console — likely a fixed-height container. Fix: change to `min-height` + `overflow: auto`. Verify all detection cards render fully at any window size.

═══════════════════════════════════════════════════════════════════════
## §11 · Hotkeys — actually wire them
═══════════════════════════════════════════════════════════════════════

The Hotkeys tab currently shows three "Planned" rows. Make them work:

| Combo | Action |
|---|---|
| Ctrl+Alt+A | Open ARIA chat (toggle globe bubble) |
| Ctrl+Alt+G | Show/hide the globe |
| Ctrl+Alt+P | Pause watching for 24 hours |

Implementation in main.mjs:
```js
const { globalShortcut } = require("electron");
app.whenReady().then(() => {
  globalShortcut.register("CommandOrControl+Alt+A", () => overlayWindow.webContents.send("globe:toggle-chat"));
  globalShortcut.register("CommandOrControl+Alt+G", () => overlayWindow.isVisible() ? overlayWindow.hide() : overlayWindow.show());
  globalShortcut.register("CommandOrControl+Alt+P", () => pauseWatchers(24 * 3600 * 1000));
});
app.on("will-quit", () => globalShortcut.unregisterAll());
```

In Hotkeys tab UI: change "Planned" badges to "Active" + show current binding. Allow per-row rebind in v2 (defer).

═══════════════════════════════════════════════════════════════════════
## §12 · Support tab (NEW)
═══════════════════════════════════════════════════════════════════════

Contents:
```
Need help?
──────────────────────────────────────────
[Phone]      +1-647-581-3182          [Call now]
[Email]      ahmad.wasee@iisupp.net   [Email us]
[WhatsApp]   wa.me/16475813182        [Open WhatsApp]
[Web chat]   iisupp.net/aria          [Open chat]
[Status]     iisupp.net/sentinel-status  [Check status]

Business hours: Mon-Fri 9am-6pm ET
Emergency support (Pro+ plans): 24/7

──────────────────────────────────────────
Integrated IT Support Inc.
30 Fothergill Crt, Whitby ON L1P 1L4 · Canada
D-U-N-S 241726397
```

Each button opens default app: `mailto:`, `tel:`, `https://wa.me/...`, etc.

═══════════════════════════════════════════════════════════════════════
## §13 · About tab — add company contact footer
═══════════════════════════════════════════════════════════════════════

Keep existing About content (version, bridge, admin). At bottom, add a small footer panel:
```
─────────────────────────────────────
Integrated IT Support Inc.
30 Fothergill Crt, Whitby ON L1P 1L4
+1-647-581-3182 · ahmad.wasee@iisupp.net
D-U-N-S 241726397 · iisupp.net
─────────────────────────────────────
```

═══════════════════════════════════════════════════════════════════════
## §14 · Troubleshoot tab (NEW)
═══════════════════════════════════════════════════════════════════════

Move FROM Mode/About → to Troubleshoot:
- Self-check button + 7-point health check rows (currently in About)
- Repair ARIA button
- Run diagnostic button
- All restore-point UI (currently in Privacy)
- Recipe Circuit Breaker controls (currently in admin console)

═══════════════════════════════════════════════════════════════════════
## §15 · Visual luxe — nav + branding
═══════════════════════════════════════════════════════════════════════

CSS additions:
```css
/* Left rail header — gold branding */
.settings-brand { padding: 24px 16px; text-align: center; border-bottom: 1px solid rgba(197,160,89,.18); }
.settings-brand .brand-globe { width: 48px; height: 48px; margin: 0 auto 12px; }
.settings-brand .brand-name { font-family: 'Cormorant Garamond', serif; font-size: 18px; color: #c5a059; letter-spacing: 0.5px; }
.settings-brand .brand-sub { font-size: 11px; color: rgba(241,220,167,.65); margin-top: 4px; }

/* Nav items — softer hover, gold underline reveal */
.settings-nav .nav-item { padding: 12px 20px; transition: background .25s, color .25s; position: relative; }
.settings-nav .nav-item::before { content:""; position:absolute; left:0; top:20%; bottom:20%; width:2px; background:transparent; transition: background .25s; }
.settings-nav .nav-item:hover { background: rgba(197,160,89,.08); color: #fff8e0; }
.settings-nav .nav-item.active { background: linear-gradient(90deg, rgba(197,160,89,.15), transparent); color: #fde8b8; }
.settings-nav .nav-item.active::before { background: linear-gradient(180deg, #fde8b8, #c5a059, #fde8b8); }

/* Rail footer — ARIA globe centered */
.rail-footer { padding: 24px 16px; text-align: center; border-top: 1px solid rgba(197,160,89,.18); margin-top: auto; }
.rail-footer .aria-living-globe { width: 96px; height: 96px; margin: 0 auto 8px; }
.rail-footer small { font-size: 11px; color: rgba(241,220,167,.5); display: block; }
```

The footer globe: re-use the SVG from `iisupp.net/aria-core.js` (or copy into `src/renderer/aria-globe.svg`) — the rotating gold ring with the breathing core. Animated, GPU-cheap.

═══════════════════════════════════════════════════════════════════════
## §16 · Tests
═══════════════════════════════════════════════════════════════════════

- `tests/ia-tabs.test.mjs` (NEW) — assert all 10 tabs present, correct order
- `tests/quick-controls.test.mjs` (NEW) — every Control Center button has a renderer click handler + IPC channel + main handler
- `tests/mode-behavior.test.mjs` (NEW) — `applyModeBehavior("autonomous")` sets alwaysOnTop true / `applyModeBehavior("manual")` false
- `tests/trial-gate.test.mjs` (NEW) — trial state transitions: not-started → active → expired · expired blocks buttons · valid license unlocks
- `tests/license.test.mjs` extended — login/logout · "Manage subscription" opens URL
- `tests/network-detect.test.mjs` (NEW) — 2 consecutive ping failures emit NET.DOWN · single failure does not
- `tests/hotkeys.test.mjs` (NEW) — globalShortcut.register called with the 3 combos
- `tests/chrome-ext-install.test.mjs` (NEW) — extension folder bundled in build.files
- Existing 39 suites stay green

Target: ~46-48 suites green.

═══════════════════════════════════════════════════════════════════════
## §17 · Acceptance (Ahmad's checklist)
═══════════════════════════════════════════════════════════════════════

- ✅ Tabs reorder per §1, branded header + footer per §15
- ✅ Control Center tab — every button works end-to-end
- ✅ Mode tab — chat dock works, "Choose how ARIA helps" centered + narrower
- ✅ Switching to Autonomous → globe pinned always-on-top
- ✅ Switching to Confirmed → globe always-on-top + fix-card bubble on detect
- ✅ Switching to Manual → globe free-roams, chat in panel
- ✅ Disable wifi/ethernet → within 30s, globe bubble pops "Internet seems down…"
- ✅ Click globe → "Ask ARIA anything…" bubble appears
- ✅ Hotkeys Ctrl+Alt+{A,G,P} actually work
- ✅ Sustained-high-memory card renders fully (no clip)
- ✅ Trial countdown badge visible in top-right
- ✅ After 12h trial expires → all buttons disabled with "Choose a plan" modal
- ✅ Manage subscription → opens Stripe customer portal
- ✅ Login/Logout works
- ✅ Chrome extension install instructions visible + extension bundled in install
- ✅ Support tab — phone/email/whatsapp/chat all open correctly
- ✅ About tab footer shows company contact + address
- ✅ Troubleshoot tab consolidates self-check + repair + restore-points + circuit breaker
- ✅ npm test ≥ 46/46 green
- ✅ ENTERPRISE_READINESS bumped (target 9.8)

═══════════════════════════════════════════════════════════════════════
## §18 · Locked rules
═══════════════════════════════════════════════════════════════════════

- Zero new deps. (Cormorant Garamond → use Google Fonts CDN allowlisted OR fall back to system serif.)
- Zero new permissions in Chrome ext.
- Privacy verifier 6-host allowlist UNCHANGED (Stripe portal URL opens in DEFAULT BROWSER, not in-app — no telemetry change).
- No external send by Sentinel itself beyond existing allowlist.
- Nothing published. NOT pushed to live iisupp.net. NOT submitted to Chrome store.
- All animations respect low-power mode (RUN 9 toggle).
- Write `docs/RUN_13_REPORT.md` + update §0 + ENTERPRISE_READINESS.md + commit `[sentinel] RUN 13: IA reorg + trial gate + mode behaviors + network detect + luxe UI + support + chrome ext install path`.

═══════════════════════════════════════════════════════════════════════
## §19 · Order of execution (suggested)
═══════════════════════════════════════════════════════════════════════

1. IA reorg (move tabs, fix nav header/footer CSS, ensure rail-shell still renders) — §1, §15
2. Control Center tab + wire every button — §2
3. Mode tab simplify + chat dock — §3
4. Mode-specific globe behaviors — §4
5. Globe chat bubble — §5
6. Network detect + NET.DOWN recipe — §6
7. Trial gate rewrite — §7
8. License + login/logout — §8
9. Chrome ext install path + UI — §9
10. Layout clip fix — §10
11. Hotkeys — §11
12. Support tab — §12
13. About footer — §13
14. Troubleshoot tab — §14
15. Tests (write as you go; final pass to confirm 46/46) — §16
16. Report + commit — §18

Ship it.
