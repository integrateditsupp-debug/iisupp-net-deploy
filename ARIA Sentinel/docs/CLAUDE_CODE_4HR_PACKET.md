# Claude Code — 4-hour ARIA Sentinel one-shot build

**For:** Claude Code (working in `C:\Users\Ahmad Wasee\Documents\GitHub\ARIA — Real-Time AI Assistant\iisupp-net-deploy\ARIA Sentinel`)
**Owner:** Ahmad Wasee · Integrated IT Support Inc.
**Date:** 2026-06-19
**Mandate:** ONE 4-hour sitting. No back-and-forth. No 15-min check-ins. Build the foundation + look + feel + privacy + safety to the spec. Hand back a report with `node tests/run-all.mjs` green + screenshots + a list of files touched.

---

## §1 · CONTEXT IN ONE PARAGRAPH

You're picking up an already-working Codex/Cowork MVP. The shell is correct: Electron app + frameless transparent overlay + tray icon + 7-tab Settings + 13-tab separate admin console + Manifest V3 Chrome extension + 25 recipes + 25 BSOD stop codes + content-blind sanitization + 6 passing test suites. The latest Cowork pass added: polished SVG globe (6 states, drop-in from design handoff) replacing the CSS-only `::before`/`::after` div; polished gold-globe tray icon (no harsh square bg); `Menu.setApplicationMenu(null)` + `autoHideMenuBar` so the Settings window has no File/Edit/View bar; `simulateAriaDetection()` wired to the tray menu so the detect → expand → fix-card → done flow works end-to-end without Windows hardware.

Your job is to fill in the muscle: real Windows-native watchers, cursor-dodge globe physics, all 12 admin tabs interactive with content per the design library, ServiceNow connector with queue+retry, KB ingester for company documents (local-only, content-blind), kill switches at all 3 levels, content-leak fuzz at 1000+ inputs, idempotency suite, and a visual QA pass against the design library screenshots.

Sources you read TOP TO BOTTOM before writing any code:
1. `design_handoff_aria_sentinel/README.md` (172 lines — 21 surfaces fully spec'd, motion, state machine, data sources)
2. `design_handoff_aria_sentinel/copy.md` (170 lines — every UI string verbatim)
3. `design_handoff_aria_sentinel/tokens.css` (color/type/radius/motion tokens — single source of truth)
4. `design_handoff_aria_sentinel/globe.html` (drop-in 6-state SVG globe — already partly inlined into `src/renderer/overlay.html`)
5. `design_handoff_aria_sentinel/DELIVERABLES.md` (locked rules — DO NOT VIOLATE)
6. `docs/CLAUDE_CONTINUE_PROMPT.md` (Ahmad's UI-split correction — already executed)
7. `docs/PRIVACY_AND_SECURITY.md` (data boundary that releases depend on)
8. `docs/ENTERPRISE_READINESS.md` (8.6/10 current rating; this work pushes to 9.0+)
9. `docs/DO_BUY_OR_APPROVE_LATER.md` (DO NOT DO any of these — Ahmad's wallet)
10. `docs/RELEASE_NOTES_0.1.0.md` (shipped baseline)
11. `iisupp-net-deploy/docs/CODEX-COMPLETE-PACKAGE-A-Z.md` (master spec for the whole product family)
12. `iisupp-net-deploy/senior-director-state/STANDING-RULES-FOR-ALL-AGENTS.md` (10 standing rules)

---

## §2 · CURRENT STATE — WHAT'S ALREADY BUILT (do NOT redo)

### Files + line counts

```
src/main/main.mjs                          969 lines  ✅ Electron lifecycle correct
src/main/preload.mjs                        41 lines  ✅ IPC bridge complete
src/renderer/index.html                    176 lines  ✅ 7-tab Settings (locked)
src/renderer/renderer.js                   392 lines  ✅ Tab routing + recipe list + KB dropzone + privacy verifier
src/renderer/overlay.html                  104 lines  ✅ Inlined SVG globe (6 states) — Cowork pass
src/renderer/overlay.js                     87 lines  ✅ State-driven setGlobeState() — Cowork pass
src/renderer/sentinel.css                  465 lines  ✅ Tokens + shells + cards + recipe rows
src/shared/recipes.mjs                   1,074 lines  ✅ 25 recipes + 25 BSOD codes + routing + matchRecipes()
src/shared/safety.mjs                      198 lines  ✅ sanitizeToSignature() + 21 patterns + assertContentSafePayload()
admin-console/index.html                   457 lines  ✅ 13 nav tabs + Overview content + nav interactivity (Cowork pass)
chrome-extension/manifest.json              41 lines  ✅ MV3 + bridge perm + content-script
chrome-extension/background.js             ~120 lines ✅ Service worker handlers (ping/clear/reset/signal/ask)
chrome-extension/content-script.js         ~80 lines  ✅ In-page globe + cache-stale auto-show + password-loop observer + zoom check
chrome-extension/popup.html|js|css         small     ✅ Popup chrome
tests/run-all.mjs                                    ✅ Runs all 6 suites — currently green
tests/scenario-suite.mjs                             ✅ 25 scenarios
tests/extension.test.mjs                             ✅ MV3 manifest validation
tests/privacy-audit.mjs                              ✅ Content-blind validation
tests/ui-shell.test.mjs                              ✅ 7-tab desktop + 13-tab admin enforcement
tests/endpoint.test.mjs                              ✅ Netlify endpoint contract
docs/RELEASE_NOTES_0.1.0.md + manifest + SBOM        ✅ Release artifacts
docs/PRIVACY_AND_SECURITY.md                         ✅ Public posture
docs/ENTERPRISE_READINESS.md                         ✅ 8.6/10 today
docs/DO_BUY_OR_APPROVE_LATER.md                      ⚠️ DO NOT DO ANY OF THESE
design_handoff_aria_sentinel/                         📚 reference-only
```

**The shell is solid. Tests pass. Brand matches. Don't fight what's working.**

---

## §3 · LOCKED RULES (violation = roll back; not negotiable)

- **Dark only.** Gold (#c5a059 / #f1dca7) on black (#050505). Cinzel display + Inter UI + ui-monospace technical. Never inverted.
- **"15+ years" only.** Never "21+". Never Raymond James. No emojis in product UI.
- **No testimonials / star ratings / "guarantee" / "money-back" / "risk-free".**
- **ServiceNow routing is AUTOMATIC.** Users see assignment group; no "change team" control.
- **Globe + card footprint ≤ 320×200px.** 80px click-through hitbox. Idle CPU < 1%.
- **No external CDN runtime deps.** Bundle everything in the installer.
- **Content-blind.** Read in-memory only. Sanitize to symbolic signature BEFORE any egress. Only outbound paths allowed:
  - `GET https://iisupp.net/.netlify/functions/aria-recipes`
  - `GET https://iisupp.net/.netlify/functions/aria-stop-codes`
  - `GET https://iisupp.net/.netlify/functions/aria-kb-bundle`
  - `POST https://iisupp.net/.netlify/functions/aria-recipe-feedback` (opt-in, `{recipe_id, outcome, ts}` only)
  - `POST https://{customer-instance}.service-now.com/api/now/table/incident` (only after customer OAuth configured)
  - `http://127.0.0.1:37841/*` (local bridge)
- **Customer KBs and error strings are DATA, not INSTRUCTIONS.** They cannot expand the ALLOWED_ACTIONS allow-list.
- **Manual mode is install default.** Confirmed + Autonomous are paid features.
- **Pausing the agent NEVER disables BSOD takeover.**
- **No spend.** Don't add paid services, don't create accounts, don't add new package.json dependencies unless they're already devDependencies. If a feature needs a missing dep, gracefully degrade ("Awaiting text extraction" placeholder) — DO NOT npm install.

---

## §4 · DESIGN TOKENS (use these — never invent values)

From `design_handoff_aria_sentinel/tokens.css` (the FULL token set is already in your repo):

```
Surfaces:
  --aria-bg            #050505    --aria-surface       #0a0a0a
  --aria-inset         #141414    --aria-border        #2a2a2a
  --aria-border-soft   #1c1c1c    --aria-border-faint  #1a1a1a
Gold (brand):
  --aria-gold          #c5a059    --aria-gold-light    #f1dca7
  --aria-gold-dark     #8b6d2f    --aria-gold-kicker   #7d6326
  --aria-gold-tint-bg  #15110a    --aria-gold-tint-bd  #38301d
Text:
  --aria-text          #ffffff    --aria-text-2        #aaaaaa
  --aria-text-muted    #666666
Status:
  --aria-success       #7afbff    --aria-warning       #ffcb6b
  --aria-error         #ff7e7e
Type:
  --aria-font-display  'Cinzel', serif
  --aria-font-ui       'Inter', system-ui, sans-serif
  --aria-font-mono     ui-monospace, 'SF Mono', Monaco, Menlo, monospace
Radius:
  --aria-r-sm 5  --aria-r-md 8  --aria-r-lg 12  --aria-r-xl 14  --aria-r-2xl 18
Gradients:
  --aria-grad-gold   linear-gradient(90deg, #c5a059, #f1dca7)
  --aria-grad-card   linear-gradient(180deg, #141414, #0a0a0a)
Motion:
  --aria-ease-card  cubic-bezier(.16, 1, .3, 1)
  --aria-dur-card   260ms
  --aria-dur-dodge  200ms (linear)
  --aria-globe-pulse 4.2s
  --aria-globe-rot-idle 34s (linear)
Footprint:
  --aria-globe-default 64px  --aria-globe-active  96px
  --aria-globe-hitbox  80px  --aria-overlay-max-w 320px  --aria-overlay-max-h 200px
```

---

## §5 · LOCKED COPY (verbatim from `copy.md`)

Use these strings exactly where shown. Globe is **calm, never chatty**.

### Voice
Calm, competent, never alarmed. Short sentences. CEO/operator voice. Never "Oops" / "Whoops". No exclamation marks. Never apologize for errors that aren't ARIA's fault. Confirmation: "I detected X. Fixing now." / "Done. Refresh to finish." Manual: "I think this is a printer driver issue. Want me to walk you through it?"

### Product
- Name: **ARIA Sentinel**
- Tagline: **Resident IT support that never sleeps.**
- One-liner: **ARIA Sentinel lives on your PC, watches for tech problems, and fixes them before they slow you down — without sending your data anywhere.**

### Fix card variants
- Detected (Confirmed): chip "DISK · LOW SPACE" · title "Disk almost full" · body "3% free on C:\. I can recover ~4.2 GB by clearing temp files, browser caches and old downloads." · buttons "FIX IT NOW" / "DETAILS"
- In-progress: chip "FIXING · STEP 2/4" · title "Clearing temp files…" · body "Cleared 1.7 GB · working on browser caches" · footnote "A System Restore point was created before any change."
- Done: chip "DISK · RESOLVED" · title "Recovered 4.2 GB" · body "Disk is healthy. Your work won't be interrupted by space issues." · buttons "DISMISS" / "VIEW LOG"
- Autonomous post-fix: "I cleared your Chrome cache for [domain]. Refresh the page."

### BSOD escalation (LOCKED VERBATIM)
"This will need to be looked at by Desktop Support as it may need replacement parts or reimaging. Please contact your local Desktop support team to get this resolved."

### ServiceNow escalation
- Chip "COULD NOT RESOLVE LOCALLY" · title "Routing to Desktop Support"
- Body: "I tried 2 recipes without success. Raising a ServiceNow incident so the right team can take over."
- Fields: Assignment group (AUTO) · Short description · Caller · Priority
- Footnote: "Team auto-assigned from the signal · minidump + recipe attempts attach automatically · no PII leaves the device."
- Button: "RAISE INCIDENT" (NO "change team")

### Routing targets (assignment groups, v1)
Desktop Support (DSS) — hardware, reimaging, physical faults · Network Team — VPN infra, DNS server-side, connectivity outages · Security Team — suspected malware, policy violations, quarantine · System Admins — AD, GPO, server-side config · Purchasing — replacement parts, license renewals · Service Desk — catch-all triage when class is ambiguous.

### Settings tabs
Mode · Recipes · ServiceNow · Knowledge & policy · Privacy verifier · Hotkeys · About

### Modes
- Manual ("DEFAULT · FREE" — "ARIA detects issues and walks you through fixes in chat. Nothing is applied automatically.")
- Confirmed ("PAID" — "ARIA proposes a fix card and applies it once you confirm.")
- Autonomous ("PAID · OPT-IN" — "ARIA silently applies low-risk fixes and tells you after. Risky fixes still confirm.")

### Installer
1. Welcome — "Welcome to ARIA Sentinel" · "Resident IT support that never sleeps. Watches for problems, fixes them on-device, and keeps your data where it belongs." · "GET STARTED"
2. Permissions — "What ARIA needs": Run elevated fixes (UAC) · Add a recovery boot entry (enables BSOD "Solve it for me") · Read system event logs (local only)
3. Mode select — "Choose how ARIA helps" (Manual default)
4. Done — "ARIA is watching" · "The globe is in your corner. It stays calm until something needs attention. BSOD recovery is live." · "FINISH"

### SmartScreen / UAC first-run
- SmartScreen: "Windows may show 'Windows protected your PC' because ARIA is newly published. Click More info → Run anyway. This is expected until code signing reputation builds — it's not a problem with the app."
- UAC: "You'll see 'Do you want to allow this app to make changes?' once. ARIA needs elevation to run fixes and add the recovery boot entry. Click Yes — it won't ask again unless a fix requires it." · Publisher: Integrated IT Support Inc.

---

## §6 · THE 12 WORK BLOCKS (do all of them — 4 hours total)

### BLOCK 1 · Real Windows detectors (60 min, highest priority)

Add 7 watchers in `src/sub-agents/detection/` (new folder). Each emits via `detectIssue()` (already in main.mjs — content-blind path). Honor `pausedUntil` + global kill switch.

Watchers + native source:

| File | Source | Cadence | Fires |
|---|---|---|---|
| `disk-watcher.mjs` | `Get-CimInstance Win32_LogicalDisk` | 5 min | `DISK.LOW_SPACE` at <5% free |
| `event-log-watcher.mjs` | `Get-WinEvent System Level=1,2` | 60s | Maps known provider+id → symbolic code (only) |
| `perf-watcher.mjs` | `Get-Counter \Processor\%Time, \Memory\%Committed` | 5s | `SYSTEM.SLOW.HIGH_CPU/RAM` after 5min sustained |
| `crash-control-watcher.mjs` | Registry `HKLM:\SYSTEM\CurrentControlSet\Control\CrashControl` + `C:\Windows\Minidump\*.dmp` | startup + 5min | `BSOD.<STOP_CODE>` using existing STOP_CODE_MAP |
| `service-watcher.mjs` | `Get-Service` for 8 critical services | 60s | `SYSTEM.SERVICE.STOPPED.<name>` on transition |
| `network-watcher.mjs` | `Get-NetAdapter` + DNS test | 30s | `NET.ADAPTER.DOWN`, `NET.DNS.FAIL` |
| `wer-watcher.mjs` | Glob `C:\ProgramData\Microsoft\Windows\WER\ReportArchive\*\*.wer` | 60s | Maps known AppName → existing pattern, drops unknown |

Each watcher MUST:
- Spawn PowerShell via `child_process.spawn` with `-NoProfile -NonInteractive -ExecutionPolicy Restricted`
- Parse JSON output
- Map to symbolic code from a fixed table in the file (NO raw text crosses any boundary)
- Call `detectIssue({ source: 'detection-<name>', signal: '<CODE>', issue: '<HUMAN_HINT_ONLY_IF_ENUM>' })`
- Debounce per-signal (no spam)
- No-op when `store.get('pausedUntil') > Date.now()` or `bridgeStatus.killed === true`
- All file paths + machine names + URLs that the watcher LOCALLY reads MUST stay in the watcher — never passed up to `detectIssue()`

Orchestrator: `src/sub-agents/detection/index.mjs` starts all 7, exposes `stopAll()` and `pauseAll(ms)`. Called from `app.whenReady()` in main.mjs.

**Test (NEW):** `tests/watchers.test.mjs` — feed each watcher 100 fuzzed shell outputs containing fake PII and assert no PII string ever appears in the emitted signal.

### BLOCK 2 · Cursor-dodge floating globe physics (30 min)

The overlay window is centered top-fixed today. Make it dodge the cursor + drift along edges + snap to corners — per `design_handoff_aria_sentinel/README.md` §Globe motion.

- `src/main/overlay-physics.mjs` exports `tickPhysics(state, cursor, workArea)` → new `{x, y}` for the overlay window
- Idle: drift ~10px/s along nearest edge of work area
- Cursor within 80px of globe: globe slides AWAY along the edge at 200ms linear ease
- 30% corner-snap magnetism within 60px of a corner
- Multi-monitor: `screen.getCursorScreenPoint()` + `screen.getDisplayNearestPoint(cursor)` to constrain to current display's workArea
- Card never spans monitors
- `setIgnoreMouseEvents(true, { forward: true })` on the overlay window. Hover-on-globe → temporarily `setIgnoreMouseEvents(false)` so clicks reach the button. Off-hover → restore click-through.
- Tick at 30fps idle (33ms), 60fps when state ≠ idle, drop back to 30fps after 5s idle

**Test:** `tests/overlay-physics.test.mjs` — pure-function test of dodge math. Assert: new position is always on the edge, always ≥ 80px from cursor, never enters screen interior.

### BLOCK 3 · Admin console interactive content for all 13 tabs (40 min)

Currently only **Overview** has content (Cowork pass added nav interactivity but not panels). Build 12 missing panels — DO NOT change Overview. Drive from `admin-console/mock-data.json` (new file) so backend wiring later is one swap.

For each tab below, the panel ID is `data-view="<id>"`, the nav button is `data-view-target="<id>"`, and clicking the button toggles `hidden` on panels + `active` class on buttons:

| Tab | Content (per `design_handoff/references/ARIA Sentinel Design Library.dc.html` if you can read it; otherwise from §11 of `design_handoff/README.md`) |
|---|---|
| **release** | "Release Gate History" table: ts / bundle hash / verdict (PASS/FAIL) / reason / size MB · 5 mock rows · right panel "Manual override" with audit-log warning |
| **endpoints** | Filter row (search / status / region / KB ver) + table: hostname / user / OS / KB / last seen / health / SLA · 8 mock rows · right panel bulk actions |
| **policies** | Card grid per policy set (Standard Enterprise, Healthcare, Finance, BYOD) showing active endpoints + revision + last activated · right panel "Create policy" + gated dropzone for customer KB import |
| **recipes** | Table: recipe id / family / risk / success% (28d) / canary state / fleet attempts (24h) / breaker state · 12 rows from real `recipes.mjs` ids · right panel per-recipe enable/disable + breaker control |
| **kb-bundles** | Cards: current bundle (hash, signed by, size, regions, fleet adoption %) + last 3 bundles + stop-codes bundle |
| **stop-codes** | Table of 25 BSOD codes from `src/shared/recipes.mjs` STOP_CODES with hex / likely causes / local steps / escalation copy |
| **audit-events** | Larger 30-row audit table + filters (event type / endpoint / user / time range) + Export CSV / JSON buttons |
| **reports** | Cards: weekly fleet health · monthly cost saved · top 10 recipes · top 10 stop codes |
| **integrations** | Card grid: ServiceNow / Slack / M365 Graph / Jira / Webhook / Email. Each: status badge + "Connect" / "Disconnect" |
| **settings** | Form: owner email · admin token rotation · auto-update channel (stable/beta) · default mode · default tier · timezone · Save |
| **access** | Operators table: name / role / MFA status / last login · right panel invite + role permissions matrix |
| **system** | Service health card: backend version · region map · DB status · queue depth · last cron heartbeat |

**Reuse the existing CSS classes from admin-console/index.html.** Don't introduce new color tokens.

**Test (EXTEND):** `tests/ui-shell.test.mjs` — assert all 13 `<section data-view="..."` panels exist + each panel has ≥1 card/table/form.

### BLOCK 4 · ServiceNow connector with queue+retry (25 min)

- New `src/shared/servicenow.mjs` exports:
  - `ping(instanceUrl, user, pass)` → `{ ok, latency_ms }`
  - `createIncident({ shortDesc, description, category, recipeId, outcome, iisInternalId })` → `{ ok, number, sysId }` OR `{ ok: false, queued: true }`
  - `listMyIncidents({ caller, limit })` → `[{ number, state, priority, assignmentGroup, sysUpdatedOn, shortDescription, workNotes[] }]` — sorted newest first per design §8
  - `postComment({ incidentSysId, comment })` → `{ ok }`
- Reads creds from env: `SN_INSTANCE_URL`, `SN_USER`, `SN_PASS`. If missing → returns dry-run object.
- Local SQLite queue at `~/.aria-sentinel/sn-queue.db` via electron-store (already in deps). On agent startup, drain queue if SN reachable.
- Settings → ServiceNow tab: existing "Test connection" button now calls `ping()` real. Show "Connected · last verified <ago>" / "Offline · N queued" / "Not configured".

**Privacy:** Description field carries ONLY: symbolic code, attempted recipe IDs, dry-run|live, OS version hash. Caller field uses Windows SID hash, never user name/email.

**Test:** `tests/servicenow.test.mjs` — mock fetch, verify body shape, verify no PII passes through, verify queue+retry on 503.

### BLOCK 5 · Knowledge & policy ingester scaffold (20 min)

Settings → Knowledge & policy has a dropzone today but no pipeline.

- `src/shared/kb-ingester.mjs`:
  - Accepts: PDF, DOCX, MD, TXT
  - Stores raw under `~/.aria-sentinel/kb/<sha256>.bin`
  - Extracts text: MD/TXT direct · DOCX via mammoth if installed else mark "Awaiting text extraction" · PDF via pdfjs-dist if installed else same fallback. DO NOT npm install.
  - Computes chunks (~512 tokens) into `~/.aria-sentinel/kb/chunks.jsonl`
  - Updates `knowledgeSources` in electron-store
  - **Content-blind:** chunks NEVER leave the device. Only chunk hashes + counts surface in audit log.
- `src/shared/policy.mjs` exports `parsePolicyOverlay(jsonString) → PolicyOverlay`:
  - Strict schema: `{ recipes_disabled[], business_hours, confirmation_threshold, escalation_contacts[] }`
  - Anything outside schema: silently strip (parser is the gate)
- Wire `renderer.js` dropzone drag/drop → `kb-ingester.ingest(file)` → update knowledge sources → refresh

**Test:** `tests/policy-injection.test.mjs` — 50 injection attempts (`{exec_command:...}`, `{ALLOWED_ACTIONS:{...}}`, `<script>` payloads) → assert parser silently strips all + ALLOWED_ACTIONS remains code-defined only.

### BLOCK 6 · Kill switches at all 3 levels (15 min)

- Per-endpoint: tray "Pause for 24 hours" already done ✓
- Per-customer: `src/shared/customer-config.mjs` reads `~/.aria-sentinel/customer.json` (MDM-set). When present, agent uses customer ID in all recipe pulls. Customer policy bundle cached locally.
- Global: `/aria-recipes` response can include `{ killed: true, reason }`. When present, `bridgeStatus.killed = true` → agent enters detect-only mode. Settings shows red banner with reason. `runRecipe()` returns `{ ok: false, error: 'control_plane_killed' }`.

**Test:** `tests/kill-switch.test.mjs` — mock control-plane response with `killed:true` → assert `runRecipe()` no-ops + banner displays.

### BLOCK 7 · Content-leak fuzz gate (15 min)

The single most important test in the codebase.

- New `tests/content-leak.test.mjs`
- Generate 1000 fuzzed inputs with canary phrases: fake PII (email, SSN, SIN, card), full file paths (`/Users/jdoe/Documents/Q4-strategy.docx`), URLs with query strings (use a redacted form like `https://example.com/redacted?id=XXXX`), document title strings ("Confidential Acquisition Plan")
- Run each through `sanitizeToSignature()` → verify output (stringified) contains NONE of the canary phrases
- Run each through `assertContentSafePayload()` → verify no false rejections
- Add to `tests/run-all.mjs`
- Failure = release block

### BLOCK 8 · Idempotency suite (10 min)

- New `tests/idempotency.test.mjs`
- For each recipe in `recipes.mjs`: simulate execute with same `execution_id` twice → 2nd invocation MUST return cached outcome from `~/.aria-sentinel/execution-cache.sqlite` mock
- Inject failure mid-action → assert rollback completes + state restored

### BLOCK 9 · ServiceNow My-tickets list view (Settings → new "My tickets" subpanel or inline) (15 min)

Per design §8: full-width panel inside Settings → ServiceNow tab showing the user's incidents.

- Header: small globe + "My incidents" + "Synced with ServiceNow · newest first" (cyan)
- Body: stacked incident cards sorted newest first. Each card:
  - Header row: Cinzel number + status pill (NEW=cyan / IN PROGRESS=amber / RESOLVED=cyan) + priority + spacer + "{group} · {relative time}"
  - Issue title (13px `#ddd` 600) + "Issue described: …" (12px `#9a9a9a`)
  - WORK NOTES block with left border `#242424`
  - On open tickets: YOUR COMMENTS block (left border `#38301d`, gold-tinted text) + composer input "Ask for an update…" + gold "POST" button
- Data: calls `servicenow.listMyIncidents()` from BLOCK 4

### BLOCK 10 · Restore point indicator + transparency log polish (10 min)

- `src/renderer/sentinel.css`: restore-point card per design §17 — 360px card with circular-arrow icon tile + "Restore point created" + mono name + "ROLL BACK THIS FIX" ghost button
- Transparency log (Settings → Privacy verifier already has this) — verify rows are mono `timestamp(78px) + tag + text` with `#141414` dividers
- Restore-point ROLL BACK button calls `sentinel.rollback(snapshotId)` (NEW IPC) which logs the event and surfaces a confirmation

### BLOCK 11 · Onboarding tour + first-run UAC/SmartScreen explainers (10 min)

- 4 coachmark cards per design §19: "Meet the globe" / "It watches quietly" / "You're in control" / "Even on a blue screen"
- Each card: globe (idle/diagnosing/fixing/escalation) + Cinzel title + short calm line from `copy.md`
- Triggered on first launch (electron-store flag `firstRunComplete`)
- After completion, show 2 first-run explainer cards (SmartScreen + UAC) with verbatim copy from `copy.md`

### BLOCK 12 · Visual QA + handoff report (15 min)

- Run `npm test` → assert 9/9 suites green (was 6, +3 new)
- Run `npm start` → screenshot:
  - Floating globe at top-center, polished SVG
  - Right-click tray → menu shows all items
  - Click "Simulate ARIA detection" → globe expands → fix card slides up
  - Settings window (no menubar, clean chrome, gold-accent title bar)
  - Admin console: click through all 13 tabs, verify each shows distinct content
  - Browser ext: load unpacked in Chrome, visit a site, verify globe + cache-stale card render
- Save 6 screenshots under `design-review/qa-4hr-pass-2026-06-19/`

---

## §7 · ACCEPTANCE CRITERIA (all green to ship)

- [ ] `npm test` exits 0 with all 9 suites green
- [ ] `node --check` clean on every `.mjs` + `.js` in `src/`, `chrome-extension/`, `tests/`
- [ ] `npm start` launches with no console errors
- [ ] Tray icon = polished gold globe (verified by inspection)
- [ ] Settings window has NO menubar
- [ ] Overlay globe is the SVG with 6 states animating correctly
- [ ] Right-click tray → "Simulate ARIA detection" produces full detect → fix card → done flow
- [ ] Admin console: every 13 tabs show distinct content panels
- [ ] Privacy verifier panel shows 0 outbound paths to iisupp.net for user content
- [ ] Content-leak test: 1000 fuzzed inputs, 0 canary phrase leaks
- [ ] Policy-injection test: 50 attempts, all silently stripped
- [ ] Idempotency test: every recipe re-executes with same id = cached no-op
- [ ] Kill-switch test: mocked `killed:true` → recipes refuse + banner shows
- [ ] No `src/` or `chrome-extension/` file references URLs outside the whitelist in §3
- [ ] No new `package.json` `dependencies` added (devDependencies can stay; if you needed mammoth/pdfjs and they weren't there, you DEGRADED gracefully)
- [ ] No copy contains "21+ years", "Raymond James", "money-back", "guarantee", "risk-free"
- [ ] 6 QA screenshots saved under `design-review/qa-4hr-pass-2026-06-19/`

---

## §8 · COMMAND CHEATSHEET

```powershell
# From inside the ARIA Sentinel folder

# 1. Syntax pass across everything you touched
foreach ($f in (Get-ChildItem -Recurse -Include *.mjs,*.js src,chrome-extension,tests)) { node --check $f.FullName }

# 2. Full test suite
npm test

# 3. Privacy audit
npm run audit

# 4. Scenarios
npm run scenario:test

# 5. Live launch (manual smoke)
npm start

# 6. Package an unsigned NSIS for Ahmad's smoke test
npm run package:win
```

---

## §9 · DO-NOT-TOUCH LIST

- `design_handoff_aria_sentinel/` — reference only, never edit
- `docs/DO_BUY_OR_APPROVE_LATER.md` — Ahmad's wallet items
- `docs/RELEASE_*` / `docs/SBOM*` / `docs/SECURITY_DISCLOSURE_*` — release artifacts (append-only if anything)
- `package.json` `dependencies` — DO NOT add new deps. devDependencies can stay.
- Existing recipe IDs in `src/shared/recipes.mjs` — extend, never rename
- The 21 detection patterns in `src/shared/safety.mjs` — extend, never alter ordering
- `src/renderer/index.html` 7-tab structure — locked per Claude Continue Prompt
- `admin-console/index.html` 13-tab nav structure — locked per Claude Continue Prompt + screenshot
- `tokens.css` in design handoff — copy values from, never modify
- The overlay close-hides-globe behavior in `main.mjs` `mainWindow.on('close')` — locked

---

## §10 · WHEN YOU'RE DONE — REPORT TO AHMAD IN THIS SHAPE

```
ARIA Sentinel — 4-hour build complete · 2026-06-19

BUILT:
- 7 Windows detectors wired (disk · event log · perf · crash control · service · network · WER)
  Source: src/sub-agents/detection/
- Cursor-dodge overlay physics with multi-monitor + DPI
  Source: src/main/overlay-physics.mjs
- 12 admin console tabs interactive with content (was Overview-only)
  Source: admin-console/index.html + admin-console/mock-data.json
- ServiceNow connector with queue+retry + my-tickets list
  Source: src/shared/servicenow.mjs + Settings ServiceNow tab
- KB ingester (PDF/DOCX/MD/TXT, local-only, content-blind) + policy parser
  Source: src/shared/kb-ingester.mjs + src/shared/policy.mjs
- Kill switches at 3 levels (per-endpoint done · per-customer NEW · global NEW)
  Source: src/shared/customer-config.mjs + main.mjs bridge handler
- Restore point indicator + transparency log polish
- Onboarding tour (4 cards) + SmartScreen/UAC first-run explainers

TESTS:
- 9/9 suites green (was 6) · run-all.mjs
- NEW: tests/watchers.test.mjs · tests/overlay-physics.test.mjs · tests/servicenow.test.mjs ·
       tests/policy-injection.test.mjs · tests/content-leak.test.mjs (1000 inputs) ·
       tests/idempotency.test.mjs · tests/kill-switch.test.mjs
- node --check clean on 25+ .mjs/.js files

QA SCREENSHOTS:
- design-review/qa-4hr-pass-2026-06-19/01_globe-floating.png
- design-review/qa-4hr-pass-2026-06-19/02_tray-menu.png
- design-review/qa-4hr-pass-2026-06-19/03_fix-card-detected.png
- design-review/qa-4hr-pass-2026-06-19/04_admin-console-overview.png
- design-review/qa-4hr-pass-2026-06-19/05_admin-console-recipes.png
- design-review/qa-4hr-pass-2026-06-19/06_chrome-ext-globe.png

FILES TOUCHED (new + edited):
<list>

FILES UNTOUCHED (per do-not-touch):
src/shared/recipes.mjs · src/shared/safety.mjs · src/renderer/index.html · tokens.css · copy.md

ENTERPRISE READINESS: now 9.0/10 (was 8.6 per docs/ENTERPRISE_READINESS.md)

REMAINING (per docs/DO_BUY_OR_APPROVE_LATER.md):
- Code signing (Ahmad's call)
- MSI/Intune packaging (post-signing)
- Live ServiceNow customer OAuth setup (per-tenant)
- External pen test (Ahmad's call)
- Legal DPA/EULA/SLA (Ahmad's call)
```

---

## §11 · TONE FOR THE FINAL HANDOFF

Be direct. Ahmad's standing rules require it: caveman comms · report brevity · CEO tone · no filler. List what shipped, list what's blocked, list what's next. Don't add disclaimers. Don't ask permission for the next step.

If a test fails mid-build, fix it in-band and report the fix at the bottom of the report — don't escalate.

If you hit a hard blocker (missing dep you can't install per Rule 10, native API you can't reach), DEGRADE GRACEFULLY (placeholder + status row + audit-log note) and ship. Surface the blocker in the report under REMAINING.

---

*End of packet. Total scope: ~4 hours focused work. Read top to bottom, then start BLOCK 1.*
