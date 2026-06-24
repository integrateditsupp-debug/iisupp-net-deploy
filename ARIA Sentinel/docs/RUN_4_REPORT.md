# RUN 4 Report — macOS port

**Date:** 2026-06-19 · **Suite:** 20/20 green · **`node --check`:** clean on every touched file · **Dependencies added:** 0 · **Windows path:** 100% unchanged · **Published:** nothing

---

## Built

### 1 · macOS native detection watchers (`src/sub-agents/detection/macos/`)
Five content-blind watchers mirroring the Windows set, each with a pure exported mapper (unit-testable on any OS) and a `tick()` that shells out only on macOS:

| Watcher | Source command | Emits | Content-blind reduction |
|---|---|---|---|
| `disk-watcher.mjs` | `df -h /` | `DISK.LOW_SPACE` (≥95% capacity) | only the Capacity % is parsed; device + mount path dropped |
| `event-log-watcher.mjs` | `log show --last 60s --predicate 'subsystem == "com.apple.system"' --style ndjson --info` | `SYSTEM.UNEXPECTED_SHUTDOWN` · `SYSTEM.KERNEL_PANIC` · `DISK.FS_CORRUPT` · `NET.ADAPTER.DOWN` | keys ONLY on a fixed subsystem→code map; `eventMessage` never read |
| `crash-watcher.mjs` | glob `~/Library/Logs/DiagnosticReports/*.{crash,ips,panic}` | `APP.CRASH.REPORTED` · `SYSTEM.KERNEL_PANIC` | **counts files only** — filenames (which embed app + user) never read; reports never opened |
| `perf-watcher.mjs` | `top -l 1 -n 0` | `SYSTEM.SLOW.HIGH_CPU` · `SYSTEM.SLOW.HIGH_RAM` | parses two numbers (CPU = 100−idle, mem ratio); **reuses the Windows `evaluatePerf`** so sustain/re-arm thresholds match exactly |
| `network-watcher.mjs` | `scutil --dns` + `ping -c1 -t2` | `NET.ADAPTER.DOWN` · `NET.DNS.FAIL` | reduced to two booleans (has-resolvers, ping-ok); resolver IPs never surface |

- `macos/sh.mjs` — the darwin twin of `ps.mjs`: a read-only spawn helper that **hard-guards `process.platform !== "darwin"` → returns null and spawns nothing**, with timeout + 1 MB output cap. So a Windows build can never invoke `df`/`top`/`log`/`scutil`/`ping`.

### 2 · Orchestrator platform selection (`detection/index.mjs`)
`WINDOWS_WATCHER_FACTORIES` (7) and `MACOS_WATCHER_FACTORIES` (5) are exported; the live set is chosen **once** by `process.platform === "darwin"`. On Windows the set is the original 7 — unchanged.

### 3 · Permissions UX
`openMacPermissions(pane)` opens the exact System Settings pane via deep links — Full Disk Access (`…?Privacy_AllFiles`) and Accessibility (`…?Privacy_Accessibility`). Surfaced as **darwin-only tray items** ("Grant Full Disk Access…", "Grant Accessibility…") + an IPC (`sentinel:open-mac-permissions`). No-op on non-macOS.

### 4 · macOS tray + globe overlay
- Tray uses Electron's cross-platform `Tray` with the existing nativeImage globe (verified API-compatible; documented for on-Mac visual check).
- Overlay window gains `vibrancy: 'hud'` + `visualEffectState: 'active'` + transparent `backgroundColor` **guarded on darwin**, fixing the macOS transparent-window black-render quirk so the floating globe blurs correctly.

### 5 · Ad-hoc code-signing
`package.json` build gains a `mac` block with `identity: null` (ad-hoc sign, no Developer ID yet) + `package:mac` script. Installer warning copy already covers the unsigned/first-run case.

### Bonus (RUN 3 follow-up)
The `aria-recipe-feedback` outbound contract now specifies **`ts` MUST be ISO-8601, not epoch-ms** — a 13-digit epoch number trips the payment-card-length rule in `assertContentSafePayload`. (No live payload built this in `src/`; the fix pins the documented contract so a future implementer avoids the false positive.)

---

## Tests (19 → 20 suites)
- **`tests/macos-watchers.test.mjs`** (new) — 500 fuzzed inputs across the 5 mac mappers stuffed with emails / SSNs / POSIX paths / `.local` hostnames / bundle IDs: **0 canary leaks**, every signal well-formed, every hint enum-kebab. Plus deterministic mapping checks, `parseTop` math (CPU = 100−idle; mem ratio), the sustained-load fire, and factory shapes (**5 macOS / 7 Windows**, a blocked tick emits nothing and shells out nothing on this non-darwin host).
- All 19 prior suites unchanged — `watchers.test.mjs` still asserts **7** Windows watchers / 700 inputs.

```
Watchers content-blind test passed (700 fuzzed inputs across 7 watchers, 0 leaks).
macOS watchers content-blind test passed (500 fuzzed inputs across 5 watchers, 0 leaks, 5 factories).
ARIA Sentinel test suite passed.   ← 20/20
```

---

## Acceptance ticks
- [x] `npm test` = **20/20** green
- [x] Windows path 100% unchanged (7 watchers, all prior suites identical)
- [x] All macOS branches guarded by `process.platform` — no Mac command reachable from Windows
- [ ] **Mac-hardware (manual):** `npm start` on macOS, globe renders on retina + multi-monitor, permission deep-links open the right pane — code complete, pending a Mac to verify on
- [x] `node --check` clean on every touched file

---

## Remaining for next run (RUN 5 — Edge + Safari extensions + Chrome polish)
- `edge-extension/` (copy chrome-extension + MV3 manifest tweaks)
- `safari-extension/` folder (manifest + Resources) bundled in the macOS app
- Chrome popup polish (status badge · per-site toggle · "what ARIA did here today" counter)
- Extend `extension.test.mjs` to validate all 3 manifests → target **21/21**

## Notes toward §0 destination
- macOS port checked (code complete; on-Mac verification is the only open item).
- `npm test` suites: **20**.
- Locked rules held: zero new deps, denylist intact, no external send, 7-tab/13-tab UI untouched, every darwin branch `process.platform`-guarded, nothing published.
