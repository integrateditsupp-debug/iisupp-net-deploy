# Funnel smoke test — 2026-07-17T05:55:27.222Z

Base: https://iisupp.net

**Result:** 1 pass · 0 fail · 6 skip (of 7 total)

| Test | Status | HTTP | Latency (ms) | Note |
|---|---|---|---|---|
| heartbeat | PASS | 200 | 744 | ok |
| admin-lifetime | SKIP | — | — | env var SENTINEL_KEY_ADMIN not set |
| personal | SKIP | — | — | env var SENTINEL_KEY_PERSONAL not set |
| pro | SKIP | — | — | env var SENTINEL_KEY_PRO not set |
| small_business_y | SKIP | — | — | env var SENTINEL_KEY_SMB not set |
| midsize_y | SKIP | — | — | env var SENTINEL_KEY_MIDSIZE not set |
| enterprise_y | SKIP | — | — | env var SENTINEL_KEY_ENTERPRISE not set |

---

## How to fix failures

- **All keys FAIL with HTTP 404:** sentinel-resolve function not deployed yet. Verify Netlify deploy.
- **All keys FAIL with status invalid:** SENTINEL_LICENSE_SECRET mismatch between minting and verifying environments.
- **One key FAIL, others PASS:** that specific key was minted with a different secret OR is revoked.
- **Heartbeat FAIL:** sentinel-heartbeat function broken — check Netlify function logs.
- **All keys SKIP:** env vars not set. See `docs/half-b-runbook.md` for the export commands.