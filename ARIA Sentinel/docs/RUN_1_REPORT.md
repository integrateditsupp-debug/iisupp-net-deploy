# RUN 1 Report — More green recipes + BSOD Tier A + Health Score

**Date:** 2026-06-19 · **Suite:** 15/15 green · **`node --check`:** clean on every touched file · **Dependencies added:** 0 · **Published:** nothing

---

## Built

### 1 · Live-execution coverage lifted 3 → 8
The cleared-for-real recipe set (`EXECUTABLE_RECIPES` in `src/shared/recipe-runner.mjs`) went from 3 to **8**. Every newly-cleared fix is a reversible cache flush or service restart that Windows recovers from on its own — no data is deleted, no profile/credential is touched.

| Recipe | Signal | Real action | Verify probe (read-only) | Mirror script |
|---|---|---|---|---|
| `dns-fail-v1` | NET.DNS.FAIL | `ipconfig /flushdns` (existing) **+ R-02 follow-on:** `ipconfig /registerdns`, `Restart-Service Dnscache -Force` | `(Get-DnsClientCache).Count` | `flush-dns.ps1`, `dns-reregister.ps1` |
| `disk-low-space-v1` | DISK.LOW_SPACE | clear user temp (existing) | free GB on C: | `clear-temp-files.ps1` |
| `teams-cache-v1` | TEAMS.STUCK | clear Teams cache (existing) | Teams process count | `clear-teams-cache.ps1` |
| **`wifi-no-internet-v1`** | NET.WIFI.DROP (R-03) | `Restart-Service WlanSvc -Force` | `(Get-Service WlanSvc).Status` | `restart-wlan.ps1` |
| **`printer-spooler-v1`** | PRINT.OFFLINE (R-05) | `Restart-Service Spooler -Force` | `(Get-Service Spooler).Status` | `restart-spooler.ps1` |
| **`audio-no-output-v1`** | AUDIO.MUTE (R-11) | `Restart-Service Audiosrv,AudioEndpointBuilder -Force` | `(Get-Service Audiosrv).Status` | `restart-audio.ps1` |
| **`vpn-connect-fail-v1`** | VPN.DROP (R-13) | `Restart-Service RasMan -Force` | `(Get-VpnConnection).Count` | `restart-rasman.ps1` |
| **`windows-update-stuck-v1`** | UPDATE.WINDOWS.STUCK | `Restart-Service wuauserv,bits,cryptsvc -Force` | `(Get-Service wuauserv).Status` | `restart-update-services.ps1` |

**Two faithful deviations from the run sheet, both safety-driven:**
- **Service-restart instead of `netsh`/`rasdial`.** The run sheet suggested `netsh wlan disconnect/connect` (R-03) and `rasdial <profile>` (R-13). Both would have required widening `isAllowedCommand`'s verb-prefix allowlist in `main.mjs` (new attack surface) and, for `rasdial`, handling a profile enum + credentials. Restarting `WlanSvc` / `RasMan` achieves the same reconnect outcome, is fully reversible, and reuses the already-allowed `Restart-Service` prefix — **zero allowlist widening to reach 8.**
- **The 8th recipe.** The run sheet listed 5 scripts to add but one of them (R-02 DNS) was already among the live 3, so "+5 listed" actually lands at 7. To honour the explicit `3 → 8` acceptance target I cleared `windows-update-stuck-v1` as the 5th net-new — it is the same class of pure reversible service restart and a genuinely common fix. (R-02's fuller `registerdns` + `Dnscache` steps were also added to the DNS recipe so R-02 is now complete, not just `flushdns`.)
- `printer-spooler-v1` was simplified from stop → **purge spool files** → start down to a single `Restart-Service Spooler -Force`. The old `clear-jobs` action deleted queued documents, which is *not* cleanly reversible when a recipe can auto-run; the single restart clears most stuck queues with nothing lost.

### 2 · BSOD Tier A — boot-menu recovery entry
- `scripts/install-bcd-entry.ps1` — runs once at install (elevated). Idempotently creates a `bcdedit /create /d "ARIA — Solve it for me" /application bootapp` entry, parses the returned `{guid}`, appends it to the display order (never default), and records it at `~/.aria-sentinel/bcd-id.json`.
- `scripts/remove-bcd-entry.ps1` — uninstaller hook. Reads the stored GUID, `bcdedit /delete {guid} /cleanup`, removes the record.
- **Safety:** these are the *only* sanctioned callers of `bcdedit`. `bcdedit` remains on the recipe-runner denylist, so a recipe can never reach the boot store — only the UAC-gated installer/uninstaller can.

### 3 · Health Score 0-100
- `src/shared/health-score.mjs` — pure, deterministic, clock-injected. Five weighted factors summing to 100: watcher heartbeats (25), recipe success 30d (30), ServiceNow queue (15), KB freshness (15), audit-log integrity (15). Missing inputs degrade gracefully to neutral-healthy (a fresh install never reads as broken). Exports `computeHealthScore`, `healthLabel`, `healthTooltip`.
- **Tray tooltip** — `main.mjs` recomputes every 60s (and on tray create + after each recipe run) and sets the tooltip, e.g. `ARIA Sentinel · Health 94/100 · 12 fixes this week`.
- **App state** — `getState()` now returns `healthScore` for the renderer/admin.
- **Admin Overview centerpiece** — a Health Score hero card (score ring + label + the 5 factor weights) added at the top of the admin console Overview.

---

## Tests
- **`tests/health-score.test.mjs`** (new) — weights sum to 100; perfect state = 100; fully broken = 0; empty state = 100 (no fresh-install penalty); each factor drops the score by exactly its weight when zeroed; timestamped-heartbeat array path; tooltip/label formatting; clamping under absurd inputs.
- **`tests/recipe-execution.test.mjs`** (extended) — asserts the 8-recipe cleared set; every cleared recipe has a real-executable action that the flag gates; a **red** (BSOD) *and* a **yellow** (`onedrive-sync-stuck-v1`) recipe stay blocked even with the flag on; all 8 verify probes exist, read-only, Restricted; six new `.ps1` mirrors match their recipe commands.
- **`tests/run-all.mjs`** — registers the new suite → **15 suites**.

```
Recipe-execution test passed (8 reversible greens cleared, 18 stay dry-run, denylist holds).
Health-score test passed (5 factors, weights sum 100, perfect=100, broken=0).
ARIA Sentinel test suite passed.   ← 15/15
```

---

## Acceptance ticks
- [x] `npm test` = **15/15** suites green
- [x] Live-execution coverage 3 → 8 (gated; red + yellow blocked even with the env flag)
- [x] Health Score surfaces on tray tooltip + admin Overview centerpiece
- [x] BSOD Tier A install/uninstall scripts shipped (denylist still blocks `bcdedit` from recipes)
- [x] `node --check` clean on every touched `.mjs`/`.js`
- [ ] **VM-only (manual):** right-click tray → Simulate a fix → executes for real in a Windows VM with `ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=1`
- [ ] **VM-only (manual):** installer creates the BCD entry; uninstaller removes it

> The two unchecked items need a real Windows VM with elevation + the system-fixes flag — outside this headless run. Code paths are in place and unit-gated.

---

## Remaining for next run (RUN 2)
- Yellow recipes with extra confirm (`OUTLOOK.CRASH`, `TEAMS.STUCK` deep, `ONEDRIVE.SYNC.STUCK`, `BLUETOOTH.OFF`)
- Tray **dynamic state** — 4 icon variants (idle/detection/fixing/escalation) wired to orchestrator state
- Chrome extension per-site disable (`chrome.storage.sync`) + auto-pause on focus loss
- New suites: `tray-state.test.mjs`, extended `extension.test.mjs`; target **17/17**

## Notes toward §0 destination
- Recipes executing for real: **8 / 20** target.
- `npm test` suites: **15 / 18** target.
- No new dependency, no external send, nothing published — all locked rules held.
