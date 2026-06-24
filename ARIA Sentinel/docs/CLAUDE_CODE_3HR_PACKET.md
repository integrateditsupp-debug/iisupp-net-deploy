# Claude Code — 3-hour ARIA Sentinel build packet

**Owner:** Ahmad Wasee · Integrated IT Support Inc.
**Date:** 2026-06-19
**Source of truth:**
- `ARIA Sentinel/docs/CLAUDE_CONTINUE_PROMPT.md` (Ahmad's UI-split correction — already implemented)
- `ARIA Sentinel/design_handoff_aria_sentinel/` (Claude Design hi-fi reference — globe.html, copy.md, tokens.css, README.md)
- `iisupp-net-deploy/docs/CODEX-COMPLETE-PACKAGE-A-Z.md` (the master Codex spec)

**Mandate:** 3 hours nonstop. No 15-min check-ins. The design is locked, the architecture is correct. Build what's listed in §B-§I against the acceptance criteria in §J. When done, run §K. Hand off to Ahmad with §L report shape.

---

## §A · CURRENT STATE INVENTORY (do NOT re-do these)

| File | Lines | State |
|---|---|---|
| `src/main/main.mjs` | 969 | ✅ Electron lifecycle correct: tray + overlay + main window + bridge server (port 37841) + state store + content-blind detect path. `Menu.setApplicationMenu(null)` + `autoHideMenuBar` already added. `makeTrayImage()` is the polished gold globe SVG (Cowork pass). `simulateAriaDetection()` is wired to the tray menu. |
| `src/main/preload.mjs` | 41 | ✅ IPC bridge: all `sentinel.*` APIs exposed. |
| `src/renderer/index.html` | 176 | ✅ 7-tab Settings (Mode default · Recipes · ServiceNow · Knowledge & policy · Privacy verifier · Hotkeys · About). Matches Claude handoff exactly. |
| `src/renderer/renderer.js` | 392 | ✅ Tab routing, mode switching, recipe list rendering, knowledge dropzone, privacy verifier panel, ServiceNow stub form, hotkeys list, about panel. |
| `src/renderer/overlay.html` | 104 | ✅ SVG globe with 6 states (idle/listening/diagnosing/fixing/done/escalation) inlined from `design_handoff_aria_sentinel/globe.html` (Cowork pass). |
| `src/renderer/overlay.js` | 87 | ✅ State-driven globe rendering wired: idle→listening on click; diagnosing on detection; fixing on Open-fix; done/escalation on result. |
| `src/renderer/sentinel.css` | 465 | ✅ Tokens, settings shell, overlay shell, fix card, recipe rows, etc. |
| `src/shared/recipes.mjs` | 1074 | ✅ 25 recipes + 25 BSOD stop codes + routing targets + signatures + matchRecipes() + recipeById() + buildIncidentDraft(). Content-blind. |
| `src/shared/safety.mjs` | 198 | ✅ Sanitization boundary: 21 detection patterns + 28 BSOD stop-code map + sanitizeToSignature() pure function + assertContentSafePayload() + contentSafeContext(). |
| `admin-console/index.html` | 457 | ✅ All 13 nav tabs (Overview · Release Gate · Endpoints · Policies · Recipes · KB Bundles · Stop Codes · Audit Events · Reports · Integrations · Settings · Access · System). Overview panel has Release Gate Status, Content-Blind Telemetry Proof, Endpoint Health donut, Fleet Policy Controls, Recent Audit Events table, Recipe Circuit Breaker, incident cards, Quick Actions. Nav interactivity wired (clicking updates title + subtitle). |
| `chrome-extension/manifest.json` | 41 | ✅ Manifest V3 with activeTab, alarms, browsingData, notifications, scripting, storage, tabs perms + localhost bridge host perm + `<all_urls>` for content script. |
| `chrome-extension/background.js` | ~120 | ✅ Service worker with ping_bridge / clear_origin_cache / reset_service_workers / reset_zoom / browser_signal / ask_sentinel handlers. |
| `chrome-extension/content-script.js` | ~80 | ✅ Globe + fix card injected on every page; observes page errors + password loops + zoom. |
| `chrome-extension/popup.html` | (small) | ✅ Popup chrome. |
| `tests/run-all.mjs` | ✅ | Runs all 6 suites; all green right now. |
| `tests/scenario-suite.mjs` | ✅ | 25 scenarios covering recipe match + sanitization. |
| `tests/extension.test.mjs` | ✅ | Chrome ext manifest validation. |
| `tests/privacy-audit.mjs` | ✅ | Content-blind validation. |
| `tests/ui-shell.test.mjs` | ✅ | 7-tab desktop + 13-tab admin split enforcement. |
| `tests/endpoint.test.mjs` | ✅ | Netlify endpoint contract validation. |
| `docs/CLAUDE_CONTINUE_PROMPT.md` | ✅ | Ahmad's UI-split correction (already executed). |
| `docs/RELEASE_NOTES_0.1.0.md` + manifest + SBOM | ✅ | Release artifacts. |
| `docs/PRIVACY_AND_SECURITY.md` + `ENTERPRISE_READINESS.md` + `SECURITY_DISCLOSURE_ADDENDUM.md` | ✅ | Compliance posture docs. |
| `docs/DO_BUY_OR_APPROVE_LATER.md` | ✅ | Items requiring Ahmad's wallet/approval (do NOT touch). |
| `design_handoff_aria_sentinel/` | reference-only | tokens.css, copy.md, README.md, globe.html, globe-loop.html, presentation deck, 6 reference SVGs |

**The shell is solid. The brand is solid. The tests pass. Now build the muscle.**

---

## §B · BLOCK 1 — Real Windows detectors (60 min priority)

The agent currently fires detections only through `simulateAriaDetection()` and the Settings "Simulate ARIA error" button. Wire actual Windows-native watchers. Each watcher:

- Lives in `src/sub-agents/detection/<watcher>.mjs` (NEW folder)
- Polls at the cadence specified
- Emits via `detectIssue(input)` (already in main.mjs) — DO NOT bypass; that path enforces content-blind sanitization
- Pauses when laptop is on battery + screen locked OR when user has paused agent (`pausedUntil` in store)

### B-1 · `disk-watcher.mjs` (2s poll, 30s interval; default 5min)
- Spawn PowerShell child: `Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,FreeSpace,Size | ConvertTo-Json`
- Parse JSON; for each drive compute `FreeSpace / Size`
- If `< 0.05` (5%) on system drive (C: or first drive): emit `signal: 'DISK.LOW_SPACE'`
- Debounce: only fire once per drive per 60min unless free space drops further

### B-2 · `event-log-watcher.mjs` (60s interval)
- PowerShell: `Get-WinEvent -FilterHashtable @{LogName='System'; Level=1,2; StartTime=(Get-Date).AddSeconds(-120)} -MaxEvents 50 | Select-Object Id, ProviderName, TimeCreated, LevelDisplayName | ConvertTo-Json`
- Map provider+id pairs to symbolic codes:
  - `Microsoft-Windows-Kernel-Power` id 41 → `BSOD.UNEXPECTED_SHUTDOWN`
  - `Service Control Manager` id 7000-7099 → `SYSTEM.SERVICE.STOPPED`
  - `Microsoft-Windows-WHEA-Logger` → `HARDWARE.WHEA_ERROR`
  - `disk` id 7,11,51 → `DISK.HARDWARE_FAULT`
- Drop anything outside the map (no upload of unknown raw error text)

### B-3 · `perf-watcher.mjs` (5s poll)
- PowerShell: `Get-Counter -Counter '\Processor(_Total)\% Processor Time','\Memory\% Committed Bytes In Use' -SampleInterval 1 -MaxSamples 1 | ConvertTo-Json`
- Sliding window of last 60 samples
- If CPU sustained `> 85%` for 5min → emit `SYSTEM.SLOW.HIGH_CPU`
- If RAM sustained `> 90%` for 5min → emit `SYSTEM.SLOW.HIGH_RAM`
- Debounce 30min per signal

### B-4 · `crash-control-watcher.mjs` (run once at agent startup + every 5min)
- Read registry: `Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\CrashControl' | Select LastBSODTime, LastBSODStopCode`
- Glob `C:\Windows\Minidump\*.dmp` files; track newest timestamp seen
- If a new minidump appeared since agent's last `LastKnownGoodBoot` (stored in electron-store): emit `BSOD.<STOP_CODE>` using the existing STOP_CODE_MAP in `src/shared/safety.mjs`
- Surface as **Confirmed-mode** card on next user interaction (regardless of agent mode)

### B-5 · `service-watcher.mjs` (60s interval; 8 critical services)
- For each of: `Spooler`, `Audiosrv`, `BITS`, `wuauserv`, `LanmanWorkstation`, `Dnscache`, `WinDefend`, `OneSyncSvc`:
- `Get-Service -Name <name> | Select Status`
- If `Stopped` and was `Running` previously → emit `SYSTEM.SERVICE.STOPPED.<service>`
- Debounce 60min per service

### B-6 · `network-watcher.mjs` (30s interval)
- `Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | Measure-Object` — drop from >0 to 0 → emit `NET.ADAPTER.DOWN`
- `Test-DnsResolution -Server (Get-DnsClientServerAddress -InterfaceAlias 'Wi-Fi').ServerAddresses[0] -Name google.com` — fails twice in a row → emit `NET.DNS.FAIL`
- Existing `NET.ADAPTER.APIPA` pattern already in safety.mjs — wire it.

### B-7 · `wer-watcher.mjs` (60s interval, latest 5 reports)
- Glob: `C:\ProgramData\Microsoft\Windows\WER\ReportArchive\*\*.wer`
- Read AppName + ExceptionCode + FaultingApp from .wer file metadata (NOT body)
- Map AppName=OUTLOOK.EXE → `APP.OUTLOOK.OST_CORRUPT`; AppName=Teams.exe → `APP.TEAMS.SIGNIN_LOOP`; AppName=ONEDRIVE.EXE → `APP.ONEDRIVE.SYNC_STUCK`
- Drop anything else (no upload of unknown app crash names — symbolic-only)

### B-8 · `detection-orchestrator.mjs`
- Lives in `src/sub-agents/detection/index.mjs`
- Imports the 7 watchers above
- On `app.whenReady()`: starts them all, registered in `getState().watcherStatus`
- Exposes `stopAll()` + `pause(ms)` for the per-endpoint kill switch
- Honors `store.get('pausedUntil')` — all watchers no-op when paused
- Honors `bridgeStatus.killed` (set by control plane `/aria-recipes` when fleet kill-switch trips)

### B-9 · Wire into main.mjs
- Import `startDetectionOrchestrator()` in main.mjs
- Call from `app.whenReady()` after `createTray()` + `createOverlayWindow()`
- Pass `detectIssue` callback so watchers go through existing content-blind path

### Watcher safety contract (TEST GATE)
- New test file: `tests/watchers.test.mjs`
- For each watcher: feed 100 fuzzed inputs containing fake PII (`john.doe@acme.com`, `/Users/jdoe/Documents/Q4-acquisition-strategy.docx`, `Card ending 4242`, real-looking SSNs, real-looking URLs)
- Assert: every signal emitted by the watcher passes `assertContentSafePayload()` (no PII strings, no full paths, no URLs — only symbolic codes + enum file classes)
- If any watcher leaks: test fails, blocks merge

---

## §C · BLOCK 2 — Cursor-dodge floating globe physics (25 min)

The overlay window currently sits frozen at top-center. Per `design_handoff_aria_sentinel/README.md` §Globe motion: it should dodge the cursor + snap to corners + edge-drift.

### C-1 · Mouse-forward setIgnoreMouseEvents
- In `createOverlayWindow()`: `overlayWindow.setIgnoreMouseEvents(true, { forward: true })`
- Track mousemove via `mousemove` IPC from a tiny invisible companion content script
- When cursor enters the 80px globe hitbox: `setIgnoreMouseEvents(false)` so click reaches the globe button
- When cursor leaves: re-enable click-through

### C-2 · Edge-hugging drift
- New file `src/main/overlay-physics.mjs` exports `tickPhysics(overlayWindow, cursorPos)`
- Globe drifts ~10px/s along nearest edge of work area
- If cursor within 80px of globe: globe slides AWAY along the edge at 200ms linear ease
- Corner-snap with 30% magnetism (when within 60px of a corner)
- Bob: ±3px vertical sine wave at 4.2s period (controlled in CSS via existing `aria-glow` keyframe)
- `requestAnimationFrame`-equivalent: `setTimeout` at 33ms (30fps) when idle, 16ms (60fps) when state ≠ idle. Drop to 30fps after 5s idle (already specified in design tokens).

### C-3 · Multi-monitor + DPI
- Use `screen.getCursorScreenPoint()` to track cursor regardless of monitor
- `screen.getDisplayNearestPoint(cursor)` to constrain globe to current display's work area
- Card never spans monitors (already constrained by `topCenterOverlayBounds`)

### C-4 · Test
- Add `tests/overlay-physics.test.mjs` — pure function test of the dodge math
- Feed: cursor positions, current globe position, work area
- Assert: new globe position is always on the edge, always ≥ 80px from cursor, never enters screen interior

---

## §D · BLOCK 3 — Chrome extension wiring (30 min)

Extension is scaffolded but a few detection paths are missing.

### D-1 · Cache-stale auto-detect
- In `content-script.js` `observePageErrors()`: hook into `PerformanceObserver` for `resource` entries with status >= 400
- If 3+ failures within 10s on same origin: auto-show globe + fix card with `CACHE.STALE`

### D-2 · Service-worker-stuck auto-detect
- `navigator.serviceWorker.getRegistrations()` → for each, if activation took > 30s OR state stuck `installing` > 60s → emit `SERVICE.WORKER.STUCK`

### D-3 · Login retry loop
- Already partially wired in `observePasswordLoops()` — verify it tracks `submit` events with input[type=password], counts per-origin, triggers `AUTH.LOGIN.RETRY_LOOP` after 2 failures

### D-4 · Zoom-weird
- `observePagezoom()` already detects > 200% / < 50% — verify card shows + fix calls `RESET_ZOOM`

### D-5 · Bridge offline graceful
- `popup.js` shows "Bridge: online/offline" badge
- If bridge offline > 5min, alarm pings every 60s to retry
- Content script still works without bridge (cache/cookie/zoom fixes are all in-extension)

### D-6 · Test
- Extend `tests/extension.test.mjs`:
  - Verify all 6 detection paths exist as listeners
  - Assert no eval / no Function constructor / no remote script load (MV3 compliance)
  - Assert no PII string ever passed to chrome.runtime.sendMessage (mock + spy)

---

## §E · BLOCK 4 — Admin console: interactive tabs with content per screenshot (40 min)

Currently only the **Overview** tab has content. The other 12 are stubs. Per Ahmad's "more pixel-faithful" directive, ship content panels for all 13.

### E-1 · Refactor structure
- Convert each nav button to `<button data-view="overview|release|...">` with matching `<section data-view="..." hidden>` panels
- Existing `nav-interactivity` script: toggle `hidden` on panels + active class on buttons

### E-2 · Content per tab (use existing tokens.css palette + design from screenshot)

| Tab | Content |
|---|---|
| **Overview** | (already done) |
| **Release Gate** | Header: "Release Gate History" · Table: timestamp / bundle hash / verdict (PASS/FAIL) / reason / size MB. 5 mock rows. Right panel: "Manual override" with audit-log warning. |
| **Endpoints** | Filter row: search / status / region / KB version. Table: hostname / user / OS / KB version / last seen / health / SLA. 8 mock rows. Right panel: bulk actions (push KB, pause, request logs). |
| **Policies** | Card grid: per policy set (Standard Enterprise, Healthcare, Finance, BYOD) with active endpoints + revision + last activated. Right panel: "Create policy" + "Import customer KB" gated dropzone. |
| **Recipes** | Table: recipe id / family / risk / success% (28d) / canary status / fleet attempts (24h) / breaker state. 12 rows. Right panel: per-recipe enable/disable + circuit breaker. |
| **KB Bundles** | Cards: current bundle, last 3 bundles, stop-codes bundle. Each: hash, signed by, size, regions, fleet adoption %. |
| **Stop Codes** | Table of 25 BSOD codes from `src/shared/recipes.mjs` STOP_CODES with hex / likely causes / local steps / escalation copy column. |
| **Audit Events** | Larger version of Overview's audit table — 30 rows, with filter (event type / endpoint / user / time range) + Export CSV / JSON. |
| **Reports** | Cards: weekly fleet health summary · monthly cost saved estimate · top 10 recipes · top 10 stop codes. Each clickable to drill down. |
| **Integrations** | Card grid: ServiceNow (CONNECTED / NOT CONNECTED), Slack, Microsoft 365 Graph, Jira, Webhook, Email. Each card: status badge + "Connect" / "Disconnect" button. |
| **Settings** | Form: owner email · admin token rotation · auto-update channel (stable/beta) · default mode · default tier · timezone. Save button. |
| **Access** | Operators table: name / role / MFA status / last login. Right panel: invite operator + role permissions matrix. |
| **System** | Service health card: backend version · region map · DB status · queue depth · last cron heartbeat. |

### E-3 · Mock data file
- New file `admin-console/mock-data.json` — all tab content drives from this so it's easy to wire to real backend later

### E-4 · Test
- Extend `tests/ui-shell.test.mjs`: assert all 13 panels exist (`<section data-view="...">`) + each has at least one card / table / form

---

## §F · BLOCK 5 — ServiceNow connector stub (proper, dry-run by default) (20 min)

### F-1 · New file `src/shared/servicenow.mjs`
- Exports `createIncident({ shortDesc, description, category, recipeId, outcome, iisInternalId })`
- Constructs Table API POST body to `/api/now/table/incident`
- Reads URL + username + password from env (`SN_INSTANCE_URL`, `SN_USER`, `SN_PASS`) OR returns dry-run object if env missing
- Returns `{ ok, number, sysId, raw }` on success OR `{ ok: false, error, queued: true }` on offline

### F-2 · Queue + retry
- Local SQLite-backed queue at `~/.aria-sentinel/sn-queue.db` via electron-store (already in deps)
- On agent startup, drain queue if SN reachable
- Show queue depth in Settings → ServiceNow panel

### F-3 · Settings UI wire
- "Test connection" button in Settings → ServiceNow tab actually calls `ping()` instead of stub
- Show: "Connected · last verified <ago>" / "Offline · 3 queued" / "Not configured"

### F-4 · Test
- New `tests/servicenow.test.mjs` — mock fetch, verify body shape, verify no PII (caller field uses Windows SID hash only, never real name/email), verify queue+retry on 503

---

## §G · BLOCK 6 — Knowledge & policy ingester scaffold (20 min)

Settings → Knowledge & policy has a dropzone today. Wire it to actually accept files locally.

### G-1 · `src/shared/kb-ingester.mjs`
- Accepts: PDF, DOCX, MD, TXT
- Stores raw under `~/.aria-sentinel/kb/<sha256>.bin`
- Extracts text:
  - MD/TXT → as-is
  - DOCX → use `mammoth` if installed; OTHERWISE just store raw + mark "Awaiting text extraction"
  - PDF → use `pdfjs-dist` if installed; OTHERWISE same fallback
- Computes chunks (~512 tokens) into `~/.aria-sentinel/kb/chunks.jsonl`
- Updates `knowledgeSources` in electron-store
- **Content-blind contract:** chunks NEVER leave the device. Only chunk hashes + counts may surface in audit log.

### G-2 · Policy overlay parser
- `src/shared/policy.mjs` exports `parsePolicyOverlay(jsonString) → PolicyOverlay`
- Strict schema: `{ recipes_disabled[], business_hours, confirmation_threshold, escalation_contacts[] }`
- Anything outside schema: silently strip (parser is the gate per spec §F)
- Test: feed 50 injection attempts, assert each is stripped

### G-3 · Wire into Settings dropzone
- `renderer.js` drag/drop handler → call `kb-ingester.ingest(file)` → update knowledgeSources row → refresh

---

## §H · BLOCK 7 — Kill switches + per-customer config (15 min)

### H-1 · Per-endpoint pause (already done)
- Tray menu "Pause for 24 hours" ✓

### H-2 · Per-customer
- Backend `/aria-recipes` already supports filtering; add `?customer=<slug>` query param
- Local cache stores active customer policy bundle
- New `src/shared/customer-config.mjs`: reads `~/.aria-sentinel/customer.json` (set at install by MDM) — pinned customer ID overrides default

### H-3 · Global (control plane)
- `/aria-recipes` response can include `{ killed: true, reason }` — when present, agent enters detect-only mode (no fix execution), shows banner in Settings
- Test: mock response with `killed: true` → assert `runRecipe()` returns `{ ok: false, error: 'control_plane_killed' }`

---

## §I · BLOCK 8 — Test gates (25 min)

### I-1 · Content-leak fuzz (release blocker)
- New `tests/content-leak.test.mjs`
- Generate 1000 fuzzed inputs containing canary phrases (real-looking PII, full file paths, URLs with query strings, document title strings)
- Run each through `sanitizeToSignature()` + verify output never contains any canary phrase
- Run each through `assertContentSafePayload()` + verify no false-positive rejections
- Block CI on fail

### I-2 · Idempotency
- New `tests/idempotency.test.mjs`
- For each recipe in `recipes.mjs`: simulate execute() with same `execution_id` twice → second invocation MUST return cached outcome, not re-run side effects
- Inject `recipe-cache.sqlite` mock

### I-3 · Policy injection
- New `tests/policy-injection.test.mjs`
- 50 attempts: `{ exec_command: "..." }`, `{ new_action: {...} }`, `{ ALLOWED_ACTIONS: {...} }`, `<script>` payloads, etc.
- Parser must silently strip all; ALLOWED_ACTIONS must remain code-defined only

### I-4 · Update `tests/run-all.mjs`
- Add the 3 new suites to the run-all sequence
- Assert all 9 suites green before exit

---

## §J · ACCEPTANCE CRITERIA (must all pass before handoff)

- [ ] `node tests/run-all.mjs` exits 0 with all 9 suites green
- [ ] `node --check` clean on every `.mjs` + `.js` in `src/` + `chrome-extension/`
- [ ] `npm start` launches Electron without console errors
- [ ] Tray icon = polished gold globe (NOT square)
- [ ] Settings window has NO menubar
- [ ] Overlay globe is the SVG with 6 states (NOT CSS div)
- [ ] Right-click tray → "Simulate ARIA detection" → globe expands, fix card slides up with action buttons
- [ ] Admin console: all 13 tabs clickable + each shows distinct content panel
- [ ] Privacy verifier panel shows zero outbound paths to iisupp.net for user content
- [ ] No file in `src/` references any URL or hostname outside this whitelist:
  - `https://iisupp.net/.netlify/functions/aria-recipes`
  - `https://iisupp.net/.netlify/functions/aria-stop-codes`
  - `https://iisupp.net/.netlify/functions/aria-kb-bundle`
  - `https://iisupp.net/.netlify/functions/aria-binary-update`
  - `https://iisupp.net/.netlify/functions/aria-recipe-feedback` (opt-in only)
  - `http://127.0.0.1:37841/*` (local bridge)
  - `http://localhost:37841/*` (local bridge)

---

## §K · RUN BEFORE HANDOFF

```powershell
# 1. Syntax sanity
cd "ARIA Sentinel"
foreach ($f in @(
  "src\main\main.mjs","src\main\preload.mjs",
  "src\renderer\renderer.js","src\renderer\overlay.js",
  "src\shared\recipes.mjs","src\shared\safety.mjs",
  "src\shared\servicenow.mjs","src\shared\kb-ingester.mjs","src\shared\policy.mjs","src\shared\customer-config.mjs",
  "src\main\overlay-physics.mjs",
  "src\sub-agents\detection\index.mjs",
  "src\sub-agents\detection\disk-watcher.mjs",
  "src\sub-agents\detection\event-log-watcher.mjs",
  "src\sub-agents\detection\perf-watcher.mjs",
  "src\sub-agents\detection\crash-control-watcher.mjs",
  "src\sub-agents\detection\service-watcher.mjs",
  "src\sub-agents\detection\network-watcher.mjs",
  "src\sub-agents\detection\wer-watcher.mjs",
  "chrome-extension\background.js","chrome-extension\content-script.js","chrome-extension\popup.js"
)) { node --check $f }

# 2. Test suite
npm test

# 3. Privacy audit
npm run audit

# 4. Scenario suite
npm run scenario:test

# 5. Launch
npm start
```

---

## §L · HANDOFF REPORT SHAPE (paste in chat to Ahmad when done)

```
ARIA Sentinel — 3-hour build complete

BUILT:
- 7 Windows detectors wired (disk, event log, perf, crash control, service, network, WER)
- Cursor-dodge overlay physics with multi-monitor + DPI support
- 12 admin console tabs now interactive with content (was Overview-only)
- ServiceNow connector with queue+retry
- KB ingester for PDF/DOCX/MD/TXT (local-only, content-blind)
- Policy overlay parser with injection-defense gate
- Kill switches: per-endpoint (done) + per-customer + global (new)

TESTS:
- 9/9 suites green (was 6)
- New: content-leak fuzz (1000 inputs), idempotency, policy-injection
- node --check clean on 25 .mjs/.js files

LAUNCH:
- npm start brings up frameless gold globe, no menubar, polished tray
- Tray → Simulate detection → globe diagnoses → fix card → done
- Settings → Knowledge tab drop a PDF → indexes locally
- Admin console: every nav tab now shows distinct content per screenshot

REMAINING (out of 3hr scope):
- Real PowerShell child process scaffolding (watchers are wired, scripts are stubbed; need elevated test on actual Windows hardware)
- Chrome extension end-to-end against a real Chrome instance
- BSOD Tier A BCD entry installer (requires UAC, defer to packaging sprint)
- Code signing (DO_BUY_OR_APPROVE_LATER list — Ahmad's call)

FILES TOUCHED: <list>
FILES UNTOUCHED (per "if it's working don't touch it"): src/shared/recipes.mjs, src/shared/safety.mjs, src/renderer/index.html, src/renderer/renderer.js (except KB dropzone wire), tokens.css, copy.md.
```

---

## §M · DO NOT TOUCH

- `design_handoff_aria_sentinel/` — reference only, never edit
- `docs/DO_BUY_OR_APPROVE_LATER.md` — Ahmad's wallet items
- `docs/RELEASE_*` / `docs/SBOM*` / `docs/SECURITY_DISCLOSURE_*` — release artifacts, append-only
- `package.json` `dependencies` — DO NOT add new deps without approval (mammoth and pdfjs-dist for KB ingester: try first, fall back to "Awaiting text extraction" if missing — DO NOT auto-install)
- Existing `recipes.mjs` recipe IDs — extend, never rename (downstream tests + KB depend on stable IDs)
- Brand tokens in `design_handoff_aria_sentinel/tokens.css` — copy from but don't modify

---

## §N · CONTEXT IN ONE LINE

You're extending a Codex MVP that's already shipped a content-blind Electron agent + Chrome extension + admin console + 25 recipes + tests. The shell, brand, and architecture are correct. Build the muscle (detectors + physics + admin content + connectors + tests). 3 hours. No check-ins. Ship.
