# RUN 5 Report — Edge + Safari + Chrome polish + embed badge + Calendly

**Date:** 2026-06-19 · **Suite:** 22/22 green · **`node --check`:** clean · **Deps added:** 0 · **Published:** nothing · **Windows + macOS guards:** intact

## Built
- **`telemetry-event-v1` contract** (`src/shared/telemetry-event.mjs`) — the shared content-blind event shape (ISO ts only, opaque non-reversible endpoint handles, symbolic-only fields, `isTelemetrySafe` guard). The RUN 4 gap-analysis prerequisite; consumed by the badge now and Slack/digest/API later.
- **Edge extension** (`edge-extension/`) — copy of `chrome-extension/` with an Edge-named MV3 manifest; identical code.
- **Safari extension** (`safari-extension/`) — MV3 `manifest.json` + `Resources/` web assets (Xcode `safari-web-extension-converter` layout).
- **Chrome popup polish** — 3 sections: status badge (bridge dot + detected browser) · per-site toggle (RUN 2) · "What ARIA did here today" counter from `chrome.storage.local` (per-host, per-day; bumped after each fix).
- **Cross-browser** — `detectBrowser(ua)` in `site-prefs.js`; content-script tags its root `data-browser` so the same globe renders on Chrome/Edge/Safari.
- **Embeddable status badge** — `src/shared/status-badge.mjs` (pure renderer, inline CSS only, no script, CSP-locked) + project-local `netlify/functions/sentinel-status-badge.js` (`/sentinel-status-badge?tenant=ID`, 220×64 iframe).
- **Tray "Need help? Book a call"** → `shell.openExternal(CALENDLY_URL || iisupp.net/contact)`.
- **Edge add-on listing draft** → `docs/distribution/edge-addon-listing.html` (mock; submission is RUN 12+).

## Tests (20 → 22 suites)
- `extension.test.mjs` extended — all **3 manifests** validate (MV3, name, content script, popup, storage perm); `detectBrowser` Chrome/Edge/Safari; per-host/per-day "today" counter persists.
- `status-badge.test.mjs` (new) — well-formed iframe HTML, shows mock score 94/Healthy/12 fixes, CSP-locked, **no `<script>` / no inline handlers / no `javascript:`**, score clamped, tenant escaped.
- `telemetry-event.test.mjs` (new) — ISO-only timestamps, stable opaque handles (no machine name), symbolic-field drop, leak guard rejects epoch-ms + embedded content.

## Acceptance
- [x] `npm test` = 22/22 green
- [x] 3 extension manifests validate
- [x] Edge add-on listing draft saved to `docs/distribution/`
- [x] Status badge iframe loads + shows mock score in test
- [x] Windows path + macOS `process.platform` guards unchanged

## Next-run prerequisites (RUN 6)
- Slack/Teams notify + weekly digest will consume `telemetry-event-v1` (now in place) and the RUN 3 allowlist host-check.
- Autonomous opt-in modal + guards build on the recipe-runner yellow/green tiers (RUN 2).
