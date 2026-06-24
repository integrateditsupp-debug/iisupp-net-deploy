# RUN 14 Report — Self-hosted auto-update + admin push + per-license rollback

**Date:** 2026-06-19 · **Suite:** 52/52 green · **`node --check`:** clean · **Deps added:** 1 (`electron-updater`, documented exception) · **Published:** nothing · **Netlify fns:** project-local (not pushed) · **Binaries:** none uploaded

## The ONE-dep exception (documented)
`electron-updater@^6.8.9` added to `dependencies` (installed). It is the industry-standard, audited Electron auto-update lib — hand-rolling signature verification / partial-write / rollback safety is a security minefield. Every other RUN was zero-new-dep; this is the single sanctioned exception. The import is **dynamically guarded** in `main.mjs` (`await import("electron-updater")` in try/catch) so the app still boots if the module is absent, and **no test imports main**, so the suite is green regardless of install state.

## Built (packet §1–§6)
- **Pure cores** (`src/shared/`): `update-manifest.mjs` (`pickVersionForLicense` honors `version_pin` rollback else latest-non-disabled; `buildLatestYml`; `inRollout` staged-rollout bucketing) · `admin-auth.mjs` (`requireAdminToken` vs `ARIA_ADMIN_TOKEN`, timing-safe, **never hardcoded**) · `license-registry.mjs` (`searchLicenses` paginated substring; `registerDevice` idempotent upsert, **pin preserved** across check-in) · `auto-update.mjs` extended (`buildFeedUrl` carries the license key; `recordInstall`; `rollbackTargets`).
- **Main (§2)** — guarded electron-updater init (`autoDownload=false`, feed URL = manifest endpoint + license, 30s-grace + 4h poll, `update:available`/`update-downloaded`), IPC `install-update`/`rollback-update`/`update-history`/`set-auto-update`; **auto-update defaults ON** with an opt-out toggle; update history at `~/.aria-sentinel/update-history.json`.
- **Renderer (§4)** — About "Auto-update" panel: status line, Install button (revealed on `update:available`), "Get latest from website" → iisupp.net/downloads, update-history table with per-version "Roll back to this".
- **Netlify functions (§1/§6, PROJECT-LOCAL):** `aria-sentinel-update-manifest` (per-license latest.yml + rollout) · `aria-sentinel-update-publish` (admin: publish/disable/rollout) · `aria-sentinel-license-register` (idempotent device check-in) · `aria-sentinel-license-search` (admin: search + per-license/bulk/all rollback pin). Admin endpoints gated by `X-Admin-Token`.
- **Admin Updates tab (§5)** — published versions, staged rollout 10/50/100%, disable-version, per-license search + rollback, and **all-machines rollback with double-confirm + admin-token re-entry**.

## Privacy allowlist — EXACTLY +2 paths (§3)
Added `update-manifest` + `update-binary` to `ALLOWED_OUTBOUND_PATHS` with a distinct `update-channel` direction (so the verifier's 3 declared GET pulls stay 3). New additive `isUpdatePathAllowed()` + `UPDATE_OUTBOUND_PATHS` in `network-capture.mjs`. **The runtime 6-host telemetry verifier (`CAPTURE_HOST_ALLOWLIST`) is unchanged.** `network-capture.test` + `update-feedurl.test` assert: the 2 update paths are allowed, **no other iisupp.net path passes** `isUpdatePathAllowed`, host allowlist still 6, declared pulls still 3.

## Tests (46 → 52 suites)
New: `update-manifest`, `admin-publish`, `license-search`, `license-register`, `update-rollback`, `update-feedurl`. Extended: `network-capture` (+2-paths proof). Rollback always validates license (a pin only sets `version_pin` on an existing record; the device still validates its key — covered by `update-rollback` + the search-function design).

## Acceptance
- [x] `npm test` = 52/52 green · `node --check` clean
- [x] Self-hosted manifest serves per-license version (pin → rollback; rollout %); admin publish/disable
- [x] User Update history + "Roll back to this version" + Get-latest link
- [x] Admin Updates: search by license/name/company; per-license/bulk/all rollback (all = double-confirm + token re-entry)
- [x] +2 paths only, explicitly tested; 6-host verifier + telemetry schema unchanged
- [x] Offline update check fails silently (guarded try/catch, no popup spam)
- [x] ARIA_ADMIN_TOKEN env only; rollback never bypasses license

## Locked rules honored
ONE new dep (electron-updater, documented) · Netlify functions committed LOCAL only (not pushed) · no binary uploaded to `public/sentinel-binaries/` · admin token in env · rollback validates license · allowlist +2 paths with explicit test · all RUN 1–13 suites green.

## Manual (Ahmad, on hardware)
Bump version + build .exe + upload to `public/sentinel-binaries/` + hit publish endpoint → installed devices get "Update available" within the 4h poll; Install → restart at new version; About → Update history → roll back; Admin → Updates → search his test license → rollback.
