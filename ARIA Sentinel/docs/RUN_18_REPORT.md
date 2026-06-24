# RUN 18 Report — Enterprise verification + evidence pack

**Date:** 2026-06-20
**Result:** Suite **77 → 79** green. RUN 17 audit-integrity banner regression intact. `node --check` clean. 0 new deps. Nothing published. `axis/` (RUN A, 2b8760f) untouched.

## Headline finding — the 4 features already shipped
The packet was adapted from a **pre-RUN-12 ROADMAP_TO_V1 RUN 3** brief. All four features it asks to "ship" were already built in the original Sentinel program (RUN 3-era), are wired, and are tested. RUN 18 is therefore the **verification pass** that brief intended — confirm to-spec, lock the wiring against regression, and prove the buyer-facing guarantees at a deeper level. No feature code was changed (so zero regression risk to the 10-tab settings / 14-view admin / RUN 17 banner / denylist).

## Before / after feature surface

| Feature | Before RUN 18 | After RUN 18 |
|---|---|---|
| 1 · Network capture verifier | Built: `runPrivacyCapture` runs a real 10s `session.webRequest.onBeforeRequest` sniff → `summarizeCapture` (6-host allowlist + sanitization). UI "Live capture (10s)". Unit-tested (`network-capture.test.mjs`). | **Unchanged + wiring locked.** New suite asserts the main-process sniff is real, the listener is cleared, and a bad host + leaking body yields a failing verdict. |
| 2 · RFP evidence pack | Built: `exportEvidencePack` → `~/Documents/aria-sentinel-evidence-<date>.zip`, 6 artifacts + manifest, hand-rolled zero-dep ZIP. UI "Export evidence pack". Unit-tested (`evidence-pack.test.mjs`). | **Unchanged + content-blindness proven.** New suite asserts the pack leaks **no recipe shell commands** (registry is id/signal/risk/mode only), valid Windows-openable ZIP, dated filename. |
| 3 · Attention wiggle | Built: `overlay.html` `@keyframes aria-attention` (300ms, ±5px) on `data-state="attention"`, fired once/session (`wiggledThisSession`). | **Unchanged + locked** by the wiring suite. |
| 4 · What's-new modal | Built: reads `docs/RELEASE_NOTES_<version>.md` (file exists for 0.1.0), `shouldShowWhatsNew` skips first install, "Got it" acks. Unit-tested. | **Unchanged + locked**; suite asserts the release-notes file for the current version exists on disk (modal never empty). |

## What RUN 18 added (net-new, non-duplicative)
- `tests/run18-enterprise-wiring.test.mjs` — locks the **main-process wiring** the pure-module tests never touched: real 10s webRequest capture + listener teardown; evidence ZIP → `~/Documents` with the dated name; **PS-arg safety** (`spawn(file, args)` positional argv, no `shell:true`, no `execSync`); what's-new reads versioned release notes + the file exists; attention wiggle once/session; **UI regression locks** (10 settings tabs, 14 admin views); RUN 17 audit-integrity verifier + tamper alert still present.
- `tests/run18-evidence-content-blind.test.mjs` — artifact-level content-blindness (no recipe commands/script internals anywhere in the pack), symbolic-only recipe registry, valid complete ZIP, the **exfil verdict** (non-allowlisted host + leaking body → `pass:false`), and proof the RUN 14/15 update/brain path classes did **not** widen the 6-host telemetry verifier.

## Stale-packet corrections (flagged, not silently followed)
- **Tabs:** packet says "7-tab settings / 13-tab admin" — stale. Live build is **10 settings tabs** (RUN 13 reorg) + **14 admin views**. Suites lock the current counts.
- **ZIP impl:** packet suggested PowerShell `Compress-Archive` + deflate fallback. The shipped pack already uses a **hand-rolled zero-dep ZIP** (`zip.mjs`, zlib) — cross-platform, deterministic, no PS dependency, no PS args to sanitize. Kept as-is (replacing working code with a PS shell-out would add risk, not value).
- **"+2 new suites = network-capture.test + evidence-pack.test":** those files already exist in the 77. Added two distinctly-named RUN-18 verification suites instead → 79.

## Acceptance
- `npm test` = **79/79 green**.
- RUN 17 audit-integrity banner: fires on tamper (regression suites pass).
- 10-tab settings + 14-view admin untouched (locked by test). Denylist intact (untouched). No external send; nothing published; local audit only.
- 0 new deps. `axis/` untouched.

## Readiness
Score **holds at 9.95** (10.0 reserved for independent pen-test + first paid pilot). The four features were already counted in 9.95; RUN 18 doesn't add buyer capability, it **hardens** what's there by locking the enterprise guarantees against silent regression. Bumping the number for a verification-only pass would misrepresent capability — flagged here per faithful-reporting.
