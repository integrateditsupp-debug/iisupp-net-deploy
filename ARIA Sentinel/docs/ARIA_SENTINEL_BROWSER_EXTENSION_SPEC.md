# ARIA Sentinel Browser Extension Spec

Audit timestamp: 2026-07-07 browser-hardening + extension web chat proof pass

## Current Evidence

- Chrome and Edge MV3 manifests exist.
- Content script injects the globe and current-origin fix card.
- Background worker can clear current-origin cache/service workers and reload.
- Popup shows bridge status, browser-only fallback, and a global Browser protection toggle.
- Per-site disable, global protection pause, and auto-pause support exist.
- Managed/admin policy can lock Browser protection on or off through a content-blind extension policy object.
- Shared browser classifier covers 404-like pages, DNS, proxy, certificate, unreachable-page, blocked-resource/CSP/mixed-content, stale-cache/service-worker, vendor-outage, and suspicious/malicious-warning signals.
- Issue prompt now offers `Resolve it for me`, `Walkthrough`, `Live help`, and `Not now`.
- Safe resolve actions are browser-scoped only: reload, current-origin cache clear, current-origin service-worker reset, and zoom reset.
- Local extension outcome history records the user's path per issue: resolved, failed, walkthrough, live-help, or dismissed; capped at 50 records.
- The desktop loopback bridge exposes `/browser-outcome` to ingest sanitized browser outcomes into Sentinel's local outcome ledger.
- Terminal browser outcomes map into proof metrics only when defensible: resolved -> resolved, failed -> not resolved, live-help -> escalated. Walkthrough/dismiss stays logged but does not count as proof.
- Chrome assets were mirrored to Edge and Safari resources for parity.
- Popup chat is now labeled `ARIA web chat`, includes `Open ARIA Web Chat`, links to `https://iisupp.net/aria`, and exposes build marker `web-chat-20260707`.
- Extension chat uses KB-first `aria-kb-query` before `aria-chat`, with local desktop bridge fallback/precedence when available.
- Live visual proof harness exists at `scripts/browser-extension-live-proof.mjs`.
- Latest passing Edge-bundle proof: `outputs/aria-sentinel-browser-extension-proof-20260706-235729` captured 404 walkthrough, stale-cache resolve, suspicious-site live-help, popup chat returning `ARIA web chat:`, and build marker `web-chat-20260707`.
- Chrome latest-build proof is still pending: command-line Chrome did not expose the unpacked ARIA extension service worker through DevTools, and the live Chrome profile has the extension active from the current repo path but is still running stale scripts. Evidence: `outputs/aria-sentinel-chrome-live-check-20260707`.

## Required Production Behavior

| Requirement | Current Status | Acceptance Gate |
|---|---|---|
| Monitoring toggle | GREEN | Explicit on/off protection toggle, visible state, persisted, tested; managed/admin policy lock implemented. |
| 404 detection | YELLOW | Classifier and prompt mapping exist; still needs live browser E2E fixtures for status-page variants. |
| Page cannot be displayed | YELLOW | Classifier maps browser/network failure class and avoids overclaiming cause; needs real Chrome/Edge/Safari E2E. |
| Proxy errors | YELLOW | Detects/suggests proxy/PAC check; no silent policy changes. Needs managed-policy/customer validation. |
| Certificate errors | YELLOW | Detects certificate class and guides safely; bypass remains blocked by default. |
| DNS/network errors | YELLOW | Detects DNS/network symptoms and routes to safe walkthrough/retry; still needs local-vs-vendor live proof. |
| Blocked resources | YELLOW | Detects resource errors and CSP violations where browser exposes them. |
| Cache/service-worker issue | GREEN/YELLOW | Current-origin clear/reload works with user prompt; needs real extension E2E recording. |
| Malicious/suspicious page | YELLOW | Warning/danger card and audit signal exist. True enterprise block/override policy is not production-ready. |
| Vendor/outage classification | YELLOW | Multi-signal classifier and outage copy exist; needs admin/vendor escalation workflow. |
| Manual walkthrough launch | GREEN/YELLOW | Exact issue context is sent to ARIA Chat through the local bridge/web chat path and browser outcomes are ingested locally. Fleet ingestion remains future work. |
| Extension popup chat | GREEN/YELLOW | Edge live proof confirms popup chat reaches ARIA web chat via KB-first path, exposes `https://iisupp.net/aria`, and carries build marker `web-chat-20260707`; Chrome currently needs extension reload before latest-build proof, and Safari runtime proof remains pending. |
| Install/pin onboarding | YELLOW | Explain pinning reality; do not claim self-force-pin. |

## Browser Safety Rules

- Fixes must stay scoped to the active origin unless admin policy explicitly grants broader scope.
- Never claim an extension can force-pin itself in unmanaged Chrome.
- Malicious-site block/override must be disabled by default in managed enterprise mode until admin policy is present.
- Every override and failure must be logged.
- Certificate, proxy, suspicious-site, and vendor-outage issues must route to guidance/escalation, not silent system setting changes.
- Browser protection off means no issue prompt, no detection log post, and no remediation action.
- Managed policy lock overrides user toggle state and disables the popup control when present.
- Outcome history must stay symbolic: issue ID, signal, action, outcome, severity, origin category, timestamp, and bridge status only.
- `/browser-outcome` must never receive or persist full URL, page title, page text, credentials, form values, screenshots, or raw browser errors.

## Phase 4 Implementation Notes

- `chrome-extension/site-prefs.js` now owns the reusable classifier plus global protection persistence.
- `chrome-extension/site-prefs.js` also resolves effective protection from user storage plus managed policy.
- `chrome-extension/content-script.js` now routes browser errors into one issue card with Resolve/Walkthrough/Live Help/Not Now options.
- `chrome-extension/content-script.js` records per-issue user outcomes through a content-blind `BROWSER_OUTCOME` message.
- `chrome-extension/background.js` now honors paused monitoring and exposes safe reload/protection handlers.
- `chrome-extension/background.js` caps local extension outcome history at 50 records, forwards sanitized outcomes to `/browser-outcome`, and blocks user toggle changes when managed policy locks protection.
- `chrome-extension/background.js` uses ARIA web chat fallback: no-cost KB query first, `aria-chat` only when KB is not confident.
- `chrome-extension/manifest.json`, `site-prefs.js`, `content-script.js`, and `popup.js` expose `web-chat-20260707` so stale installed extensions are detectable in live browser checks.
- `src/shared/browser-outcome.mjs` normalizes/dedupes browser outcomes and maps terminal outcomes into Sentinel proof metrics.
- `src/main/main.mjs` exposes the local `/browser-outcome` bridge endpoint and stores `browserOutcomes` separately from `resolutionOutcomes`.
- `chrome-extension/popup.*` now exposes the global protection toggle, explains admin-locked state, and labels the live web handoff as `ARIA web chat`.
- Edge and Safari extension assets were synchronized from Chrome.
- `tests/extension.test.mjs` covers the classifier, protection toggle, prompt text, content-script event hooks, background pause behavior, bridge forwarding, and popup wiring.
- `tests/browser-outcome.test.mjs` covers content-blind normalization, dedupe, proof mapping, and bridge wiring.
