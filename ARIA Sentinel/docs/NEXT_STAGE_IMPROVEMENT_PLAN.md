# ARIA Sentinel — Next-stage improvement plan

**Status after Claude Code 4-hour build:** 12/12 tests green on Ahmad's machine. App boots clean. 8 QA screenshots captured. Enterprise readiness 8.6 → ~9.0. Two real bugs fixed (preload.mjs ESM → CJS + safety.mjs PII leaks).

**Mandate:** improve more WITHOUT losing the core vision (content-blind · local-first · gold globe · privacy-by-engineering · IT support that never sleeps).

**Filter for every item below:**
- Stays inside [[02_Memory/RULES]] (10 standing rules)
- Doesn't enter `DO_BUY_OR_APPROVE_LATER.md` lane
- Doesn't break the locked-rules section of `design_handoff_aria_sentinel/DELIVERABLES.md`
- Lifts revenue · enterprise readiness · or demo strength

---

## TIER A — Ship next (highest leverage, 6-10 hrs total, zero new spend)

### A1 · Live demo recording pipeline (revenue lift)
**Why:** Every enterprise demo today is "trust me, here's a screenshot." A 90-second auto-recorded demo of detection → fix card → done lands in sales decks + landing pages.
- New `scripts/capture-demo.mjs`: scripted Electron launch → simulate disk-low → screen-capture frames → encode to mp4 via existing ffmpeg path (no new deps)
- Output: `design-review/demos/2026-06-19_disk-low.mp4` (~3MB), GIF version for slack/email
- Add 5 standard demo scripts: disk-low · printer-stuck · BSOD-resume · cache-stale (browser ext) · escalation
- **Rule 10 win:** baked recipe scripts, no setup needed

### A2 · Real Windows recipe execution (gated, dry-run by default)
**Why:** 25 recipes are declared; the runner is dry-run only. One Confirmed-mode recipe actually executing on a Windows VM is the unlock for the first paid pilot.
- PowerShell scripts in `src/recipes/scripts/` per recipe ID (already specified in CODEX-COMPLETE-PACKAGE-A-Z §E-6)
- Start with 3 reversible greens: FLUSH_DNS · CLEAR_TEMP_FILES · CLEAR_TEAMS_CACHE
- Each script: `-NoProfile -NonInteractive -ExecutionPolicy Restricted`
- Guarded by `ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=1` (Ahmad's existing flag)
- Snapshot before, verify after, rollback on failure (idempotency already in place)
- New test: `tests/recipe-execution.test.mjs` — mock PS, assert correct argv, assert restore-point created

### A3 · BSOD Tier A — BCD boot menu entry installer step
**Why:** This is the wow-moment in the demo deck. Tier C (crash-on-resume detect) is live; Tier A (boot menu entry) is what makes "ARIA — Solve it for me" appear on the BSOD screen.
- New `scripts/install-bcd-entry.ps1` — runs once at install, elevation required
- Adds: `bcdedit /create /d "ARIA — Solve it for me" /application bootapp`
- Stores `{newguid}` in `~/.aria-sentinel/bcd-id.json` for uninstall removal
- New uninstaller hook removes the BCD entry on uninstall
- Installer step 2 (Permissions) already explains this in copy.md verbatim

### A4 · Code-as-source-of-truth recipe execution log → ServiceNow attachment
**Why:** Every ServiceNow incident should attach the recipe execution log so Tier 2 sees exactly what was tried. Closes the "what did ARIA do?" loop.
- Audit log already exists (hash-chained, tamper-evident, content-blind)
- New `src/shared/sn-attachment.mjs`: collects last N entries for incident's correlation_id, formats as JSON, attaches via SN Table API
- Privacy: every entry is already symbolic code only — no PII added
- Settings → ServiceNow tab gets a "Test attachment" button

### A5 · 3 customer-facing landing pages on iisupp.net
**Why:** Codex shipped `iisupp.net/aria-sentinel/docs/` + `iisupp.net/sentinel-admin/`. Sentinel needs:
- `/aria-sentinel/` — hero + 3 modes + BSOD demo + privacy verifier + recipe library carousel + pricing card + IT teams CTA + FAQ
- `/aria-sentinel/buy/` — direct download .exe link + system requirements + post-install onboarding
- `/aria-sentinel/customers/` — case study template (gated until first 3 pilots) + pilot inquiry form
- Use the design_handoff brand tokens + existing iisupp.net SEO injection script (`scripts/inject-seo.mjs`)
- Add to `sitemap.xml` + `scripts/regenerate-sitemap.mjs` PAGES

---

## TIER B — Ship after A (medium leverage, 3-5 hrs each)

### B1 · ARIA Sentinel "Health Score" surface (Rule 9 polish)
**Why:** Customers want one number — "what's the agent doing?" Show a single health score on the tray hover tooltip + admin Overview tab.
- Calculation: weighted score 0-100 from (watchers heartbeat · last detection age · recipe success rate 30d · ServiceNow queue depth · KB freshness)
- Update every 60s
- Tray tooltip: "ARIA Sentinel · Health 94/100 · 12 fixes this week"
- Admin Overview already has the donut — add the score as the centerpiece

### B2 · One-click "Export evidence pack" for SOC 2/RFP responses
**Why:** Enterprise buyers ask "show me what your agent does." Today: hand-assemble. Tomorrow: one button.
- Privacy verifier tab → "Export evidence pack" button
- Zips: last 30d audit log (content-blind) · privacy verifier snapshot · network capture diff (3 allowlisted outbound paths only) · recipe registry version · `aria-recipes` signing key fingerprint · SBOM-LITE
- Goes to `~/Documents/aria-sentinel-evidence-<YYYY-MM-DD>.zip`
- Reuses existing audit + SBOM artifacts — no new generation

### B3 · Cursor-dodge globe nicety: gentle "attention" wiggle on first detection per session
**Why:** Users miss the first detection because the globe is calm. One subtle wiggle (300ms, ±5px) gets attention without breaking calm.
- Pure CSS keyframe added to `aria-globe` data-state="attention"
- Trigger once per session in overlay.js when first detection fires
- Stays inside the 80px hitbox + globe footprint

### B4 · Chrome extension polish — auto-pause on focus loss + per-site disable
**Why:** Users will complain "ARIA globe is in my face." Give them control without weakening protection.
- New popup section: "On this site" toggle (disable for one origin)
- `chrome.storage.sync` so disabled-sites list follows the user across devices
- New permission: none needed (already have `storage`)
- Auto-pause: when browser tab loses focus for >5min, globe hides

### B5 · "What's new" changelog modal on first launch after update
**Why:** Customers don't read release notes. Surface them in-product.
- Modal triggers when stored `lastSeenVersion` < current package.json version
- Reads `docs/RELEASE_NOTES_<version>.md` (already shipped)
- One scrollable card, "Got it" dismisses + updates `lastSeenVersion`
- Skip on first install (onboarding tour handles that)

---

## TIER C — Quality + trust raisers (smaller, ship in batches)

### C1 · Real privacy verifier — actual network capture
**Why:** Today the privacy panel just claims "0 outbound paths to iisupp.net for user content." Make it provable in-product.
- New: spawn a 10s network capture (use Electron's `webRequest.onBeforeRequest`) on demand
- Display every outbound request with: host · path · payload-bytes · sanitization-status
- Assert: every request is in the 6-allowlist · every payload passes `assertContentSafePayload` · 0 user content
- Settings → Privacy verifier → "Live capture" button

### C2 · Agent diagnostic self-test inside Settings
**Why:** "Is the agent actually running?" — admins need to know without checking task manager.
- Settings → About tab gets "Run diagnostic" button
- Tests: bridge port reachable · all 7 watchers heartbeat <2min · ServiceNow ping · KB bundle hash matches · audit log integrity · tray icon present · overlay rendering
- Output: 7-row table with PASS/FAIL per check + remediation hint

### C3 · Tray icon dynamic state ("calm gold" / "amber alert" / "cyan resolved")
**Why:** Most users don't open Settings. The tray icon should communicate state at a glance.
- Tray icon swaps based on `aria-globe data-state` equivalent
- Calm gold = idle, amber = detection awaiting confirmation, cyan = active fix, red = escalation
- Reuses `makeTrayImage()` factory (already in main.mjs)

### C4 · Settings → Recipes tab: per-recipe per-site enable/disable
**Why:** "Don't auto-clear my Outlook OST during business hours." Customers will want it.
- Each recipe row gets: enable toggle · "Customer policy locks this" badge if overlay disabled · "Confirmation always" override
- Honors `PolicyOverlay` from `02_Memory/RULES` (parser already silently strips invalid keys)

### C5 · KB ingester: surface ingested doc count + last-indexed time per source
**Why:** Settings → Knowledge & policy shows the dropzone but customers ask "did it actually index?"
- Per-source row already exists; bind status from `electron-store knowledgeSources` ✓
- Add per-source "Re-index" button (re-runs hash + extraction)
- Add "Open KB folder" link (opens `~/.aria-sentinel/kb/` in Explorer)

---

## TIER D — Distribution + revenue plumbing (Ahmad's hands needed for some)

### D1 · GitHub Actions workflow: nightly content-leak fuzz at 10,000 inputs
- Extend `tests/content-leak.test.mjs` corpus from 1000 → 10000 in nightly job only
- Runs on schedule (no extra CI cost)
- Posts to `aria-sentinel-evidence` channel if it ever finds a leak (it shouldn't)

### D2 · Auto-update channel JSON endpoint
- `/.netlify/functions/aria-binary-update` exists per spec
- Wire it to read `dist/latest.json` from a GitHub Releases artifact
- Settings → About → "Check for updates" button

### D3 · Trial license server (free 30-day trial → paid)
- Customers download .exe → enter email → 30-day trial unlocks Confirmed/Autonomous modes
- License key is HMAC(email + trial-end-date, secret) — stateless, no central DB
- After 30 days: app gracefully falls back to Manual (free) mode
- Reuses existing iisupp.net STRIPE_SECRET_KEY for actual purchase flow

### D4 · Direct distribution: `download.iisupp.net/aria-sentinel-0.1.0.exe`
- Upload unsigned .exe to GitHub Releases (already in `dist/`)
- iisupp.net redirect from `download.iisupp.net/aria-sentinel.exe` → latest GH release
- Until code-signing cert arrives, ship with SmartScreen explainer card (already in copy.md)

---

## TIER E — Wallet items (DO NOT execute — Ahmad's decision)

Per `docs/DO_BUY_OR_APPROVE_LATER.md`:
- Microsoft Authenticode EV cert (~$300/yr)
- Apple Developer ID ($99/yr — when macOS port nears)
- Microsoft Partner Center (Microsoft Store distribution)
- Chrome Web Store dev account
- ServiceNow customer-instance OAuth setup (per-tenant)
- External pen test
- Legal DPA/EULA/SLA package
- MSI/Intune packaging
- Encrypted SQLite KB store

---

## What I would do FIRST if given another 4 hours

In order:

1. **A1 (demo recording pipeline)** — 90 minutes — unlocks every sales conversation immediately
2. **A2 (real recipe execution for 3 reversible greens)** — 90 minutes — first paid pilot becomes possible
3. **C2 (agent diagnostic self-test)** — 30 minutes — admin confidence + support deflection
4. **A5 (3 landing pages)** — 30 minutes — `/aria-sentinel/` becomes a real product surface

That stack adds: demo material + first-pilot-ready execution + admin trust + public product surface. Doesn't touch any rule. Doesn't spend a cent. Lifts enterprise readiness past 9.0 toward 9.4.

---

## Sandbox truncation note (separate from your machine)

While reviewing Claude Code's output I noticed several files (safety.mjs, ui-shell.test.mjs, index.html, renderer.js, run-all.mjs) appear truncated when read through the Cowork file mount. This is a **known Cowork mount issue** (per `feedback_edit_tool_truncates_index_html` memory) — files truncate on the round-trip read, not on disk. The originals on your machine should be intact per Claude Code's "12/12 tests green" confirmation. Verify with:

```powershell
cd "ARIA Sentinel"
npm test
```

If `npm test` is green on your machine, ignore the sandbox-truncation; the files Claude Code wrote are fine. If it's not green, run `git diff` against `docs/CLAUDE_CODE_4HR_BUILD_REPORT.md`'s file list to see which file truncated locally.

