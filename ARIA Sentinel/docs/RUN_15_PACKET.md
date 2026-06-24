# RUN 15 · Self-Heal + Globe Behavior v3 + ARIA-Brain Integration + Admin-Only Console (~8hr)

> Ahmad's third pass after testing v1.0 RC. Major behavioral + architectural changes. Read the corresponding QA notes in docs/RUN_15_QA_FINDINGS.md before starting.

> **Ahmad's core directive:** "Do not leave room for failures. ARIA should not wait in autonomous mode for me to tell it a feature is broken. It must self-assess, self-debug, and escalate." Every change in this packet must include a unit test + a self-heal hook.

## Pre-read
- docs/RUN_14_REPORT.md (v1.0 RC state)
- docs/RUN_15_QA_FINDINGS.md (this session's QA)
- src/main/main.mjs, preload.cjs, renderer.js, overlay.js, overlay.html, sentinel.css
- src/shared/license.mjs (RUN 13 12h trial + login/logout)
- src/shared/auto-update.mjs (RUN 14)
- admin-console/index.html, admin-console/app.js
- chrome-extension/icons/* (replace with iisupp.net/aria globe)
- iisupp.net/aria/aria-core.js (live globe source we mirror)

═══════════════════════════════════════════════════════════════
## §1 · Self-Heal Engine (CRITICAL — the meta-fix)
═══════════════════════════════════════════════════════════════

Create `src/shared/self-heal.mjs` — a runtime self-audit + auto-repair + escalation system.

### How it works
On launch + every 5min + on user-click of "Self Check":
1. **Enumerate every UI surface**: every button id, every tab, every IPC channel, every recipe, every hotkey, every watcher
2. **Test each one programmatically:**
   - Buttons: assert click handler exists in renderer.js · assert IPC channel exists in preload.cjs · assert main process responds within 2s
   - Tabs: assert panel exists + renders without console.error
   - Hotkeys: assert `globalShortcut.isRegistered(combo) === true`
   - Watchers: assert each tick() returns a value without throwing
   - Recipes: assert allowlist registry resolves each id
3. **Categorize results:** `pass | recoverable-failure | needs-code-fix | needs-design-fix`
4. **Auto-heal recoverable failures:** re-register hotkey · re-bind handler · restart watcher
5. **Escalate non-recoverable failures:**
   - `needs-code-fix` → POST sanitized failure report to `iisupp.net/.netlify/functions/aria-self-heal-report` with category=code → routed to Claude Code agent queue (existing CC workflow)
   - `needs-design-fix` → routed to Cowork queue (planning/UX/IA)
   - Surface a card in admin console: "ARIA flagged 3 features needing attention — see report"

### Files
- `src/shared/self-heal.mjs` — pure module, no I/O (testable)
- `src/main/self-heal-runner.mjs` — wires into IPC + spawns periodic check
- `netlify/functions/aria-self-heal-report.js` (NEW) — receives reports, writes to Netlify Blobs `self-heal-reports` store
- Admin console new "Self-heal queue" panel — shows pending reports + which agent assigned

### Acceptance
- "Self Check" button in Control Center now runs the full self-heal pass
- Pass result UI: "All 47 features verified · 0 issues"
- Simulated failure (unregister Ctrl+Alt+G) → next self-heal detects it → auto-re-registers → next pass shows green
- Permanent failure (kill an IPC handler) → escalates with code agent flag · admin console shows the queued report

═══════════════════════════════════════════════════════════════
## §2 · Globe behavior v3 — top-center + teleport + greetings
═══════════════════════════════════════════════════════════════

Replace RUN 12's free-roam with **window-anchored** model:

### Position
- Globe anchored to **TOP CENTER of the focused window** (uses `electron.screen.getDisplayNearestPoint(BrowserWindow.getFocusedWindow().getBounds())` + math)
- When user's cursor enters within 180px → globe applies the same repel force (RUN 12 spring physics)
- After cursor leaves (no movement within 180px for 2s) → globe smoothly returns to top-center via `lerp(current, target, 0.18)` each tick
- If user switches windows → globe follows the new focused window's top-center

### Greetings
New `src/shared/globe-greetings.mjs`:
- On Sentinel launch (after 2s grace): globe says "Hi" via tooltip-style bubble for 4s
- Every 18-22 min (random jitter): rotates through:
  - "Anything you need? I'm here."
  - "Let me know if you need help."
  - "I'm watching things in the background — tap me if you need anything."
- Every 10 min (per Ahmad): globe sprouts a small chat input bubble below it: "Want to talk or search anything? [type here]"
- All greetings respect mode: Manual = visible · Confirmed = visible · Autonomous = SHORTER & rarer (don't spam)

### Files
- `src/renderer/overlay.js` — replace `tickFreeRoam` with `tickAnchored` (anchored + repel + teleport-back)
- `src/main/main.mjs` — track focused-window position, push to overlay via IPC every 500ms
- `src/renderer/overlay.html` — add greeting-bubble + 10-min chat-bubble templates

### Acceptance
- Globe spawns at top-center of Settings window on launch
- Move cursor near globe → repels smoothly
- Stop moving → globe teleports back to top-center within 2s
- On launch: "Hi" bubble visible for 4s
- 10min mark: chat bubble appears

═══════════════════════════════════════════════════════════════
## §3 · Live globe icons everywhere (replace gold "A")
═══════════════════════════════════════════════════════════════

Ahmad: "Replace the globe icons within the app on the top-left and bottom-left with the LIVE ARIA globe from iisupp.net/aria. This app should feel like ARIA downloaded on the desktop."

### Source
The live globe is in `iisupp-net-deploy/aria-core.js` (the rotating gold ring + breathing core SVG). Extract the SVG markup into `src/renderer/aria-live-globe.svg` — keep the rotation/breathe CSS animations intact.

### Replace
- Settings rail header `.brand-globe` (currently 48px gold A) → live globe SVG, 48px, animated
- Settings rail footer `.rail-footer .aria-living-globe` → live globe SVG, 96px, animated
- The floating overlay globe → ALREADY the same crystal-A; keep as the desktop-presence avatar (different identity from in-window brand globe)
- Chrome ext icons (16/32/128) → re-render from live globe SVG → replace `chrome-extension/icons/*` (similar for edge + safari)
- App icon (build/icon.ico) → **NO change** (Windows install icon stays the crystal A)

### Acceptance
- Open Settings → top-left header shows the rotating ARIA globe (matches iisupp.net/aria)
- Bottom-left footer shows the larger rotating globe
- Side-by-side comparison: open iisupp.net/aria + Settings — globe matches visually

═══════════════════════════════════════════════════════════════
## §4 · ARIA-brain integration (chat = live iisupp.net/aria)
═══════════════════════════════════════════════════════════════

Ahmad: "The chat field in the modes tab needs to be the LIVE ARIA we have at iisupp.net/aria. This app should be linked to iisupp.net/aria brain. Other versions we build should also run off ARIA's brain."

### Architecture
- New `src/shared/aria-brain-client.mjs`:
  ```js
  export async function askAria(prompt, { sessionId, deviceId, licenseKey }) {
    const r = await fetch("https://iisupp.net/.netlify/functions/aria-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sentinel-Device": deviceId, "X-Sentinel-License": licenseKey },
      body: JSON.stringify({ prompt, session_id: sessionId, source: "sentinel-desktop" })
    });
    return r.json();  // { reply, session_id, action?: 'open-recipe' | 'escalate' | null }
  }
  ```
- The existing `/aria-chat` Netlify function already handles iisupp.net/aria chat — confirm it accepts the `source: "sentinel-desktop"` header and returns same brain
- Mode tab chat input + globe bubble chat input BOTH call `askAria()`
- Streaming response surfaces token-by-token if /aria-chat supports it; otherwise full-reply on resolve

### Escalation flow (Ahmad's spec)
ARIA's reply behavior when asked an issue:
1. **KB-first** — check local KB via `kb-lookup.mjs` (recipe matches first). Reply with recipe option.
2. If no KB match → reply "Investigating now..." + check **screen errors** (currently visible windows for error dialogs via `EnumWindows`) + **event log** (last 60s warn/error)
3. If still no match → "Researching..." → call `iisupp.net/.netlify/functions/aria-research` (existing Research Agent → ChatGPT/Claude + trusted-source web fetches)
4. If found → apply fix (with gate per mode) → respond
5. If still unsolved → escalate: create ticket in customer's ServiceNow bin (per RUN 1 wiring) + reply "I've opened a ticket. For faster help, call 647-581-3182 or email ahmad.wasee@iisupp.net"

### Privacy allowlist
- Add ONE more path to `network-capture.mjs`: `/.netlify/functions/aria-chat` and `/.netlify/functions/aria-research` (extending the 8-path total)
- Tests must prove no other iisupp.net path leaks

### Acceptance
- Type "outlook wont open" in Mode chat → POSTs to /aria-chat → ARIA replies with local recipe option (same response as iisupp.net/aria)
- Same query in globe chat bubble → identical brain reply
- Disable wifi → reply gracefully degrades to local KB only with "research unavailable offline"

═══════════════════════════════════════════════════════════════
## §5 · Admin-only console (gate the entire admin surface)
═══════════════════════════════════════════════════════════════

Ahmad: "The admin console should only show when I log in with my admin credentials. Users should never ever see it. The admin console code should only be built for my credentials."

### Two-layer gate

**Build-time:** package.json adds a build flag `--admin-build`. When set:
- `admin-console/` folder bundled in build.files
- Control Center's "OPEN ADMIN CONSOLE" button rendered
- `aria:open-admin-console` IPC handler registered

When `--admin-build` NOT set (default for customer installs):
- `admin-console/` folder EXCLUDED from build.files (electron-builder skip pattern)
- Button hidden via `if (!IS_ADMIN_BUILD) buttonEl.style.display = 'none'`
- IPC handler stubbed: returns `{ error: 'not-available' }`

Add `npm run package:win:admin` script that sets `IS_ADMIN_BUILD=1` env var → embedded in main.mjs via a constant.

**Runtime gate:** even in admin builds, button only enables after login with admin credentials:
- Settings → About → Account → "Sign in as admin" → modal with email + admin password
- Validates against `ARIA_ADMIN_USERNAME` + bcrypt'd `ARIA_ADMIN_PASSWORD_HASH` env vars (set on Netlify, validated via `/.netlify/functions/aria-admin-auth`)
- On success: write `~/.aria-sentinel/admin-session.json` with HMAC-signed session token (24h expiry)
- Open admin console only if session valid

### Customer-facing builds
- Build with `npm run package:win` (NOT `:admin`) → no admin code shipped
- The build pipeline that publishes to iisupp.net/downloads uses default (customer) build
- Ahmad's personal build uses `npm run package:win:admin`

### Acceptance
- `npm run package:win` → resulting .exe has NO admin-console/ folder inside asar · "Open admin console" button hidden
- `npm run package:win:admin` → admin-console/ bundled · button visible after login
- Customer trying to navigate to admin URL inside their copy → 404

═══════════════════════════════════════════════════════════════
## §6 · Button rename + Stop/Start ARIA flow
═══════════════════════════════════════════════════════════════

Ahmad: "Change 'Resume Watching' to 'Stop ARIA' and another button 'Start ARIA'. When stopped → globe disappears. When started → globe appears + ARIA starts monitoring (screen errors first → event logs → KB → research agent → fix → escalate)."

### Control Center buttons (replace existing 6 with):
1. **Start ARIA** (gold primary) — starts watchers + shows globe + begins active monitoring
2. **Stop ARIA** (ghost) — stops watchers + hides globe + pauses everything
3. **Pause 1 hour** (existing) — temporary pause without full stop
4. **Self Check** (now wired to §1 self-heal engine)
5. **Repair ARIA** (existing)
6. **Open admin console** (admin builds only, §5)

Visual: when Stopped, globe gone + status table shows "ARIA stopped — click Start ARIA to begin".

### Monitoring order (Ahmad's spec)
When started, every 30s cycle:
1. Scan visible window errors (EnumWindows → look for "Error" / "Failed" titles)
2. Check Windows event log last 60s for warn+error
3. For each found issue: look up KB first
4. If KB miss: call research agent
5. If still unsolved: escalate to ServiceNow ticket + show user the live-call CTA

### Acceptance
- Click Stop ARIA → globe vanishes within 200ms · status shows "ARIA stopped"
- Click Start ARIA → globe re-appears at top-center · "Now monitoring..." toast for 3s
- Trigger a test error visible window → ARIA finds it within 30s, surfaces recipe

═══════════════════════════════════════════════════════════════
## §7 · Hotkeys ACTUALLY work
═══════════════════════════════════════════════════════════════

RUN 12's globalShortcut.register apparently didn't bind. Fix:

### Debug + harden
- Wrap each register in try/catch with explicit log line: `"hotkey registered: <combo> → <ok|FAILED reason>"`
- On registration failure, retry with alternate combos (Ctrl+Shift+A as fallback)
- Hotkeys tab now shows live state: `Active · Ctrl+Alt+A → open chat` (green) OR `Failed · Ctrl+Alt+A blocked by <other app>` (amber)
- Add per-row Rebind button: click → captures next 3 keys pressed → registers new combo
- Persist rebinds to electron-store

### Behaviors
- Ctrl+Alt+A → focus Mode tab + focus chat input (`mainWindow.show()` + `mainWindow.webContents.send('focus-chat')`)
- Ctrl+Alt+G → toggle globe visibility (same as Stop/Start ARIA)
- Ctrl+Alt+P → pause 24h

### Acceptance
- Hotkeys tab shows all 3 as "Active" after launch
- Pressing Ctrl+Alt+A from any app → Sentinel window comes forward + cursor in chat input
- Pressing Ctrl+Alt+G → globe toggles
- Test on machine with another app using same combo → fallback registers + Hotkeys tab shows "Active · Ctrl+Shift+A (rebound)"

═══════════════════════════════════════════════════════════════
## §8 · Tests
═══════════════════════════════════════════════════════════════

- `tests/self-heal.test.mjs` (NEW) — enumerate features · detect simulated failure · auto-heal · escalate categorized
- `tests/globe-anchor.test.mjs` (NEW) — anchor math · teleport-back after 2s idle · greeting schedule (random jitter)
- `tests/aria-brain-client.test.mjs` (NEW) — POST shape · header propagation · graceful offline fallback · privacy: no other iisupp.net paths called
- `tests/admin-build-gate.test.mjs` (NEW) — without IS_ADMIN_BUILD env: button hidden + IPC stubbed · with: visible + functional
- `tests/start-stop-aria.test.mjs` (NEW) — Stop disables watchers + hides globe · Start re-enables · monitoring cycle hits KB → research → escalate
- `tests/hotkeys-bind.test.mjs` (NEW) — assert globalShortcut.isRegistered after init · failure path tries fallback
- `tests/live-globe-icons.test.mjs` (NEW) — header + footer + ext icons reference iisupp.net/aria globe SVG (not crystal A)
- Existing 52 suites stay green

Target ~60/60 suites green.

═══════════════════════════════════════════════════════════════
## §9 · Locked rules
═══════════════════════════════════════════════════════════════

- ONE additional dep allowed only if absolutely needed (justify in report); aim for zero new deps
- Privacy allowlist extension: ONE new path (`/.netlify/functions/aria-chat` + optional `/aria-research`) — explicit test coverage proving no other paths leak
- Customer builds (`npm run package:win`) MUST NOT bundle admin-console folder
- Admin auth NEVER hardcoded — env vars only (ARIA_ADMIN_USERNAME, ARIA_ADMIN_PASSWORD_HASH on Netlify)
- Self-heal reports MUST be sanitized (no user content, no stack traces with paths)
- Greetings rate-limit: never spam (>1 message in any 60s window)
- Globe greetings respect low-power mode (RUN 9 toggle) — minimal in low-power
- Visual change: live globe replacement IS a customer-facing visual change. Per Rule 6, write a preview HTML first, screenshot it, paste to Ahmad for approval, THEN ship.
- Write docs/RUN_15_REPORT.md + update §0 + ENTERPRISE_READINESS.md (target 10.0)
- Commit `[sentinel] RUN 15: self-heal engine + globe v3 + ARIA-brain integration + admin-only console + start/stop + hotkey fix + live globe icons`

═══════════════════════════════════════════════════════════════
## §10 · Order of execution (suggested)
═══════════════════════════════════════════════════════════════

1. **Preview** the live-globe-icon swap → screenshot → STOP and wait for Ahmad approval before shipping the visual change (Rule 6)
2. Self-heal engine pure cores + tests — §1
3. Globe v3 (anchor + repel + teleport + greetings) — §2
4. ARIA-brain client + allowlist extension + tests — §4
5. Admin-only build gate (`npm run package:win` vs `:admin`) — §5
6. Start/Stop ARIA + button rename + monitoring cycle — §6
7. Hotkey hardening + rebind UI — §7
8. Apply live globe icons (after Ahmad's preview approval) — §3
9. Tests pass (≥60/60)
10. Report + commit

Ship it.
