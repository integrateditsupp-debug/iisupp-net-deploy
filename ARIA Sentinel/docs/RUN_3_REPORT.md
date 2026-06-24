# RUN 3 Report — Privacy verifier + RFP evidence pack + attention wiggle + "What's new"

**Date:** 2026-06-19 · **Suite:** 19/19 green · **`node --check`:** clean on every touched file · **Dependencies added:** 0 · **Published:** nothing

---

## Built

### 1 · Real network-capture privacy verifier
- `src/shared/network-capture.mjs` (new, pure) — a **6-host allowlist** (`iisupp.net` + subdomains · `download.iisupp.net` · `127.0.0.1` · `localhost` · `::1` · `*.service-now.com`), `classifyRequest()` (host · path · method · payload-bytes · sanitization-status · allowlist-match), and `summarizeCapture()` (verdict: 0 disallowed hosts, 0 leaking payloads, 0 user-content requests). Payloads run through the existing `assertContentSafePayload`.
- **Settings → Privacy verifier → "Live capture (10s)"** — `main.runPrivacyCapture()` attaches a real `session.defaultSession.webRequest.onBeforeRequest` listener for 10s, then clears it. The 3 declared inbound GET pulls seed the cyan-tick rows; any extra/leaky request the sniff catches is surfaced in red. Verdict + per-request rows render in the privacy tab. Result is cached for the evidence pack.
- **No external send added** — the capture is purely observational; the baseline rows come from the declared allowlist, not from firing traffic.

### 2 · One-button RFP evidence pack
- `src/shared/zip.mjs` (new) — a **dependency-free ZIP writer + reader** built on Node's `zlib` (CRC-32, DEFLATE local headers, central directory, EOCD). Deterministic (fixed DOS date) so the test is reproducible. `listZipEntries()` walks the central directory for verification.
- `src/shared/evidence-pack.mjs` (new, pure) — assembles the **6 required artifacts**: `audit-log-30d.json` (30-day window), `privacy-snapshot.json`, `network-capture.json` (last live capture), `recipe-registry.json` (version + recipes), `sbom-lite.json`, `signed-bundle-hash.json` — plus a `manifest.json`.
- **Privacy tab → "Export evidence pack"** — `main.exportEvidencePack()` reads the on-disk SBOM + release manifest, zips, and writes `~/Documents/aria-sentinel-evidence-YYYY-MM-DD.zip`.
- **Verified real & openable:** Windows `Expand-Archive` extracted all 6 artifacts + manifest with intact JSON; build is ~1.7 KB and completes in milliseconds (well under 5s).

### 3 · Attention wiggle
- `overlay.html` — pure CSS keyframe `aria-attention` (300ms, ±5px) on `.aria-globe[data-state="attention"]`.
- `overlay.js` — a session flag fires the wiggle **once per session** on the first detection, then settles into the diagnosing/escalation state.

### 4 · "What's new" modal
- `src/shared/whats-new.mjs` (new, pure) — `compareVersions()` + `shouldShowWhatsNew({lastSeenVersion, currentVersion, firstRun})`: show when last-seen is strictly older than current, **skip on first install**, never nag without a known prior.
- `main` records `lastSeenVersion` on first run (silent), exposes `whatsNew {show, version, notes}` in `getState()` (notes read from `docs/RELEASE_NOTES_<version>.md`), and acknowledges via `sentinel:ack-whats-new`.
- Renderer shows a single scrollable card (`#whatsNew`); **"Got it"** updates `lastSeenVersion`.

---

## Tests (17 → 19 suites)
- **`tests/network-capture.test.mjs`** (new) — 6-host allowlist; 3 declared GET pulls; a mock `onBeforeRequest` listener collecting the clean pulls → **0 disallowed hosts**, 0 leaks, pass; an allow-listed symbolic POST is content-blind; an exfil (off-allowlist host + user-content payload) is caught; suffix-spoof host rejected.
- **`tests/evidence-pack.test.mjs`** (new) — ZIP round-trip (PKZIP signature, central-directory listing, DEFLATE inflate back to original); all **6 artifacts** present in the pack and in the real `.zip`; 30-day audit window drops older entries; `evidenceFileName` shape; and the what's-new version logic (older→show, equal→no, first-install→skip).

```
Network-capture test passed (6-host allowlist, 3 declared pulls, exfil + leak caught, 0 disallowed on clean run).
Evidence-pack test passed (6 artifacts in a real zip, 30d window, zip round-trip, what's-new logic).
ARIA Sentinel test suite passed.   ← 19/19
```

---

## Acceptance ticks
- [x] `npm test` = **19/19** suites green
- [x] Privacy verifier "Live capture" shows the 3 allowed outbound paths as cyan-tick rows (off-allowlist / leaks render red)
- [x] "Export evidence pack" produces a real ZIP (Windows-openable, 6 artifacts) in well under 5s
- [x] First detection per session: globe wiggles once (300ms, ±5px)
- [x] "What's new" modal triggers on version bump, skips first install
- [x] `node --check` clean on every touched file

---

## Remaining for next run (RUN 4 — macOS port)
- `src/sub-agents/detection/macos/` mirror watchers (df / log stream / crash glob / top / scutil)
- macOS permissions UX (Full Disk Access + Accessibility deep links), tray + globe vibrancy
- Ad-hoc code-signing for first run
- New suite: `macos-watchers.test.mjs` (content-leak fuzz) → target **20/20**

## Notes toward §0 destination
- §0 build-acceptance items now checked: network verifier · evidence pack · attention wiggle · "What's new" · `npm test` ≥ 18 suites · tray dynamic state (RUN 2) · Health Score (RUN 1) · BSOD Tier A (RUN 1).
- `npm test` suites: **19** (cleared the 18+ target).
- Locked rules held: zero new deps (ZIP hand-built on `zlib`), denylist intact, no external send, 7-tab/13-tab UI untouched, nothing published.
