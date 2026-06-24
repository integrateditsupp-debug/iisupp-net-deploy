# RUN 15 Report — Self-Heal Engine · Globe v3 · ARIA-Brain · Admin-Only · Start/Stop · Hotkey Fix · Live-Globe (held)

**Date:** 2026-06-19
**Directive (Ahmad):** "Do not leave room for failures. ARIA should not wait in autonomous mode for me to tell it a feature is broken. It must self-assess, self-debug, and escalate. Every change must include a unit test + a self-heal hook."
**Result:** All 10 sections delivered. Test suite **52 → 60** green. `node --check` clean on every touched file. **0 new runtime dependencies.** Privacy 6-host verifier unchanged. Committed **local only** — nothing pushed or published.

---

## What shipped

### 1. Self-Heal Engine — `src/shared/self-heal.mjs` (+ `tests/self-heal.test.mjs`)
- `auditFeatures(features, probe)` runs a programmatic probe per feature → status `pass | recoverable-failure | needs-code-fix | needs-design-fix`, each with a `healAction`.
- `summarizeAudit()` → totals, healed count, flagged list, `allClear`, headline.
- `escalationRoute(status)` → `needs-code-fix → claude-code-agent`, `needs-design-fix → cowork-agent`.
- `buildHealReport()` emits a **content-blind** `self-heal-report-v1`: feature ids run through `symbolic()` (reusing `redactPIIForClassificationOnly` from `safety.mjs`); paths, emails and stack frames are stripped to symbolic tokens. `isHealReportSafe()` rejects any report that still carries a path/stack/email.
- **Runtime hook:** `runSelfHeal()` in `main.mjs` audits hotkeys + watcher + bridge with real probes, **auto re-registers** dropped hotkeys, stores sanitized reports, and is exposed over IPC (`sentinel:self-heal`) + the renderer "Self check" button.
- **Receiver:** `netlify/functions/aria-self-heal-report.js` re-validates content-blindness (422 on failure) and queues to Netlify Blobs `self-heal-reports` for the agent queue. *(local only.)*

### 2. Globe behaviour v3 — `src/shared/globe-anchor.mjs` + `src/shared/globe-greetings.mjs`
- `anchorTarget()` = top-centre of a window's bounds; `tickAnchored()` repels the cursor within range and lerps back to the anchor after `IDLE_TELEPORT_MS` (2s) idle, snapping the last ~2px so integer window rounding can't leave it short or jittering.
- Wired into the main overlay loop (replaces free-roam `tickFreeRoam`). **Note:** foreground-window bounds of *other* apps aren't exposed without a native module (zero-dep rule), so the anchor is the **active display's work-area top-centre** (own focused window when one is focused). Documented as the dependency-free interpretation.
- Greeting scheduler `dueGreeting()`: launch "Hi" after a 2s grace, periodic ambient lines (18–22 min jitter), a 10-min chat-prompt bubble — **rate-limited to ≤1/60s**, silent in Autonomous + low-power, and no ambient greeting before the launch hi. Pushed to the overlay as `sentinel:greeting`; rendered as a bubble above the globe (`#overlayGreeting`).

### 3. Live globe icons — **PREPARED, HELD FOR APPROVAL (Rule 6)**
- Asset: `src/renderer/aria-live-globe.svg` (animated gold-ring + breathing core, matching iisupp.net/aria).
- Preview: `design-review/run15-live-globe-preview.html` — side-by-side current gold-A vs. proposed live globe at 48/96px.
- `tests/live-globe-icons.test.mjs` asserts the asset + preview are **ready** and the swap is **NOT applied** (rail header still `class="brand-globe"`).
- ⛔ **Awaiting Ahmad's sign-off before any icon is swapped in the rail/footer/extensions.** Open the preview HTML to review.

### 4. ARIA-brain integration — `src/shared/aria-brain-client.mjs`
- `askAria(prompt, ctx)` calls live `aria-chat` (+ `aria-research`), with `X-Sentinel-Device` / `X-Sentinel-License` headers and `source: "sentinel-desktop"`. Injectable `fetchImpl` for tests; offline fallback returns `{action:"local-kb-only", offline:true}`.
- 4-tier escalation `kb → screen-and-event → research → ticket`; `escalationCta()` surfaces the call/email CTA.
- `main.chat()` calls the brain first, falls back to local KB recipe matching when offline.
- Privacy: `BRAIN_OUTBOUND_PATHS` + `isBrainPathAllowed()` added; two new `ALLOWED_OUTBOUND_PATHS` entries on a distinct `brain-channel` direction so `EXPECTED_OUTBOUND_PATHS` (inbound-data count) stays unchanged and the **6-host verifier is untouched**.

### 5. Admin-only console — two-layer gate
- **Build layer:** `package:win:admin` bundles `admin-console` via `-c.extraResources`; the default `package:win` **excludes** admin-console from `build.files` — customer builds cannot contain it. `tests/admin-build-gate.test.mjs` proves the script difference + the gate.
- **Runtime layer:** `admin-gate.mjs` (`isAdminBuild`, `signAdminSession`, `validateAdminSession` with `timingSafeEqual` + expiry, 24h). `netlify/functions/aria-admin-auth.js` validates `ARIA_ADMIN_USERNAME` + bcrypt `ARIA_ADMIN_PASSWORD_HASH` (env only; denies if bcrypt/creds absent) and returns an HMAC session.
- `openAdminConsole()` returns `{ok:false,error:"not-available"}` in customer builds; the tray entry + renderer button are display-gated on `state.adminBuild`.

### 6. Start ARIA / Stop ARIA — `src/shared/start-stop.mjs`
- "Resume watching" replaced by **Start ARIA** + **Stop ARIA**. `applyRunState()` computes running/globeVisible/watchers/monitoring. `stopAria()` stops watchers, hides the globe, sets idle; `startAria()` re-arms detection + globe. IPC `sentinel:start-aria` / `sentinel:stop-aria`.

### 7. Hotkeys actually bind — `src/shared/hotkeys.mjs`
- `registerWithFallback()` tries primary then fallback combo, **confirms with `isRegistered`**, returns live status `active|failed` + `usedFallback`. `bindAll()` + `withRebinds()` (user rebinds from store). `registerHotkeys()` in main wires `globalShortcut.register/isRegistered` and logs per-key status; `runSelfHeal()` re-registers any that dropped. Per-row Rebind + live status in the Hotkeys tab. Fixes the RUN 12 silent-failure bug.

### 8. Tests 52 → 60
New suites: `self-heal` · `globe-anchor` · `globe-greetings` · `aria-brain-client` · `admin-build-gate` · `start-stop-aria` · `hotkeys-bind` · `live-globe-icons`. Two RUN 13 suites updated for the §6 rename + §7 rewire (`quick-controls`, `hotkeys`).

---

## Locked rules — compliance
- **0 new runtime deps** (admin-auth uses optional `bcryptjs` only if present at deploy; nothing added to the desktop bundle).
- Privacy allowlist grew by **exactly 2** brain paths on a distinct direction; **6-host runtime verifier + telemetry schema unchanged**.
- **Customer builds exclude admin-console**; admin auth is **env-var only**; no hardcoded creds/tokens.
- Self-heal reports are sanitized + receiver-validated (no user content, no stack-trace paths).
- Greetings rate-limited ≤1/60s and quiet under low-power / Autonomous.
- **Live-globe swap (§3) NOT applied — held for Ahmad.**
- Netlify functions committed **local only**; nothing pushed or published.

## Deferred / follow-ups
- **§3 live-globe icon swap** — awaiting Ahmad approval (preview ready).
- True per-app **foreground-window** anchoring (vs. active-display top-centre) needs a native window-tracking module — out of scope under the zero-dep rule; revisit if a dep is approved.
- `aria-chat` / `aria-research` must accept the new `source: "sentinel-desktop"` payload + `X-Sentinel-*` headers server-side before the brain path is live (functions exist; wiring is Ahmad's ship step).

## Verification
- `npm test` → **60 suites green** ("ARIA Sentinel test suite passed.").
- `node --check` clean on all touched `.mjs` / `.cjs` / `.js`.
