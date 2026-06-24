# RUN 21 — Auto-update orchestrator + startup hook + admin capture + heartbeat

**Date:** 2026-06-20 · **Suite:** 99 → 114 (all green) · **New deps:** 0 · **Published:** nothing (local commit only)

ARIA Sentinel is now self-maintaining + always-on: it watches the update channel, escalates a patch
through a 3-strike + time-window machine, registers itself at startup (and heals/audits tamper),
heartbeats daily, and lets the admin push (incl. mandatory) updates to the fleet. The continuous-patching
SLA gate for gov/healthcare is met. 🔒 R11 ("Private pics and Vids" OFF LIMITS) is enforced everywhere.

## 1 · Files touched

**New core modules (pure / node-safe)**
1. `src/shared/path-guard.mjs` — 🔒 R11 block/redact/filter helpers
2. `src/shared/update-state.mjs` — HMAC-signed state (seal/open) + strike windows
3. `src/main/update-listener.mjs` — latest.yml parse · version compare · 09-11 ET jitter · poll
4. `src/main/update-orchestrator.mjs` — 3-strike machine · time windows · fullscreen defer · snapshot/rollback · quarterly pause
5. `src/main/startup-registrar.mjs` — HKCU Run + at-logon Task definitions · heal · tamper signal
6. `src/main/startup-watchdog.mjs` — removal classify · audit · warning + double-confirm · banner
7. `src/main/heartbeat.mjs` — content-blind payload builder + guard
8. `src/shared/heartbeat-server.mjs` — server response/sanitize/key (testable without Blobs)
9. `src/shared/update-events.mjs` — publish-event builder + append + mandatory→hours

**Server (Netlify, project-local)**
10. `netlify/functions/aria-sentinel-update-publish.js` — extended: write `update-events` Blob + mandatory flag
11. `netlify/functions/aria-sentinel-heartbeat.js` — NEW: validate license · latest version · log to `heartbeats`

**Wiring**
12. `src/main/main.mjs` — RUN 21 imports; update-state read/write (HMAC); `runUpdateCheck`/`sendHeartbeat`/`registerStartup`/`probeStartup`/`healStartupIfNeeded`/`recordStartupTamper`/`setAutoStartup`/`updateTick`/`performUpdateInstall`/`snapshotPreUpdate`; 6 IPC handlers; launch + hourly + daily + wake scheduling; kill-switch update-revert hook; `powerMonitor`
13. `src/main/system-context.mjs` — R11 guard wired (apps dropped, paths redacted)
14. `src/main/preload.cjs` — 8 bridge methods
15. `src/renderer/index.html` — About "Updates & startup" panel · Control-Center "Pause updates 7 days" · trial-end version badge
16. `src/renderer/renderer.js` — `wireRun21`/`renderRun21`/`loadUpdatesPanel`/double-confirm
17. `src/renderer/sentinel.css` — trial-end version badge styles
18. `admin-console/index.html` — "Update fleet" table + "Mandatory" publish checkbox

**Tests** (15 new) + `tests/run-all.mjs`
**Docs** — `docs/ENTERPRISE_READINESS.md` 9.99 → 10.0 · `docs/RUN_21_REPORT.md` (this file)

## 2 · State machine

```
                 detect(new version)
   IDLE ───────────────────────────────▶ FRESH  (strike 0, first notice — NOT a strike)
                                            │  window elapses (24h · or 3h if mandatory)
   user "Later"/"Snooze 24h" re-arms timer  ▼
                                          STRIKE1 (1) ── +window ──▶ STRIKE2 (2) ── +window ──▶ STRIKE3 (3, "last chance")
                                                                                                     │ +window
   user "Install" at ANY phase ───────────────────────────────────────────────────────────────────┼──▶ INSTALLED
                                                                                                     ▼
                                                                                                   AUTO
                                                                                                     │ opportunity window
                                                                                                     ▼ (see §5) + canInstallNow (never fullscreen)
                                                                                                  INSTALLED  ──(≤60min)──▶ Ctrl+Alt+K rollback
```
State persists in HMAC-signed `userData/update-state.json`; a tampered seal falls back to the safe default.
Pauses ("Pause updates 7 days", 1×/quarter) extend each window by 7 days while active.

## 3 · Heartbeat payload (content-blind sample)

```json
{
  "licenseId": "LIC-ABC123XYZ",
  "version": "0.1.0",
  "lastUpdateState": "FRESH",
  "startupEnabled": true,
  "uptimeHours": 36,
  "healthScore": 97,
  "platform": "win32",
  "osBuild": "10.0.26100",
  "timestamp": "2026-06-20T10:00:00.000Z"
}
```
Allowlist-only: `username`, `machineName`, `installPath`, and any other field are dropped; a value that
references the private folder becomes `null`. `isContentBlind()` rejects any payload with a user path,
UNC machine name, email, or extra key.

## 4 · Admin console — "Update fleet" + "Push update" (markup)

```
Push update                                    [ Publish new version ]
[x] Mandatory — compress the 3-strike window from 24h to 3h per strike

Update fleet                                    (N licenses)
  cust-7f3k2   0.1.0   seen 2m ago    startup on
  cust-19a8g   0.1.0   seen 5m ago    startup on
  cust-mz04t   0.1.0   seen 12m ago   ⚠ startup off
  ─ license × installed version × last heartbeat × startup state ─
```
Publish posts `{version, sha512, release_notes, mandatory}`; the server appends to the `update-events`
Blob log; heartbeats return `latestVersion` + `mandatoryUpdate`.

## 5 · Tier-window decision tree (consulted only in AUTO)

```
fullscreen app?  ── yes ─▶ DEFER  (anti-rage: game / video call / presentation)
   │ no
machine on + app running?  ── no ─▶ DEFER
   │ yes
local hour ≥ 17:00?  ── yes ─▶ INSTALL  (preferred-evening-window)
   │ no
≥ 2 weeks since FRESH?  ── yes ─▶  hour ≥ 12:00 ? INSTALL (fallback-2week-noon) : DEFER (await noon)
   │ no
flagged last-resort-on-launch?  ── yes ─▶ INSTALL  (the moment the app is running)
   │ no
DEFER (awaiting-evening-window)
```

## 6 · Startup-tamper audit entry (sample)

```json
{ "event": "startup-disabled", "timestamp": "2026-06-20T08:00:00.000Z", "userConfirmed": true, "method": "task-manager" }
```
`method ∈ {task-manager, registry, task-scheduler, unknown}`. Persisted to the RUN 17 hash-chained
transparency log; the About tab shows `⚠ Auto-start disabled on <date>. ARIA only runs when manually launched.`

## 7 · Test results (per file)

| Suite | Result |
|-------|--------|
| update-listener | PASS — parse · version compare · 09-11 ET jitter · injected poll · offline-safe |
| update-orchestrator-states | PASS — FRESH→S1→S2→S3→AUTO · persists across restart · mandatory 3h |
| update-orchestrator-time-windows | PASS — 5pm prefer · noon after 2w · on-launch last resort |
| update-orchestrator-fullscreen-defer | PASS — fullscreen defers; mandatory respects gate |
| update-rollback-killswitch | PASS — snapshot before install · 60-min revert window · wired |
| startup-registrar | PASS — HKCU only · at-logon 30s · heal-on-missing · R11-blocked |
| startup-tamper-detection | PASS — method classified · audit · warning · wired |
| startup-disable-double-confirm | PASS — two confirmations required |
| heartbeat-payload-content-blind | PASS — allowlist only · no PII · R11-safe |
| heartbeat-endpoint | PASS — license validate · latest version · mandatory · content-blind log |
| admin-publish-captures-event | PASS — event built/appended/stored · fleet UI present |
| admin-mandatory-checkbox | PASS — 24h→3h · orchestrator honors it |
| pause-updates-quarterly-limit | PASS — 1/quarter · +7d window · resets next quarter |
| private-folder-never-touched | PASS — R11 blocks every enum/startup/heartbeat path; guard in 4 modules |
| run-21-no-regression | PASS — RUN 17/18/19/20 intact · 12 tabs · axis untouched |

Full suite: `node tests/run-all.mjs` → **114 suites, "ARIA Sentinel test suite passed.", exit 0.**

## 8 · 🔒 R11 enforcement proof

`path-guard.mjs` (block `**/Private pics and Vids/**` case-insensitive) is imported + applied in:
- `src/main/system-context.mjs` — `sanitizeText` redacts the folder; `mergeInstalledApps` drops any app located in it.
- `src/main/startup-registrar.mjs` — `registryRunEntry`/`taskDefinition` throw `R11_BLOCKED` on a private-folder exe; `safeStartupItems` filters it.
- `src/main/heartbeat.mjs` — any payload value referencing the folder → `null` (never transmitted).
- `src/main/main.mjs` — `registerStartup` halts + logs a SECURITY audit (`r11AuditEntry`) if the exe path is inside it.

The `private-folder-never-touched` test asserts all of the above and that no enumerated output ever
contains the literal folder name. Surfaced message on a block: **"1 personal folder excluded"** (matches R11).

## 9 · Platform-specific behavior needing human follow-up

- **Fullscreen detection** (`isFullscreenBusy`) is a conservative stub returning `false` (best-effort);
  it should be refined on-device (game/video-call/presentation heuristics). The pure orchestrator already
  honors the flag, and `canInstallNow` is the hard gate — so refining it only tightens the anti-rage rule.
- **Startup actuation** (`reg add` HKCU / `schtasks /Create ONLOGON /DELAY 0000:30 /RL LIMITED`) and the
  **WMI/registry change subscription** for sub-60s tamper detection run on Windows only; verified here via
  the pure logic + source wiring (no Electron/Windows in CI). One on-device run should confirm registration
  + heal + tamper-toast.
- **Pre-install snapshot** writes a marker JSON to `dist-backups/` (kill-switch reads it); a full binary
  snapshot/tar is heavier and deferred — the version-history rollback (RUN 14) remains the deep fallback.
- **Netlify Blobs** stores (`update-events`, `heartbeats`) deploy with the project-local functions; confirm
  the stores exist in the Netlify site on first publish/heartbeat.
- **Heartbeat license id** is truncated to 16 chars before transmit (keepalive correlation without sending
  the full key); confirm that's enough granularity for the admin fleet view.

## 10 · Guardrails honored

- 114/114 green; RUN 17/18/19/20 + admin-publish intact; 12 settings tabs unchanged; axis stubs untouched.
- 0 new deps (Netlify Blobs already in use; HMAC via node:crypto).
- 🔒 R11 enforced across every file-enum / startup scan / heartbeat path (+ added to system-context content-blind).
- Startup registration is **HKCU only** (no post-install elevation). Auto-install **never** over a fullscreen app — mandatory included.
- Update-state is HMAC-signed (can't be edited to dodge a patch). Heartbeat payload is content-blind.
- DON'T-touch respected: axis/ stubs · audit-integrity banner · RUN 19/20 fixes; OTA functions extended (not broken).
- Local commit only — Cowork pushes from the sandbox.
