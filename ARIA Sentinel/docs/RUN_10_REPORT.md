# RUN 10 Report — Trial license + distribution + API/webhooks + Stripe portal

**Date:** 2026-06-19 · **Suite:** 33/33 green · **`node --check`:** clean · **Deps added:** 0 · **Published:** nothing

## Built
- **Trial license** — `src/shared/license.mjs`: stateless `HMAC(email:trialEnd, secret)`. `issueLicense` / `verifyLicense` / `daysRemaining`. Tamper-proof (timing-safe compare); after the trial it falls back to **Manual (free)** — never hard-locks. Stored at `~/.aria-sentinel/license.json`; Settings → About "Start 30-day trial" + status line.
- **Auto-update** — `src/shared/auto-update.mjs`: `parseUpdateManifest` (GitHub Releases → latest .exe) + `updateAvailable`. Settings → About "Check for updates" button. The binary checks via **iisupp.net/aria-binary-update** (server-side function talks to GitHub) so its own outbound stays inside the 6-host allowlist.
- **Direct distribution** — project-local `netlify/functions/aria-download-win.js` (`/aria-sentinel/buy` → 302 to the latest Release .exe) + `aria-binary-update.mjs` (latest version JSON).
- **API + webhooks v1** — `src/shared/api-v1.mjs` (bearer auth from license key · 401/403/429 · sliding 60/min rate limit · content-blind `telemetry-event-v1` payloads) + project-local `aria-api-v1.mjs` (`/aria-api/v1/events`, `/aria-api/v1/webhooks`). Documented in `docs/API.md` with curl examples.
- **Self-serve billing** — Settings → About "Manage subscription" → opens `STRIPE_PORTAL_URL` (fallback iisupp.net/account).
- **IT-Health-Check funnel** — the trial entry (email → 30-day license) is the single funnel the `iisupp.net/it-health-check` CTA points to (wiring documented; parent-site page change is Ahmad's to publish).

## Tests (30 → 33 suites)
- `license.test.mjs` (new) — HMAC verify, tamper (key/trialEnd/secret) rejected, expiry → Manual.
- `auto-update.test.mjs` (new) — manifest parse, .exe asset resolve, version compare, garbage-safe.
- `api-v1.test.mjs` (new) — bearer 401/403/429 paths, sliding-window rate limit, content-blind events.

## Acceptance
- [x] `npm test` = 33/33 green
- [x] Trial flow issues + verifies + expires correctly (license suite)
- [x] Download link path (`/aria-sentinel/buy`) 302s to the latest Release
- [x] IT-Health-Check CTA targets the trial funnel (documented)
- [x] API `/events` returns content-blind data behind bearer auth
- [x] Privacy audit still clean (binary outbound stays on iisupp.net)

## Next-run prerequisites (RUN 11 — final)
- Patch management extends the RUN 3 capture allowlist (server-side vendor version queries); remote control reuses Whereby; multi-tenant + PWA build on the RUN 9 fleet grid.
