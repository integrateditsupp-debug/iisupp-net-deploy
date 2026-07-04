# ARIA Sentinel — Roadmap to v1.0 production launch

> Read at the start of every Claude Code session. Always know the destination.
> Pattern: 4-hour focused runs, each closes with `npm test` green + a one-paragraph report.

> 2026-06-27 current-state pointer: the product is now at desktop 0.1.20 with the local suite passing
> 195/195 in the latest Codex review. Treat the RUN 12/RUN 17 sections below as historical ledger entries,
> not the live launch status. See `docs/PRODUCT_VISION_AND_GAP_REVIEW_2026-06-27.md` for the current
> product truth, claim hygiene, and SaaS launch gaps.

**Current state (after RUN 17):**
- 77/77 test suites green · `node --check` clean · readiness 9.95 (10.0 reserved for post-pen-test) · 1 documented dep (electron-updater); all else 0-dep
- RUN 17: audit-tamper security banner in Settings (cyber-noir, above all tabs; "View audit log" → Privacy tab; Dismiss is per-session sessionStorage, re-shows next launch; never mutates auditIntegrity). Suite 75 → 77
- RUN 15: self-heal engine (audit · auto-heal · content-blind escalation → code/design agents) · globe v3 (top-centre anchor · cursor repel · 2s teleport-back · rate-limited greetings) · live ARIA-brain chat + 4-tier escalation · two-layer admin-only console (build flag + HMAC login) · Start/Stop ARIA · hotkeys bind-with-fallback fix
- RUN 16: full test battery across 12 dimensions (debug · qa · user-behaviour · security · privacy 10K-fuzz · 167 scenarios · KB-QA · audit tamper-chain · SOC2 · regulatory · legal · accessibility) · live-globe icon swap APPLIED (settings + Chrome/Edge/Safari; overlay crystal-A + icon.ico kept) · new audit-integrity.mjs · customer build excludes admin/tests/fixtures (asserted). Suite 60 → 75
- Netlify functions committed local only (Ahmad ships); nothing pushed/published; commits local

**Current state (after RUN 12):**
- 39/39 test suites green · `node --check` clean on every touched file · Windows path + macOS guards intact
- Enterprise readiness ~9.7 / 10 · 76 recipes (19 execute for real) · 0 new dependencies
- RUNs 1–11 complete (`docs/LOOP_COMPLETE_RUN_11.md`); RUN 12 = UI-polish + bug-sweep on the live build
- **RUN 12 fixes:** Settings window opens 1280×820 (minWidth 1024) so the left rail never clips · "Open Admin Console" now opens a dedicated Electron window (focus-if-open) · floating globe v2 free-roams (spring-damped, repel force `(1-d/180)²·0.8`, damping 0.92) · globe is **click-through by default** (Ctrl+Alt+G for 3s to click it) · About → Display "Show floating globe" toggle (persisted) · classy GPU-cheap micro-animations, all disabled under low-power mode
- macOS port (5 watchers) · 7 green + 4 yellow recipe tiers + service-restart greens · privacy verifier (6-host) + evidence pack · autonomous opt-in + guards · Slack/Teams notify + weekly digest · status badge/page · audit CSV/PDF · trial license + auto-update + v1 API · patch mgmt + Whereby remote + multi-tenant PWA admin
- 7 Windows detectors live (content-blind)
- Cursor-dodge globe + 6 states + tray dynamic state + onboarding tour + first-run explainers
- 13-tab interactive admin console + ServiceNow connector + KB ingester + policy parser
- 3-level kill switch + idempotency + rollback + restore points
- Diagnostic self-test (7 checks) in Settings → About
- 5 self-running demo reels + gallery
- 3 staged landing pages (`/aria-sentinel/`, `/buy/`, `/customers/`)
- App boots clean · zero console errors · no new dependencies · nothing published

---

## §0 · THE DESTINATION (v1.0 production-launch ready)

ARIA Sentinel v1.0 is **shipped** the moment ALL of the following are true. Claude Code: this is your acceptance checklist. Every run lifts the count.

### Build acceptance (Claude Code can deliver all of these)
- [ ] **20+ recipes execute for real** (green + yellow tier), gated; red stays dry-run + manual confirm — *RUN 2: 11/20 (7 green + 4 yellow)*
- [x] **BSOD Tier A** — BCD boot menu entry installed at install, removed at uninstall *(scripts shipped RUN 1; VM-verify pending)*
- [x] **Tray dynamic state** — 4 icon variants (idle / detection / fixing / escalation) *(RUN 2)*
- [x] **Health Score 0-100** on tray tooltip + admin Overview *(RUN 1)*
- [x] **Real network capture** privacy verifier (10s WebRequest sniff with allowlist proof) *(RUN 3)*
- [x] **One-button RFP evidence pack** export (audit + privacy + SBOM + recipe registry → ZIP) *(RUN 3)*
- [ ] **Per-recipe per-site enable/disable** in Settings → Recipes
- [ ] **KB ingester re-index** button + "Open KB folder" link
- [x] **Subtle attention wiggle** on first detection per session *(RUN 3)*
- [x] **Chrome ext** per-site disable + auto-pause on focus loss *(RUN 2)*
- [x] **"What's new" modal** on update *(RUN 3)*
- [x] **macOS port** — Electron same code, macOS detectors, permissions UX, ad-hoc signed *(RUN 4; code complete + 20/20 green, Mac-hardware verification pending)*
- [x] **Edge extension** parity (Manifest V3 tweaks) *(RUN 5)*
- [x] **Safari extension** bundled inside macOS app *(RUN 5; manifest + Resources, Xcode-converter layout)*
- [x] **Autonomous mode** opt-in flow + safety guards (high-risk always confirms) *(RUN 6; cap 3/24h · 30min cooldown · fleet 5% · opt-in modal)*
- [x] **75 recipes total** *(RUN 8)*
- [x] **Nightly 10K content-leak fuzz** CI job *(RUN 8; project-local yml, activate at repo root)*
- [x] **Trial license server** — HMAC-based, stateless, 30-day → manual fallback *(RUN 10)*
- [x] **Direct distribution** at `download.iisupp.net/aria-sentinel.exe` *(RUN 10; `/aria-sentinel/buy` 302 → latest Release)*
- [x] **Customer audit dashboard** at `iisupp.net/sentinel-admin/` (read-only, owner-token gated) *(RUN 9 grid + RUN 11 per-customer rows, drill-in, PWA-responsive)*
- [x] **Polish** — Lottie animations · DPI 100/125/150/200% · multi-monitor · low-power mode · <50MB RAM idle *(RUN 9; CSS done-flourish, low-power toggle, multi-monitor display-aware; DPI + RAM are manual measures)*
- [x] **Auto-update channel** manifest + Settings button *(RUN 10)*
- [x] **`npm test` green = 18+ suites** (RUN 4: 20)
- [x] **`node --check` clean** on every `.mjs`/`.js` in `src/`, `chrome-extension/`, `tests/`, `scripts/`

### Wallet acceptance (Ahmad-only; surfaced when each run reaches it)
- [ ] Authenticode EV cert purchased + binary signed
- [ ] Apple Developer ID purchased + macOS binary notarized
- [ ] Chrome Web Store developer account + extension submitted
- [ ] Microsoft Partner Center + Edge add-on listed
- [ ] Live ServiceNow customer OAuth setup (per-tenant)
- [ ] MSI/Intune packaging verified on real enterprise lab
- [ ] External pen test passed
- [ ] Legal DPA · EULA · SLA reviewed + published
- [ ] Encrypted SQLite KB store (machine-bound key)
- [ ] First paid pilot signed

### Done = v1.0 shipped. Enterprise readiness → 9.7+ / 10. First MRR collected.

---

## §1 · THE 10 RUNS (each ~4 hours focused Claude Code time)

> **STATUS — RUNs 1–11 COMPLETE (2026-06-19).** Build phase done: 36/36 test suites green, enterprise readiness 9.7, 76 recipes (19 executing for real), all browsers covered, autonomous + safety guards, privacy verifier + evidence pack, trial license + API, patch/remote/multi-tenant/PWA. Retrospective: `docs/LOOP_COMPLETE_RUN_11.md`. Remaining = Ahmad's wallet items (RUN 12+ below). Nothing published; commits local only.

### RUN 1 · More green recipes + BSOD Tier A + Health Score (~4hr)

Goal: lift live-execution coverage from 3 → 8, ship the BSOD wow-moment, give admins one number to glance at.

**Build:**
- Add 5 more reversible-green recipe scripts under `src/recipes/scripts/`:
  - `R-02 NET.DNS.FAIL` → `ipconfig /flushdns` + `ipconfig /registerdns` + `Restart-Service Dnscache`
  - `R-03 NET.WIFI.DROP` → `netsh wlan disconnect; netsh wlan connect name=<last-profile>` (profile is enum)
  - `R-05 PRINT.OFFLINE` → `Restart-Service Spooler -Force`
  - `R-11 AUDIO.MUTE` → `Restart-Service Audiosrv -Force; Restart-Service AudioEndpointBuilder -Force`
  - `R-13 VPN.DROP` → `rasdial <last-profile>` (profile enum)
- Each: positional argv only, no string interpolation, denylist on destructive verbs, read-only verification probe after, restore-point not required (all reversible)
- Add all 5 to `recipe-runner.mjs` allowlist alongside the existing 3
- BSOD Tier A: `scripts/install-bcd-entry.ps1` runs once at install with UAC, adds `bcdedit /create /d "ARIA — Solve it for me" /application bootapp`, stores `{guid}` in `~/.aria-sentinel/bcd-id.json`. Uninstaller hook removes via `bcdedit /delete {guid}`.
- Health Score 0-100: `src/shared/health-score.mjs` weighted from (watcher heartbeats · recipe success 30d · ServiceNow queue · KB freshness · audit log integrity). Update every 60s. Surface on tray tooltip ("ARIA Sentinel · Health 94/100 · 12 fixes this week") + admin Overview centerpiece.

**Tests:**
- `tests/recipe-runner.test.mjs` extended to assert all 8 greens pass + a yellow/red recipe is BLOCKED even with the env flag
- `tests/health-score.test.mjs` (new) — pure function tested against mock state

**Acceptance:**
- `npm test` = 15/15 suites green
- Tray tooltip shows live Health Score on hover
- Right-click tray → Simulate "DISK.LOW_SPACE" → fix executes for real (in a Windows VM)
- Uninstaller cleans BCD entry

### RUN 2 · Yellow recipes (with extra confirm) + tray dynamic state + per-site disable (~4hr)

Goal: cover the most common app crashes; tray communicates state at a glance; chrome ext gets a "leave me alone" knob.

**Build:**
- Yellow recipes (snapshot before, restore-point required, always confirm regardless of mode):
  - `R-04 OUTLOOK.CRASH` → close Outlook, rename OST (don't delete), restart Outlook (rebuilds profile)
  - `R-09 TEAMS.STUCK` → kill Teams processes, clear `%APPDATA%\Microsoft\Teams\{Cache,blob_storage,databases,GPUCache,IndexedDB}`, relaunch
  - `R-10 ONEDRIVE.SYNC.STUCK` → `onedrive.exe /reset`, relaunch (resyncs)
  - `R-12 BLUETOOTH.OFF` → `Restart-Service bthserv -Force`
- Tray dynamic state: `makeTrayImage()` accepts `state: 'idle'|'detection'|'fixing'|'escalation'` → returns 4 different nativeImages. Wire to current orchestrator state.
- Chrome ext per-site disable: popup new section "On this site" toggle. `chrome.storage.sync` so the disabled-sites list follows the user across devices (no new perms).
- Chrome ext auto-pause: when tab loses focus > 5min → globe hides until focus returns.

**Tests:**
- `tests/recipe-runner.test.mjs` covers yellow path (asserts restore-point hook is called)
- `tests/tray-state.test.mjs` (new) — 4 nativeImage outputs differ
- `tests/extension.test.mjs` extended — per-site disable list persists across reloads

**Acceptance:**
- `npm test` = 17/17 green
- Yellow recipes execute on confirm only, even in Autonomous mode
- Tray icon visibly changes when detection arrives
- Chrome ext popup has per-site toggle that persists

### RUN 3 · Real network capture verifier + RFP evidence pack + attention wiggle + "What's new" modal (~4hr)

Goal: enterprise buyers can VERIFY privacy in-product; admins can export evidence on demand; missed-detection UX better; users see release value.

**Build:**
- Real network capture verifier: Settings → Privacy verifier → "Live capture" button → spawns 10s `webRequest.onBeforeRequest` listener → returns per-request `{host, path, payload-bytes, sanitization-status, allowlist-match}`. Assert every request is on the 6-host allowlist + every payload passes `assertContentSafePayload` + 0 user content.
- RFP evidence pack: Privacy tab → "Export evidence pack" button → assembles ZIP of (last 30d audit log · privacy verifier snapshot · network capture diff · recipe registry version · SBOM-LITE · signed-bundle hash). Output to `~/Documents/aria-sentinel-evidence-YYYY-MM-DD.zip`.
- Attention wiggle: pure CSS keyframe `aria-globe data-state="attention"` — 300ms, ±5px. Trigger once per session in overlay.js when first detection fires.
- "What's new" modal: triggers when `lastSeenVersion` < `package.json` version. Reads `docs/RELEASE_NOTES_<version>.md`. One scrollable card · "Got it" updates `lastSeenVersion`. Skip on first install.

**Tests:**
- `tests/network-capture.test.mjs` (new) — mock webRequest, assert 0 disallowed hosts
- `tests/evidence-pack.test.mjs` (new) — assert ZIP contains all 6 required artifacts

**Acceptance:**
- `npm test` = 19/19 green
- Privacy verifier "Live capture" button shows 3 cyan-tick rows (the 3 allowed outbound paths)
- "Export evidence pack" produces a real ZIP in <5s
- First detection per session: globe wiggles once

### RUN 4 · macOS port (~4hr)

Goal: same Electron codebase running on macOS with macOS-native watchers + permissions UX.

**Build:**
- `src/sub-agents/detection/macos/` mirror of Windows watchers:
  - `disk-watcher.mjs` → `df -h /` parse
  - `event-log-watcher.mjs` → `log stream --predicate 'subsystem == "com.apple.system"' --level warn` (read 60s window)
  - `crash-watcher.mjs` → glob `~/Library/Logs/DiagnosticReports/*.crash` + `*.ips` (read metadata only)
  - `perf-watcher.mjs` → `top -l 1 -n 0` parse
  - `network-watcher.mjs` → `scutil --dns` + `ping` test
- Permissions UX: System Settings → Privacy & Security → Full Disk Access + Accessibility. Open the right pane via `x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles` deep links.
- macOS tray: native menu bar via Electron's `Tray` (already cross-platform; just verify on macOS)
- Globe overlay: macOS transparent window quirks (`vibrancy: 'hud'` for the right blur)
- Ad-hoc code-signing for first run (no Developer ID yet; warn in installer per existing copy)

**Tests:**
- `tests/macos-watchers.test.mjs` (new) — content-leak fuzz on each macOS watcher
- Existing 19 suites stay green on Windows path (the macOS code uses `if (process.platform === 'darwin')` guards)

**Acceptance:**
- `npm start` works on macOS (manual verification on a Mac if Ahmad has one; otherwise document)
- `npm test` = 20/20 green
- Globe renders correctly on macOS retina + multi-monitor

### RUN 5 · Edge + Safari extensions + Chrome ext polish (~4hr)

Goal: every major browser covered. Strict-privacy positioning is real on every surface.

**Build:**
- Edge extension: copy `chrome-extension/` → `edge-extension/`. Manifest tweaks for Edge add-on store. Same code.
- Safari extension: bundle inside macOS app via Xcode helper template. Add `safari-extension/` folder with `manifest.json` + `Resources/`.
- Chrome ext popup polish: 3 sections (status badge · per-site toggle · "What ARIA did here today" counter from `chrome.storage.local`)
- Cross-browser content-script polish: detect Chrome vs Edge vs Safari, render globe same on all

**Tests:**
- `tests/extension.test.mjs` extended to validate all 3 manifests
- Verify same fix card renders on a real test page in each browser (manual screenshots saved to `design-review/qa-runs/`)

**Acceptance:**
- `npm test` = 21/21 green
- 3 extension manifests validate
- Edge add-on listing draft (HTML mock) saved to `docs/distribution/`

### RUN 6 · Autonomous mode + safety guards (~4hr)

Goal: opt-in upgrade flow that makes Autonomous feel intentional, not slippery.

**Build:**
- Autonomous mode opt-in flow: Settings → Mode → "Switch to Autonomous" → modal with:
  - "Autonomous means ARIA fixes low-risk issues without asking. Higher-risk fixes still confirm."
  - List of which recipes will auto-fix (green only; yellow always confirms regardless of mode)
  - "I understand" checkbox + "Enable Autonomous" button
- Safety guards:
  - Per-recipe cap: same recipe can auto-fire max 3× per 24h per endpoint
  - Cross-fleet rate limit: backend `/aria-recipes` returns `recipe.enabled = false` if >5% of fleet attempted in 60min
  - Cooldown: 30min between auto-fires across all recipes
- Settings → Mode → "Pause Autonomous for [1h / 24h / until I re-enable]"
- Restore-point UI polish per design §17: 360px card with circular-arrow icon + mono name + "ROLL BACK THIS FIX" ghost button

**Tests:**
- `tests/autonomous-guards.test.mjs` (new) — per-recipe cap + cooldown + fleet rate limit
- `tests/idempotency.test.mjs` extended to cover autonomous re-fire scenarios

**Acceptance:**
- `npm test` = 22/22 green
- Autonomous mode requires explicit opt-in modal (cannot be enabled silently)
- 3-fire cap enforced; 4th attempt within 24h falls back to Confirmed

### RUN 7 · Recipe expansion 25 → 50 (~4hr)

Goal: cover the next 25 most-common Windows + browser pain points.

**Build:**
- Add 25 recipes covering (per spec §C-1):
  - Desktop: `WIN.UPDATE.STUCK` · `SLOW.PC` · `SYSTEM.SERVICE.STOPPED.*` (8 services) · `SYSTEM.SLOW.HIGH_CPU` · `SYSTEM.SLOW.HIGH_RAM` · `BSOD.UNEXPECTED_SHUTDOWN` · `HARDWARE.WHEA_ERROR` · `DISK.HARDWARE_FAULT` · `APP.OUTLOOK.PROFILE_CORRUPT` · `APP.ONEDRIVE.STORAGE_FULL`
  - Browser: `SERVICE.WORKER.STUCK` · `AUTOFILL.WRONG` · `CERT.EXPIRED` · `MIXED.CONTENT` · `EXT.CONFLICT` · `ZOOM.WEIRD` · `AD.BLOCK.BREAK` · `SLOW.LOAD`
- Each with: detector wiring · fix script · risk class · snapshot/rollback · content-blind sanitizer pass · idempotency test
- Update `recipe-runner.mjs` allowlist for the new green ones (~6-8 of the 25)

**Tests:**
- Extend `tests/scenario-suite.mjs` to cover all 50 (was 25)
- Extend `tests/content-leak.test.mjs` corpus to 1500 inputs

**Acceptance:**
- `npm test` = 22/22 still green (test suite count same, but coverage doubled)
- `recipes.mjs` has 50 entries

### RUN 8 · Recipe expansion 50 → 75 + nightly 10K fuzz CI (~4hr)

Goal: hit Sprint 5 target. Catch any remaining content-leak edge case via overnight fuzz.

**Build:**
- 25 more recipes covering long-tail (Stack Overflow top-50 patterns Ahmad's customers would hit)
- `.github/workflows/sentinel-nightly-fuzz.yml` — runs `tests/content-leak.test.mjs` with corpus expanded to 10,000 inputs. Posts to `aria-sentinel-evidence` channel if leak found.
- Recipe registry signed bundle endpoint at `/.netlify/functions/aria-recipes` returns versioned, signed payload

**Tests:**
- `tests/scenario-suite.mjs` to 75
- Nightly fuzz CI runs (no extra spend)

**Acceptance:**
- 75 recipes live
- Nightly job green for 7 consecutive runs before declaring stable

### RUN 9 · v1.0 polish (~4hr)

Goal: production-quality animation + multi-monitor + DPI + low-power.

**Build:**
- Lottie animation on globe "done" state (cyan checkmark + gold ring flourish, exported from `globe.html` via screen-record + lottie convert OR pure CSS keyframes if simpler)
- DPI testing matrix: 100% / 125% / 150% / 200% — globe + card + Settings + admin all render correctly at each. Fix any clipping.
- Multi-monitor: globe stays on focused display · card never spans displays · cursor-dodge respects per-display bounds
- Low-power mode toggle: Settings → About → "Low-power mode" → drops watcher polling to 60s · globe to 15fps · disables Lottie
- Customer audit dashboard at `iisupp.net/sentinel-admin/` enhancements: filter by customer · timeline view · evidence-pack download per customer

**Tests:**
- Manual DPI matrix screenshots saved
- `tests/low-power.test.mjs` (new) — assert polling intervals change when toggled

**Acceptance:**
- `npm test` = 23/23 green
- 4 DPI screenshots saved per scale (16 total)
- Idle CPU < 1% on a modern Intel laptop (manual measure)
- Idle RAM < 50MB (manual measure)

### RUN 10 · Trial license + direct distribution + final QA (~4hr)

Goal: revenue plumbing + the actual download link + final review.

**Build:**
- Trial license server: `src/shared/license.mjs` — HMAC(email + trial-end-date, secret). Stateless, no central DB. After 30 days: app falls back to Manual (free) mode.
- License entry UI: first launch → "Enter email for 30-day trial of Confirmed + Autonomous modes" → email sent via Resend with magic link → license key stored at `~/.aria-sentinel/license.json`
- Direct distribution: `iisupp.net/aria-sentinel/buy/` "Download for Windows" button → 302 to latest GitHub Release `.exe`
- `/aria-binary-update` endpoint reads from GitHub Releases artifact listing
- Settings → About → "Check for updates" button
- Final QA pass: every Tier-A item in `NEXT_STAGE_IMPROVEMENT_PLAN.md` verified

**Tests:**
- `tests/license.test.mjs` — HMAC verifies + expires correctly
- `tests/auto-update.test.mjs` — manifest parses + version compare correct

**Acceptance:**
- `npm test` = 25/25 green
- Trial flow works end-to-end on a fresh install
- Direct download link works from `iisupp.net/aria-sentinel/buy/`

### Then — Ahmad's wallet items unlock final ship (RUN 12+)

> **RUNs 5–11 COMPLETE (2026-06-19)** — see `docs/LOOP_COMPLETE_RUN_11.md`. 36/36 suites green, readiness 9.7. Everything below requires purchase / signature / a store account and was intentionally not started.

Each of these is a single Cowork session + Ahmad signature/payment:
- Authenticode EV cert → Run 12 (sign binary + submit to Microsoft SmartScreen reputation)
- Apple Developer ID → Run 13 (sign macOS binary + notarize)
- Chrome Web Store account → Run 14 (submit Chrome ext for review)
- Microsoft Partner Center → Run 15 (submit Edge ext for review)
- ServiceNow customer-instance OAuth → Run 16 per-tenant
- Legal DPA/EULA/SLA → Run 17 (Cowork drafts, Ahmad/lawyer reviews)
- External pen test → Run 18 (Ahmad procures, Cowork addresses findings)

---

## §2 · PROTOCOL FOR EVERY CLAUDE CODE RUN

At the start of every run, Claude Code does this in order:

1. Read `docs/ROADMAP_TO_V1.md` (this file) — §0 destination checklist.
2. Read the specific run section in §1 above (RUN N).
3. Read `02_Memory/RULES.md` standing rules.
4. Read `design_handoff_aria_sentinel/README.md` + `copy.md` + `tokens.css`.
5. Read `docs/DO_BUY_OR_APPROVE_LATER.md` — don't enter that lane.
6. Read the previous run's report (`docs/RUN_N_REPORT.md` if exists).

At the end of every run:

1. `npm test` MUST be green (block PR if not).
2. `node --check` clean on every file touched.
3. Write `docs/RUN_<N>_REPORT.md` with: built · tests · screenshots · acceptance ticks · remaining items for next run.
4. Update `§0 destination checklist` checkboxes in this file.
5. Update `docs/ENTERPRISE_READINESS.md` rating.

---

## §3 · WHAT THE RUNS DO NOT DO

Per locked rules, never:
- Add a paid service or new package.json dependency
- Mention 21+ years (only 15+)
- Mention Raymond James
- Use "guarantee / money-back / risk-free / refund" language
- Create a new memory file (consolidate into existing `02_Memory/*.md`)
- Break the 7-tab Settings or 13-tab admin structures
- Touch `design_handoff_aria_sentinel/` (reference-only)
- Ship paragraphs in any product UI (bullets only)
- Send user content to any external API (only symbolic codes to the 3-4 allowlisted endpoints)
- Skip the daily-note + decision-log update protocol

---

## §4 · ESTIMATED ELAPSED TIME TO v1.0 LAUNCH

| Phase | Runs | Calendar |
|---|---|---|
| Build to v1.0 RC | Runs 1-10 (~40 focused agent-hours) | 1-2 weeks (parallel agents) |
| Wallet items resolved | Runs 11-17 (Ahmad-gated) | 2-4 weeks (cert verification + store reviews) |
| **v1.0 LAUNCH** | First paid pilot signed | 4-6 weeks elapsed |

---

## §5 · COWORK + KB-AGENT + CODEX RESPONSIBILITY MAP

- **Cowork (Claude Desktop)** — writes runs · reviews PRs · drives browser sessions for store submits · runs backend tasks (Netlify Functions + iisupp.net updates) · packages this roadmap into Codex-ready packets
- **Codex / Claude Code** — executes Runs 1-10 from this roadmap one at a time, each in a 4hr sitting
- **KB-agent** — continuously expands recipes from real-world incident logs (Run 7+8 are the seed)
- **Ahmad** — wallet items only (certs, accounts, legal, pen test, first pilot intro)

---

*End of roadmap. v1.0 destination locked. Every run lifts §0's checklist count. Ship.*
