# RUN 2 Report — Yellow recipes + tray dynamic state + Chrome per-site disable

**Date:** 2026-06-19 · **Suite:** 17/17 green · **`node --check`:** clean on every touched file · **Dependencies added:** 0 · **New Chrome permissions:** 0 · **Published:** nothing

---

## Built

### 1 · Yellow recipe tier — invasive-but-reversible, confirm-only, restore-point-mandated
RUN 1 had one execution tier (green). RUN 2 adds a distinct **yellow tier** with two guarantees the green tier does not carry, both enforced in the gate (`isActionExecutable`), not just the UI:

1. **Never auto-fires.** A yellow action executes only when `confirmed === true`, *regardless of mode* — Autonomous can never trigger one. The gate takes no `mode` input, so there is no bypass.
2. **Restore point first.** A yellow action executes only when `restorePointTaken === true`. `main.mjs` records the System Restore point before the action loop; if that fails, `restorePointTaken` stays false and nothing runs.

| Recipe | Signal | Real actions (all reversible) | Verify probe |
|---|---|---|---|
| `outlook-ost-repair-v1` | APP.OUTLOOK.OST_CORRUPT (R-04) | close Outlook → **rename** `.ost`→`.ost.aria.bak` (never delete) → reopen | Outlook process count |
| `teams-cache-v1` | TEAMS.STUCK (R-09) | kill Teams → clear rebuildable cache folders | Teams process count |
| `onedrive-sync-stuck-v1` | APP.ONEDRIVE.SYNC_STUCK (R-10) | `OneDrive.exe /reset` → relaunch | OneDrive process count |
| `bluetooth-off-v1` *(new)* | BLUETOOTH.OFF (R-12) | `Restart-Service bthserv -Force` | `(Get-Service bthserv).Status` |

New `.ps1` source mirrors: `rename-ost.ps1`, `reset-onedrive.ps1`, `restart-bthserv.ps1`.

**Deliberate refinement — `teams-cache-v1` moved green → yellow.** In RUN 1 it sat in the auto-fireable green set, which meant Autonomous mode could kill Teams + clear IndexedDB mid-call. That is a yellow-tier act. RUN 2 reclassifies it so it always confirms. Net effect: green tier 8 → 7, yellow tier 0 → 4, **total executable 11** (up from 8). No command-allowlist surface was widened — the OST rename rides the existing `Get-` prefix (`Get-ChildItem … | Rename-Item`), and `Rename-Item` is not on the denylist.

### 2 · Tray dynamic state — 4 icon variants
- `src/main/tray-art.mjs` (new, pure, no Electron) — `traySvg(state)` renders four visually distinct globes: **idle** (gold), **detection** (cyan + alert dot), **fixing** (amber + sweep arc), **escalation** (red ring + bang). Unknown state falls back to idle.
- `makeTrayImage(state)` now wraps `traySvgDataUrl(state)` in a nativeImage.
- `setAgentState()` swaps the tray image and is wired to the orchestrator: detection → `detection` (or `escalation` for a red recipe), recipe start → `fixing`, success → `idle`, failure / self-error → `escalation`, dismiss → `idle`. `agentState` is also surfaced in `getState()`.

### 3 · Chrome extension — per-site "leave me alone" + auto-pause
- `chrome-extension/site-prefs.js` (new) — pure, dual-mode (classic `globalThis.AriaSitePrefs` + CommonJS export) so it loads as the first content script *and* is unit-testable. Holds host normalisation, the disabled-list toggle, the 5-min auto-pause window, and `chrome.storage.sync` load/save helpers.
- **Per-site disable** — popup gains an "On this site" toggle. State persists in `chrome.storage.sync` (follows the user across devices) under one key. The content script refuses to inject the globe on a disabled host and reacts live to `storage.onChanged`.
- **Auto-pause** — the content script hides the globe after the tab is unfocused for `AUTO_PAUSE_MS` (5 min) and restores it on focus (unless the site is disabled).
- **No new permission** — rides the existing `storage` grant. Manifest content-script order is now `["site-prefs.js", "content-script.js"]`.

---

## Tests (15 → 17 suites)
- **`tests/recipe-runner.test.mjs`** (new) — the 4 yellow recipes; gate denies without confirm (even with `mode:"autonomous"`); denies without a restore point; allows with confirm + restore point + flag; green tier still auto-eligible; red never executes; an orchestration contract proving the **restore-point hook runs before any action** and a failed restore point blocks execution; 3 new yellow `.ps1` mirrors match.
- **`tests/tray-state.test.mjs`** (new) — 4 states yield pairwise-distinct SVGs and data URLs; each is well-formed and state-tagged; unknown/missing → idle.
- **`tests/extension.test.mjs`** (extended) — no new permissions; `site-prefs.js` loads first; real module exercised in a `vm` sandbox: host normalisation, **disabled site persists across a reload** via an in-memory `chrome.storage.sync`, re-enabling persists; content script consults the disable list + implements auto-pause; popup has the toggle.
- **`tests/recipe-execution.test.mjs`** (updated) — green set now 7; asserts a yellow recipe is still "executable" (verify path) but blocked at the action gate without confirm.

```
Recipe-execution test passed (7 reversible greens cleared, 20 stay dry-run, denylist holds).
Recipe-runner yellow-tier test passed (4 yellow recipes, confirm + restore-point enforced, Autonomous cannot bypass).
Tray-state test passed (4 distinct state icons, idle fallback).
Chrome extension test passed (manifest + per-site disable persists across reloads + auto-pause).
ARIA Sentinel test suite passed.   ← 17/17
```

---

## Acceptance ticks
- [x] `npm test` = **17/17** suites green
- [x] Yellow recipes execute on confirm only, **even in Autonomous mode** (gate-enforced, mode-independent)
- [x] Tray icon changes on detection (and on fixing / escalation) — 4 distinct state icons
- [x] Chrome ext popup has a per-site toggle that **persists** (chrome.storage.sync, verified across a reload)
- [x] `node --check` clean on every touched file
- [ ] **VM-only (manual):** confirm a yellow recipe in a Windows VM and watch the restore point + reversible action run

---

## Remaining for next run (RUN 3)
- Real network-capture privacy verifier (10s `webRequest` sniff, 6-host allowlist proof)
- One-button RFP evidence pack ZIP export
- Subtle attention wiggle on first detection per session
- "What's new" modal on update
- New suites: `network-capture.test.mjs`, `evidence-pack.test.mjs` → target **19/19**

## Notes toward §0 destination
- Recipes executing for real: **11 / 20** (7 green + 4 yellow).
- `npm test` suites: **17 / 18** target.
- Locked rules held: zero new deps, zero new Chrome permissions, denylist intact, no external send, 7-tab/13-tab UI untouched, nothing published.
