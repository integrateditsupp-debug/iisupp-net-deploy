# RUN 7 Report — Recipe expansion 25 → 50

**Date:** 2026-06-19 · **Suite:** 26/26 green · **`node --check`:** clean · **Deps added:** 0 · **Published:** nothing

## Built
- **+23 recipes → 50 total** (was 27) in `src/shared/recipes.mjs`:
  - **8 green service-restart recipes** (`SYSTEM.SERVICE.STOPPED.*`): Spooler · Audiosrv · BITS · wuauserv · Dnscache · WlanSvc · LanmanWorkstation · RasMan — built via a shared `svcRecipe()` helper; each a pure reversible `Restart-Service` with a read-only `Get-Service` diagnostic.
  - **15 desktop/browser recipes**: SYSTEM.SLOW.HIGH_CPU · HIGH_RAM (read-only top-N), BSOD.UNEXPECTED_SHUTDOWN (red, manual), HARDWARE.WHEA_ERROR (red), DISK.HARDWARE_FAULT (SMART read-only), APP.OUTLOOK.PROFILE_CORRUPT, APP.ONEDRIVE.STORAGE_FULL, BROWSER.AUTOFILL.WRONG · ADBLOCK.BREAK · COOKIES.BLOCKED · POPUP.BLOCKED · DOWNLOAD.STUCK, PRINT.DRIVER.STUCK, SYSTEM.TIME.DRIFT, NET.PROXY.MISCONFIG.
- **Green allowlist** extended by the 8 service restarts (15 greens total) + matching read-only verify probes. No command-allowlist widening (all `Restart-Service`).
- All new keywords are **multi-word phrases** (the matcher requires the full phrase as a substring), so none steal an existing route — verified by running scenario-suite in isolation (48/48, 0 regressions).

## Tests (suite count unchanged at 26; coverage ~doubled)
- `scenario-suite.mjs` → **48 routing cases / 50 recipes** (added 23 cases for the new recipes).
- `content-leak.test.mjs` corpus **1000 → 1500** inputs, 0 leaks.
- `recipe-execution.test.mjs` green-set assertion updated **7 → 15**; every green still has a real-executable action + verify probe.
- `idempotency.test.mjs` now dedupes across all **50** recipes.

## Acceptance
- [x] `npm test` = 26/26 green (coverage doubled, suite count same)
- [x] `recipes.mjs` has **50** entries
- [x] Windows + macOS guards intact

## Next-run prerequisites (RUN 8)
- 50 → 75 recipes (long-tail); the `svcRecipe`/manual patterns established here are reused.
- Status page + audit CSV/PDF export are additive (new shared modules + a static page).
