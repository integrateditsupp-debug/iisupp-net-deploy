# RUN 8 Report — Recipes 50 → 75 + status page + audit export + nightly fuzz

**Date:** 2026-06-19 · **Suite:** 27/27 green · **`node --check`:** clean · **Deps added:** 0 · **Published:** nothing

## Built
- **+25 recipes → 75 total** via a compact `guideRecipe()` helper — content-blind manual-guidance recipes covering the Stack-Overflow long tail: Excel/Word hang · Chrome profile lock · Edge sync · weak Wi-Fi · ethernet unplugged · captive portal · mic not detected · 2nd monitor blank · resolution · keyboard layout · touchpad · PDF won't open · Zoom no audio · Teams camera · BitLocker recovery (red) · firewall block · USB not recognized · eject fail · slow startup · search broken · start menu · Office stuck updating · translate · password not saving.
- **Public status page** — project-local `public/sentinel-status.html` (API uptime · bundle freshness · last incident · 30-day timeline; mock until wired to the live uptime probe). $0 static.
- **Audit CSV/PDF export** — `src/shared/audit-export.mjs`: `toCsv` (quoted cells, 30-day window) + `toPdf` (hand-rolled, valid single-stream Helvetica PDF, **zero dependency**). Settings → Privacy → "Download audit (CSV)/(PDF)" via IPC + Blob download. Same content-blind fields as the evidence pack.
- **Nightly 10K fuzz CI** — project-local `.github/workflows/sentinel-nightly-fuzz.yml`; `content-leak.test.mjs` now honors `ARIA_FUZZ_N` (1500 locally, 10000 nightly).
- **Signed recipe bundle** — project-local `netlify/functions/aria-recipes-bundle.mjs` returns the content-blind registry + an HMAC-SHA256 signature (`buildSignedBundle`).

## Tests (26 → 27 suites)
- `audit-export.test.mjs` (new) — CSV row schema + injection-safe quoting, valid PDF header/trailer/catalog/xref, 30-day window, content-blind.
- `scenario-suite.mjs` → **73 cases / 75 recipes** (+25 cases, isolation-verified 0 regressions).
- `idempotency.test.mjs` now dedupes across all **75** recipes.

## Acceptance
- [x] 75 recipes live (`recipes.mjs`)
- [x] Status page renders mock data (live probe pluggable)
- [x] Audit CSV + PDF generate (test-validated; well under 2s)
- [x] Nightly fuzz CI present (activate by moving the yml to repo-root `.github/workflows`)
- [x] `npm test` = 27/27 green

## Next-run prerequisites (RUN 9)
- Command palette / ROI / multi-tenant are additive renderer + shared-module work; low-power toggle touches main polling intervals.
