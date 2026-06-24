# ARIA Sentinel — next-stage build complete · 2026-06-19 (Claude Code)

Executed the recommended FIRST stack from `NEXT_STAGE_IMPROVEMENT_PLAN.md`: **A2 → C2 → A1 → A5**.
`npm test` = **14/14 suites green** (was 12). App boots clean. Zero new dependencies. No publish.

## FIRST: repaired Cowork-mount truncation (before building)
The user flagged that the Cowork file mount truncates large files on round-trip. It had
**corrupted two files on disk**:
- `src/shared/safety.mjs` — the bottom helper functions (`sanitizeSource`, `withOs`, `familyFor`,
  `sanitizeOsVersion`) were dropped, so the agent threw `ReferenceError` at first detection.
  Restored to the correct version **with the 3 prior security fixes intact**.
- `src/renderer/index.html` — the first-run onboarding modal block was dropped. Re-inserted.
`npm test` confirmed green after the repair, then the new work began.

## BUILT
- **A2 · Real Windows recipe execution (gated)** — `src/shared/recipe-runner.mjs`: a SECOND gate so
  that even with `ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=1`, only 3 reversible greens
  (`dns-fail-v1` · `disk-low-space-v1` · `teams-cache-v1`) execute for real; everything else stays
  dry-run. Spawns with positional argv under `-ExecutionPolicy Restricted`, denylist on destructive
  verbs, read-only post-fix verification probe. Bundled source-of-truth scripts in
  `src/recipes/scripts/*.ps1`. `main.runAction` refactored to `spawn` + the gate.
- **C2 · Diagnostic self-test** — `src/shared/diagnostic.mjs` pure 7-check builder (bridge · watchers ·
  ServiceNow · KB bundle · audit · tray · overlay) → Settings → About "Run diagnostic" button +
  PASS/WARN/FAIL table. Orchestrator now tracks watcher heartbeat (`status()`).
- **A1 · Demo pipeline** — `scripts/capture-demo.mjs` generates 5 self-running, loopable, embeddable
  HTML demo reels + a gallery + README under `design-review/demos/` (real globe SVG + fix-card UI,
  9s loop). No ffmpeg bundled → mp4 is a documented screen-record step (Rule 10). Poster frame captured.
- **A5 · 3 landing pages** — `aria-sentinel/index.html` (hero + live globe demo + modes + privacy "0" +
  BSOD + FAQ), `aria-sentinel/buy/` (requirements + first-run + SmartScreen explainer + request-access),
  `aria-sentinel/customers/` (L1-flood pitch + evidence pack + gated anonymized case studies + pilot form).
  Honors the locked website rules: **no public prices** (form/mailto CTA), no testimonials, "15+ years",
  content-blind messaging, automatic ServiceNow routing. Staged local — **not published**.

## TESTS (new)
`tests/recipe-execution.test.mjs` (gate + argv + denylist + .ps1 mirrors) ·
`tests/diagnostic.test.mjs` (7 checks, PASS/WARN/FAIL). Wired into `run-all.mjs`. 44 files `node --check` clean.

## SCREENSHOTS
`design-review/landing-2026-06-19/` (home · buy · customers) · `design-review/demos/disk-low-poster.png`.

## UNTOUCHED / HONORED
`recipes.mjs` · do-not-touch list · `package.json` deps (still only `electron-store`) · the 21 PATTERNS.
No external send, no account creation, no publish. Landing pages are staged for Ahmad/Codex to wire into
`scripts/inject-seo.mjs` + `scripts/regenerate-sitemap.mjs` and publish.

## REMAINING (still Ahmad's wallet — DO_BUY list)
Code signing · MSI/Intune · ServiceNow OAuth · pen test · legal. Plus next plan tiers B/C/D when wanted.
Enterprise readiness ~9.0 → ~9.3.
