# RUN 19 — Live-app polish + premium UX

**Date:** 2026-06-20 · **Suite:** 79 → 86 (all green) · **New deps:** 0 · **Published:** nothing (local commit only)

ARIA Sentinel v0.1.0 hardened for paying-customer ship. All 8 fixes landed in priority order; the two
PRIORITY fixes (kill-switch, triple-confirm delete) ship. RUN 17 audit-banner, RUN 18 enterprise wiring,
and `admin-publish` stay green. `node --check` clean on every touched `.mjs`/`.cjs`/`.js`.

## 1 · Files touched

1. `src/renderer/index.html` — globe hosts, top-bar mode pill, kill-switch Hotkeys row, luxe trial-end modal, triple-confirm modal, toast stack, Privacy delete-prefs panel, "Enter license" copy
2. `src/renderer/renderer.js` — globe import, toast helper, triple-confirm flow, kill-switch listener + globe-dim, trial nudge, plan-subscribe wiring, `alert()` → toast
3. `src/renderer/sentinel.css` — popup clamp, centered brand + globe hosts, mode pill, kill row, delete modal, luxe trial-end cards (shimmer/glow), 3+2 odd grid, toast stack
4. `src/renderer/components/aria-globe.mjs` **(new)** — self-contained `<aria-globe>` canvas custom element
5. `src/shared/delete-confirm.mjs` **(new)** — pure triple-confirm decision layer + prefs normalizer
6. `src/shared/kill-switch.mjs` — added panic-kill helpers (`KILL_HOTKEY`, `buildKillResult`, `pickUndoTarget`) alongside the existing detect-only layer
7. `src/main/main.mjs` — child-process tracking, `activateKillSwitch`/`killAllChildren`, kill-hotkey registration, delete-prefs IPC + persistence, `deletePrefs` in state, Stripe env names, `backgroundThrottling:false`
8. `src/main/preload.cjs` — delete-prefs + kill-switch bridge methods
9. `admin-console/index.html` — fleet drill-in `alert()` → real inline detail render
10. `tests/run-all.mjs` — registers the 7 new suites
11. `tests/live-globe-icons.test.mjs` — rail assertions updated to the `<aria-globe>` component (mini-globe SVG + extension icons + protected marks unchanged)
12-18. **(new tests)** `popup-clamp` · `sidebar-layout` · `kill-switch-hotkey` · `delete-triple-confirm` · `trial-end-modal` · `odd-grid` · `live-buttons`
19. `docs/ENTERPRISE_READINESS.md` — 9.95 → 9.97
20. `docs/RUN_19_REPORT.md` **(new)** — this file

## 2 · The 8 fixes (before → after)

| # | Fix | Before | After |
|---|-----|--------|-------|
| 1 | Popup clipping | Modal cards could overflow window edges in a small window | All modal/popup cards clamp to `calc(100vh - 80px)` + `overflow-y:auto`; `.onboarding` keeps 20px edge padding. *Verify: shrink window to 600×400 → every popup fully visible + scrollable.* |
| 2 | Brand centered + live globe | Brand left-aligned w/ wrap; mode status in brand; two static SVG `<img>` globes | `.settings-brand` centered column; mode/watching status is a top-bar `mode-pill`; both rail globes are the animated `<aria-globe>` (56 header / 120 footer), rAF-cleaned, unfocused-safe |
| 3 | Kill-switch hotkey | none | `Ctrl+Alt+K` (fallback `Ctrl+Shift+Pause`): SIGKILL tracked children → undo last restore point → dim globe → red toast; red "Panic" row in Hotkeys. Single-purpose, synchronous (≤2s) |
| 4 | Triple-confirm delete | restore-point rollback fired on one click (+`alert`) | 3-step modal on every irreversible action; per-ext opt-out → single confirm (never silent); `userData/delete-prefs.json`; Privacy-tab list + Reset |
| 5 | Trial-end purchase prompt | small 5-button plan grid | full-screen cyber-noir/gold modal, Cinzel header, 5 tiers each → Stripe env URL, shimmer/glow, "Enter license", + <30% non-blocking nudge toast |
| 6 | Odd-number layout | 5 cards wrapped (orphan on last row) | 6-col span-2 grid → 3 top + 2 centered; responsive 2-col fallback |
| 7 | "Enter license key" → "Enter license" | 2 occurrences | 0 occurrences (placeholder + buttons) |
| 8 | Live-button audit | 1 renderer `alert()`, 1 admin `alert()` placeholder | all 65 static buttons → real handlers; no `alert()`/`console.log`/stub dummies; admin drill-in renders real detail |

*Screenshots: GUI render is on-device QA (the build runs on Ahmad's machine); static structure/wiring is
locked by the 7 new suites below in lieu of pixel captures, matching the RUN 16/18 accessibility-battery
precedent.*

## 3 · New test results (per file)

| Suite | Result |
|-------|--------|
| `popup-clamp.test.mjs` | PASS — grouped clamp rule covers 4 modal classes w/ `calc(100vh-80px)`+scroll; classes present; overlay padding |
| `sidebar-layout.test.mjs` | PASS — 2 globes (56/120); brand centered column; status pill out of brand + in top bar; renderer updates pill |
| `kill-switch-hotkey.test.mjs` | PASS — hotkey def; `pickUndoTarget` skips rolled-back; `buildKillResult` counts/undoes/dims; main SIGKILL+undo+IPC wiring; single-purpose (no prompt/menu/delay) |
| `delete-triple-confirm.test.mjs` | PASS — `extOf`/`normalizeExt`; 3 default / 1 opted-out / 3 for folders; immutable add + reset; `normalizePrefs` dedupe; file round-trip; main IPC + renderer + HTML wiring |
| `trial-end-modal.test.mjs` | PASS — 5 cards/5 CTAs/5 tiers + prices; Subscribe→choosePlan; 5 Stripe env names; shimmer+focus glow; no "Enter license key" |
| `odd-grid.test.mjs` | PASS — 6-col span-2; cards 4/5 centered; 5 cards; 2-col responsive fallback |
| `live-buttons.test.mjs` | PASS — 65 buttons audited, all wired; no `alert()`/`console.log`/stub in renderer; no `alert()` in admin |

Full suite: `node tests/run-all.mjs` → **86 suites, "ARIA Sentinel test suite passed.", exit 0.**

## 4 · Live-button audit (button → handler → tab)

| Button | Handler | Tab |
|--------|---------|-----|
| Start ARIA / Stop ARIA | `startAria` / `stopAria` → `sentinel.startAria/stopAria` | Control Center |
| Show globe / Pause 1 hour | `showGlobe`/`pauseOneHour` → `showGlobe`/`setPaused` | Control Center |
| Self check / Repair ARIA | `runSelfDiagnose`→`selfHeal` / `runSelfRepair`→`selfRepair` | Control Center |
| Recipe Dry-run | `[data-recipe-run]` → `runRecipe`/`selfRepair` | Recipes |
| Simulate ARIA error | `simulateAriaError` → `detect` | Recipes |
| Update knowledge / Install instructions | `updateKnowledge` / `extInstructions` toggle | Knowledge |
| Live capture (10s) / Export evidence pack | `liveCapture`→`privacyCapture` / `exportEvidence`→`exportEvidence` | Privacy |
| Export audit JSON/CSV/PDF | `exportAudit` / `exportAuditCsv` / `exportAuditPdf` | Privacy |
| Reset all delete confirmations | `resetDeletePrefs` → `resetDeletePrefs` | Privacy |
| Re-enable `<ext>` | `[data-restore-ext]` → `clearDeletePref` | Privacy |
| Rebind (per hotkey) | `[data-rebind]` → `rebindHotkey` | Hotkeys |
| Run diagnostic | `runDiagnostic` → `runDiagnostic` | Troubleshoot |
| Roll back this fix | `[data-rollback]` → `confirmDelete` → `rollback` | Troubleshoot |
| Test connection / Save / Send test ping | `testServiceNow` / `saveNotify` / `testNotify` | ServiceNow |
| Post (incident) | `[data-comment-post]` → `serviceNowComment` | ServiceNow |
| Call/Email/WhatsApp/Chat/Status | `[data-support]` → `openExternal` | Support |
| Check for updates / Manage subscription | `checkUpdates` / `manageSubscription` | About |
| Start 30-day trial / Logout / Activate | `startTrial` / `logoutBtn` / `enterLicenseBtn` | About |
| Install update / Get latest | `installUpdateBtn` / `getLatestBtn`(`data-support`) | About |
| Roll back to this (version) | `[data-rollback-version]` → `rollbackUpdate` | About |
| Subscribe (×5) | `.plan-subscribe[data-plan]` → `choosePlan` | Trial-end modal |
| Enter license / Activate (modal) | `planEnterLicenseLink` / `planActivateBtn` → `enterLicense` | Trial-end modal |
| Delete / Yes,delete / Permanently delete / Cancel | `deleteConfirm` / `deleteCancel` | Delete modal |

## 5 · Dummies removed

| Location | Was | Now | Rationale |
|----------|-----|-----|-----------|
| `renderer.js` restore-point rollback | `alert("Roll back requested…")` | `showToast(...)` after a real `sentinel.rollback`, now behind the triple-confirm gate | `alert()` is a blocking dummy-tier popup; toast is non-blocking + on-brand |
| `admin-console/index.html` fleet drill-in | `alert('Drill into …')` | real inline `#fleetDetail` render from live fleet data | drill-in was a placeholder; now shows the endpoint/health/fixes summary (handles only, privacy rule R11) |

*Kept:* the hotkey `prompt()` (rebind) and admin `prompt('Admin token')` — both are real input handlers
that drive `rebindHotkey` / token auth, not dummy stubs.

## 6 · Readiness

`docs/ENTERPRISE_READINESS.md` bumped **9.95 → 9.97**. The remaining lift to 10.0 stays Ahmad's wallet
items (EV/Apple signing, independent pen test, store/legal, first paid pilot).

## 7 · Guardrails honored

- 86/86 green; RUN 17 banner, RUN 18 wiring, `admin-publish` intact; 10-tab settings / 14-view admin locked.
- 0 new deps (canvas globe + ZIP/HMAC-free; built-in Electron APIs only).
- `<aria-globe>` is self-contained and cancels its rAF on `disconnectedCallback` (no canvas leak).
- Untouched: `axis/`, `netlify/functions/*`, `aria-vault/*`, audit-integrity banner CSS.
- Local commit only — Cowork pushes from the sandbox.
