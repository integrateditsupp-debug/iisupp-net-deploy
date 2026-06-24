# RUN 20 — System knowledge engine + cross-platform blueprint + safe-generic Tier-0 recipes

**Date:** 2026-06-20 · **Suite:** 86 → 99 (all green) · **New deps:** 0 · **Published:** nothing (local commit only)

The diagnostic moat. ARIA Sentinel now reads the machine (installed apps + hardware + services + event
log), cross-references a 105-cause symptom KB, ranks causes against the *live* system state, and guides
users on any platform via 10 OS blueprints — all LOCAL-ONLY, content-blind, and "first, do no harm".

## 1 · Files touched

**New core modules**
1. `src/main/system-context.mjs` — inventory enumerator (merge/dedupe/sanitize; injectable PowerShell runner)
2. `src/shared/symptom-kb.mjs` — symptom-file parser + loader
3. `src/shared/diagnostic-reasoner.mjs` — fuzzy match · context-aware ranking · anomaly surfacing · no-harm gate · escalation draft
4. `src/main/recipes/tier-0/catalog.mjs` — 14 Tier-0 descriptors + allowlist + deny list
5. `src/main/recipes/tier-0/index.mjs` — validate · dry-run preview · audit shape
6. `src/main/recipes/tier-0/*.recipe.mjs` — 14 individual recipe files

**New knowledge pack**
7. `aria-kb-pack/diagnostics/` — `symptoms.md` index + 17 symptom files (105 causes)
8. `aria-kb-pack/blueprints/` — 10 cross-platform blueprint files

**Wiring**
9. `src/main/main.mjs` — KB/inventory/tier-0/reasoner imports; `collectSystemContext`/`getSystemContext`; `listBlueprints`/`getBlueprint`; `listTier0Recipes`; `runDiagnose`; 7 IPC handlers; launch + 6h refresh
10. `src/main/preload.cjs` — 7 bridge methods (getSystemContext, refreshSystemContext, listTier0, previewTier0, listBlueprints, getBlueprint, diagnose)
11. `src/renderer/index.html` — System Context + Cross-Platform tabs/panels, Recipes "Safe Generic" section, Control-Center "Diagnose issue" button
12. `src/renderer/renderer.js` — TAB_TITLES + tab loaders + `wireRun20` (system context render/search, blueprints, tier-0 list, diagnose)
13. `package.json` — `aria-kb-pack/**` added to the customer build allow-list

**Tests** (13 new) + 3 count/order updates
14. `tests/run-all.mjs` (registers 13) · `ia-tabs` + `run18-enterprise-wiring` updated 10 → 12 tabs
15-27. the 13 new suites (listed in §7)

**Docs**
28. `docs/ENTERPRISE_READINESS.md` 9.97 → 9.99 · 29. `docs/RUN_20_REPORT.md` (this file)

## 2 · system-context.json sample (sanitized structure, not real data)

```json
{
  "generatedAt": "2026-06-20T00:00:00.000Z",
  "schema": 1,
  "contentBlind": true,
  "appCount": 142,
  "apps": [
    { "name": "Google Chrome", "version": "120.0", "publisher": "Google LLC",
      "installDate": "20240101", "installSize": 250000,
      "installLocation": "C:\\Program Files\\Chrome", "uninstallString": "<...>", "source": "registry+get-package" }
  ],
  "cpu": { "model": "Intel Core i7", "cores": 8, "logical": 16, "load": 22 },
  "ram": { "total": 16777216, "free": 6553600, "percentUsed": 61 },
  "gpu": { "Name": "NVIDIA RTX", "DriverVersion": "551.x", "AdapterRAM": 8589934592 },
  "disks": [ { "Model": "Samsung SSD", "Size": 512110190592, "Status": "OK" } ],
  "os": { "edition": "Windows 11 Pro", "build": "26100" },
  "services": [ { "Name": "Spooler", "Status": "Running", "StartType": "Automatic" } ],
  "eventLog": { "errorsBySubsystem": { "disk": 3 }, "critical24h": 0, "error24h": 5,
    "entries": [ { "level": "Error", "source": "Disk", "id": 7, "message": "fault for C:\\Users\\<user>" } ] }
}
```
PII is stripped at build time: app names with an email/user-path → `<redacted app>`; event-log paths →
`C:\Users\<user>`; machine names → `\\<machine>`; emails → `<email>`.

## 3 · Symptom KB (17 categories × cause counts)

| Category | Causes | | Category | Causes |
|----------|:--:|---|----------|:--:|
| slow-performance | 6 | | battery-power | 6 |
| app-crashes | 7 | | file-explorer | 6 |
| system-crashes | 7 | | email-issues | 7 |
| no-internet | 6 | | bluetooth-wifi | 6 |
| audio-issues | 6 | | usb-peripheral | 6 |
| display-issues | 6 | | antivirus-conflict | 6 |
| printer-issues | 6 | | credential-issues | 6 |
| update-stuck | 6 | | license-activation | 6 |
| boot-issues | 6 | | **TOTAL** | **105** |

Every cause carries Probability / Detection / Safe-diagnostic / Safe-fix / Escalation (parser-verified).

## 4 · Blueprints (10 platforms × 8 sections)

All 10 complete (Architecture · Settings access · Common pain points · Voice-guidable steps · Hardware
diagnostic commands · Network reset · Safe-mode equivalent · Backup/restore): **windows-11, windows-10,
macos-15-sequoia, macos-14-sonoma, ios-18, ipados-18, android-15, linux-ubuntu-debian, linux-fedora-rhel,
chromeos** — 10/10 × 8/8 ✓. (Packet said "7 required sections"; it listed 8 — all 8 are required + present.)

## 5 · Tier-0 recipes (14 × dry-run/audit verified)

| Recipe | Read-only | Verified |
|--------|:--:|:--:|
| clear-user-temp (scoped to %TEMP%) | no | dry-run ✓ audit ✓ |
| flush-dns · reset-network-stack | no | dry-run ✓ audit ✓ |
| restart-print-spooler · restart-audio-service · restart-windows-search | no | dry-run ✓ audit ✓ |
| clear-browser-cache-prompt (opens UI only) | yes | dry-run ✓ audit ✓ |
| check-disk-smart · check-system-files · view-recent-errors | yes | dry-run ✓ audit ✓ |
| list-startup-impact · check-windows-update-state · check-driver-issues | yes | dry-run ✓ audit ✓ |
| run-native-troubleshooter | no | dry-run ✓ audit ✓ |

All 14: dry-run default · allowlisted commands · content-blind preview · audit entry (recipeId + dryRun +
outputHash) · `requiresConfirm` · never delete user data / touch system files / disable security.

## 6 · Diagnostic reasoner — 20 phrasings → top-3 (all matched; 20/20 top-1)

| User phrasing | Top match | | User phrasing | Top match |
|---------------|-----------|---|---------------|-----------|
| "my computer is so slow" | slow-performance | | "windows not activated" | license-activation |
| "everything takes forever" | slow-performance | | "computer won't start" | boot-issues |
| "app keeps crashing" | app-crashes | | "battery drains fast" | battery-power |
| "program won't open" | app-crashes | | "file explorer won't open" | file-explorer |
| "blue screen" | system-crashes | | "outlook won't open" | email-issues |
| "computer keeps restarting" | system-crashes | | "wifi keeps dropping" | bluetooth-wifi |
| "no internet" / "can't get online" | no-internet | | "no sound" / "i can't hear anything" | audio-issues |
| "black screen" / "second monitor not detected" | display-issues | | "printer won't print" | printer-issues |
| "update stuck" | update-stuck | | | |

Plus: live-context re-ranking (RAM 95% → high-RAM cause #1), anomaly surfacing (unrelated GPU error spike),
and a content-blind ServiceNow escalation draft after 3 failed safe attempts.

## 7 · Test results (per file)

| Suite | Result |
|-------|--------|
| system-context-enum | PASS — 3 sources merged/deduped, all required fields, full shape |
| system-context-refresh | PASS — <3s (injected), email/username/machine stripped |
| symptom-kb-parse | PASS — 17 files, 105 causes, all well-formed, index complete |
| blueprint-coverage | PASS — 10 platforms × 8 sections |
| tier-0-recipes-dryrun | PASS — 14 files, dry-run/allowlisted/audited/content-blind |
| diagnostic-reasoner-fuzzy | PASS — 20/20 top-3, 20/20 top-1 |
| diagnostic-reasoner-system-aware | PASS — live context re-ranks; healthy context = no boost |
| no-harm-gate | PASS — auto-run only read-only/dry-run tier-0; deletes scoped to %TEMP% |
| anomaly-surfacing | PASS — unrelated subsystem flagged; related/low ignored |
| cross-platform-no-control | PASS — md-only; no remote exec; getBlueprint reads only |
| event-log-sanitize | PASS — usernames/machines/emails stripped, structure kept |
| registry-read-only | PASS — HKLM/HKCU enumeration only, zero writes |
| escalation-path | PASS — 3 fails → content-blind SN draft; <3 → none |

Full suite: `node tests/run-all.mjs` → **99 suites, "ARIA Sentinel test suite passed.", exit 0.**

## 8 · Readiness

`docs/ENTERPRISE_READINESS.md` bumped **9.97 → 9.99**.

## 9 · Platform-specific behavior needing human follow-up

- **Live PowerShell collectors** (`PS_COMMANDS` in main.mjs) are real read-only commands but were
  verified here only via the injected fast-path in tests (no Electron/PS in CI). Needs one on-device run
  to confirm the hardware/event-log JSON shapes populate the System Context tab as expected; collectors
  fail-safe to empty arrays so a shape mismatch degrades gracefully rather than crashing.
- **`Get-Package`** can be slow on some machines (PackageManagement provider init); it runs in parallel
  with a 12s timeout and falls back to registry + Appx if it stalls.
- **Tier-0 execution** is wired as dry-run preview only this run; turning on *actual* execution stays
  gated behind the existing `ARIA_SENTINEL_ALLOW_SYSTEM_FIXES` + signing + per-action confirm (unchanged).
- **Blueprints** are static knowledge as of the named OS versions; schedule a refresh when a new major
  OS ships (e.g., iOS 19 / macOS 16).
- **KB in the customer build:** `aria-kb-pack/**` was added to `build.files`; confirm it lands in the
  packaged app on the next `npm run package:win`.

## 10 · Guardrails honored

- 99/99 green; RUN 17 banner + RUN 18 wiring + RUN 19 polish + admin-publish intact.
- 0 new deps (Node + Electron + PowerShell + built-in Windows APIs only).
- LOCAL ONLY: inventory + diagnostics never leave the device; sanitization strips usernames/machines/
  emails/PII paths everywhere.
- Tier-0 never deletes user files, modifies system files, disables security, installs software, or writes
  the registry; registry access is HKLM/HKCU enumeration only.
- ARIA never auto-fixes: every action asks. Blueprints are KNOWLEDGE ONLY — no remote control of phones.
- Untouched: audit-integrity banner · `axis/` stubs · OTA functions · RUN 19 fixes.
- Local commit only — Cowork pushes from the sandbox.
