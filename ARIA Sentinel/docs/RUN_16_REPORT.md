# RUN 16 Report — Full Test Battery (12 dimensions) + Live-Globe Swap + RUN 15 Gap-Close

**Date:** 2026-06-19
**Result:** Live-globe icon swap APPLIED (Ahmad approved). All 12 test dimensions green. Suite **60 → 75** green. `node --check` clean. 0 new runtime deps. Privacy 6-host verifier + update/brain paths unchanged. Committed **local only** — nothing pushed, uploaded, or published.

---

## §0 · Live-globe icon swap — APPLIED

Ahmad approved the RUN 15 preview, so the swap shipped:
- **In-app (Settings window):** header `.brand-globe` (~46px), footer `.aria-living-globe` (~84px), and the ServiceNow panel chip `.mini-globe` (~34px) now render the live iisupp.net/aria globe via `<img src="aria-live-globe.svg">`. The rotating gold ring + breathing core animate inside the SVG's own `<style>`, which runs even when referenced through `<img>` — so the swap is one asset reused everywhere, no per-instance ID collisions.
- **Extensions:** Chrome · Edge · Safari toolbar icons (`icons/i-16.png` · `i-32.png` · `i-128.png`) rasterized from the live globe. Generation pipeline (recorded in `design-review/`): headless Chrome renders a 400px master (`icon-src.html`) → a **dependency-free** PNG box-average downscaler (`png-downscale.mjs`, node:zlib only) produces exact 16/32/128 icons. Safari's previously-malformed 41×226 icons are now correct squares.
- **Kept unchanged (Ahmad's explicit instruction):** the floating desktop **overlay crystal-A** presence avatar (`overlay.html` `.aria-globe`) and the Windows installer **`build/icon.ico`**.
- **Audit:** a grep of `src/` + `admin-console/` found no remaining in-app gold-A globe other than the protected overlay. (The admin console header uses a separate **shield** mark, not the gold-A globe; left as-is.)
- **Record:** before/after at `design-review/run16-live-globe-after.html`. Tests: `tests/live-globe-icons.test.mjs` (swap applied + protected marks intact) and `tests/icon-pipeline.test.mjs` (PNG round-trip + transparency).

## §1 · Test universe — 12 dimensions, all green

| Dim | Suite | Result |
|---|---|---|
| A Debug | `debug-battery` | 8 features probed, 4 injected faults all detected (2 auto-heal, 2 escalate), 0 silent failures |
| B QA | `qa-battery` + `qa-inventory.json` | 47/47 items wired (tabs · buttons · IPC · hotkeys · recipes) |
| C User behaviour | `user-journey` | 5/5 journeys reach success, 0 dead-ends |
| D Security | `security-battery` | hardened webPreferences · no eval · CSP · constant-time HMAC · env-only admin auth · destructive denylist · content-blind IPC |
| E Privacy | `privacy-battery` | 10,000-input fuzz, 0 leaks · allowlists unchanged · greetings/reports/offline content-blind |
| F Scenario | `scenario-battery` | 167 scenarios · 77/77 recipes routed · 90/90 out-of-domain escalate |
| G KB-QA | `test-kb-qa` + `fixtures/test-kb.md` | 20/20 cited exactly · 5/5 off-KB → "I don't know" |
| H Audit | `audit-battery` + `audit-integrity` | ISO ts · CSV+PDF complete · tamper chain detects modify/truncate/extend/reorder |
| I SOC 2 | `soc2-map` + `SOC2_READINESS_MAP.md` | CC1–CC9 mapped · ~75% readiness (≥70% target) |
| J Regulatory | `regulatory-map` + `REGULATORY_COMPLIANCE_MAP.md` | PIPEDA · GDPR · CCPA · CASL |
| K Legal | `legal-inventory` + `LEGAL_INVENTORY.md`/`EULA.md`/`DPA_TEMPLATE.md` | no GPL/AGPL · EULA + DPA clauses |
| L Accessibility | `accessibility-battery` | static WCAG 2.1 AA across renderer HTMLs |

Per-dimension detail in the 13 `docs/RUN_16_TEST_RESULTS_*.md` files (12 dimensions + live-globe).

## §2 · New module
- **`src/shared/audit-integrity.mjs`** — tamper-evident SHA-256 hash chain over the audit log (genesis-anchored, content-blind fields only) with `sealAudit` / `verifyAudit` (locates the broken index; classifies modify vs row-count-change), `assertIsoTimestamps`, `entriesInWindow`. Pure + zero-dep. **Follow-up:** wire `verifyAudit` into session-start so a tampered on-disk log alerts the admin automatically (module + tests ready; runtime hook is a small main.mjs addition).

## §3 · RUN 15 gap-close
- **aria-chat / aria-research header handling:** the live `aria-chat` function lives in the **parent site repo** (`../netlify/functions/aria-chat.js`, already carrying uncommitted site changes), not the Sentinel subtree, and there is no separate `aria-research.js` there yet. Per the no-push protocol and to avoid clobbering uncommitted site work, I did **not** modify it. The Sentinel brain client's extra `source:"sentinel-desktop"` body field + `X-Sentinel-Device`/`X-Sentinel-License` headers are **additive and backward-compatible** (JSON handlers ignore unknown body fields; HTTP servers ignore unknown headers), so the brain path works today. **Recommended live-site follow-up (Ahmad/Codex, in the site repo):** read `X-Sentinel-*` for per-device routing/telemetry and add an `aria-research` endpoint.
- **Self-heal escalation queue:** `aria-self-heal-report.js` validates content-blindness (422 on leak) and queues to Netlify Blobs `self-heal-reports`; verified at the function/contract level. A dedicated admin-console queue **panel** is a follow-up (reports already land in the store).
- **Hotkey rebind round-trip:** capture → `withRebinds` merge over `DEFAULT_HOTKEYS` → persist via electron-store `hotkeyRebinds` → `registerHotkeys()` re-reads on launch; covered by `tests/hotkeys-bind.test.mjs`.

## §4 · Locked-rule compliance
- **0 new runtime deps.** `eslint-plugin-security` and `axe-core` were **not** added — the security + accessibility batteries use hand-rolled static checks that cover the same rule intents without a dependency (justified per dimension). `bcryptjs` remains an optional server-side import for admin auth (not in the desktop bundle).
- **Privacy invariants UNCHANGED** — 6-host runtime verifier, update +2 paths, ARIA-brain +2 paths, inbound-data count 3 (asserted in `privacy-battery`).
- **Customer build (`package:win`) excludes** admin-console, tests, fixtures, design-review previews, and docs — `build.files` is an allow-list of customer paths only; asserted by `tests/build-exclusion.test.mjs`. Admin console ships only via `package:win:admin`.
- Test fixtures (`test-kb.md`, `qa-inventory.json`) and preview HTMLs are committed local only, not bundled.
- All RUN 1–15 suites stay green.

## §5 · Verification
- `npm test` → **75 suites green** ("ARIA Sentinel test suite passed.").
- `node --check` clean on every new/edited `.mjs` / `.cjs` / `.js`.
- Readiness bumped to **9.95** (10.0 reserved for after pen test + first paid pilot).
