# ARIA SENTINEL — COMPLETE A-Z PACKAGE FOR CODEX

> ONE FILE. Everything Codex needs. Paste this into a fresh Codex session.
> Codex owns sprints 0 through 6 end-to-end. Cowork ships handoff support only.

**Owner:** Ahmad Wasee · Integrated IT Support Inc.
**Repo:** github.com/integrateditsupp-debug/iisupp-net-deploy
**Working tree:** `C:\Users\Ahmad Wasee\Documents\GitHub\ARIA — Real-Time AI Assistant\iisupp-net-deploy`
**Version:** 1.0 · 2026-06-19

This document is self-contained. It includes:
- The full build specification (sections §0 through §Y)
- All 10 standing rules
- The complete design brief
- The handoff protocol
- The Sprint 0-6 plan
- The launch-blocker list
- The PR/CI gates
- Exactly what Ahmad must do (only those things)
- Start-here instructions

If anything inside this file appears to conflict with a file in the repo, the file in the repo wins (it's source of truth — this is a snapshot of the same content for offline reading).

---

# PART 1 · YOUR MANDATE (read first, 90 seconds)

You are building **ARIA Sentinel** — a Windows-first desktop + browser-extension ambient AI tech-support agent for Integrated IT Support Inc. It lives on the user's machine, watches for errors (BSOD, crashes, browser failures, login loops, slow PC), and either fixes them automatically (Autonomous mode), proposes a fix (Confirmed mode), or walks the user through it via chat (Manual mode — DEFAULT at install).

You own this product end-to-end. Sprints 0 through 6. Backend extensions + Electron desktop app + browser extensions (Chrome → Edge → Safari) + macOS port + polish.

**Cowork has shipped:**
- The spec at `docs/ARIA-SENTINEL-CODEX-SPEC.md` (also fully inlined below in §PART 3)
- The design package at `outputs/aria-sentinel-design-handoff/` (6 SVG mockups + 440-line brief, inlined below in §PART 4)
- Sprint 0 scaffolding already in main: `aria-recipes.mjs`, `aria-stop-codes.mjs`, `_pii-redact.js`, `aria-pattern-router.mjs`
- All 10 standing rules at `senior-director-state/STANDING-RULES-FOR-ALL-AGENTS.md` (inlined below in §PART 2)

**Your output:** Working code, committed to main via PRs. v1.0 production ship in 3-4 elapsed weeks (~31-39 focused AI hours across 7 sprints).

---

# PART 2 · STANDING RULES (10 — these bind everything you do)

Rule 1 — **Spend cap $20-70 CAD/mo.** No new operational spend above current baseline without Ahmad's explicit ask. Baseline allowed: Netlify, M365, Stripe, Anthropic API, DigitalOcean.

Rule 2 — **Smart qualifier.** When something doesn't fit, run the 4-step workaround tree (sub-prime, scope-down, cert-on-award, value-justifies-spend) before skipping.

Rule 3 — **Ship now, no tomorrow.** Never defer. Recurring work uses scheduled tasks so loops continue offline.

Rule 4 — **Revenue-first ordering.** Rank work by (revenue × probability × speed). Revenue-generating tasks before busy work.

Rule 5 — **Resume-honest claims.** 15+ years IT experience for Ahmad. NEVER 21+. Real certs only. No fabrication.

Rule 6 — **Visual stability on iisupp.net.** Don't change look/theme/copy on production iisupp.net pages without preview-before-push approval. Sentinel app UI is new ground — design package governs there.

Rule 7 — **No fake proof.** No fake testimonials, fake partnerships, fake search volume, copied products, spam. **No money-back / guarantee / risk-free language anywhere on iisupp.net or in Sentinel UI.** No mention of Raymond James anywhere — hard rule.

Rule 8 — **Aperture + ARIA never break.** After every deploy touching `aria.html`, `assets/aria-core.js`, `assets/aria-trial.js`: verify ARIA still loads, paywall fires, trial bar counts, voice-mode works. Hotfix immediately if anything regresses.

Rule 9 — **Every detail perfect, limit the count.** Each customer-facing surface must be perfect (clear in 5s, CEO-grade copy, mobile + desktop intentional, tag balance verified, trust signals consistent). Limit the NUMBER of surfaces. Fewer, higher polish. Backend/crons/functions are exempt — they compound invisibly. Pruning is a first-class action.

Rule 10 — **Shortest path first.** Before any task, pick the SHORTEST code path that delivers the actual outcome. Bake non-secret config in code over env vars (Stripe price IDs, public endpoints, public keys). One commit beats a setup script. Don't ask Ahmad to run scripts when a code edit ships the same outcome. Real secrets (Stripe SECRET, Anthropic key, admin passwords) stay env vars.

---

# PART 3 · BUILD SPECIFICATION (§0 through §Y inline)

# ARIA Sentinel — Master Codex Build Specification

> Single source of truth for building ARIA Sentinel (working name: ARIA Desktop).
> Hand this entire file to Codex. It executes from here.

**Owner:** Ahmad Wasee · Integrated IT Support Inc. (`iisupp.net`)
**Spec version:** 1.0 · 2026-06-19
**Repo:** `github.com/integrateditsupp-debug/iisupp-net-deploy`
**Working tree to extend:** `C:\Users\Ahmad Wasee\Documents\GitHub\ARIA — Real-Time AI Assistant\iisupp-net-deploy`
**Design package:** `outputs/aria-sentinel-design-handoff/` (6 SVG mockups + 440-line master brief + Claude Design prompt)

---

## §0 · THE TWO RULES THAT DEFINE THIS PRODUCT

These rules sit above every other section. Codex must enforce them in code, not in comments. If a design choice anywhere in this spec appears to conflict with §0, §0 wins.

### Rule 1 — Full remediation power

ARIA Sentinel fixes endpoint issues end-to-end. This is the product. Do not weaken capability for the sake of compliance. The compliance lives in HOW it reads (Rule 2), not in what it can fix. Sentinel's autonomous action allow-list is broad enough to actually resolve real-world IT incidents — service restarts, DNS flush, adapter reset, cache/temp purge, registry-safe service tweaks, OneDrive/Teams resets, driver state recovery, BSOD-on-resume recipe application, Windows Update reset, print spooler restart, OST repair, etc. — within deny-by-default + snapshot-before-change + rollback-on-failure guards.

### Rule 2 — Content-blind, ephemeral, local-first reading

ARIA Sentinel reads on the endpoint to detect faults but:

- **Reads in memory ONLY.** No screen, browser, document, email, or input content is ever persisted to disk, log, blob, queue, or telemetry.
- **Captures error SIGNAL not surrounding content.** Event log error rows, crash signatures, browser console error events, network failure codes, app exit codes, perf-counter thresholds — yes. Page bodies, document text, field values, keystrokes — never.
- **Outbound sanitization boundary.** Before ANY HTTP call to `iisupp.net`, raw signals are reduced to symbolic codes via `sanitizeToSignature()` (see §G). All URLs collapse to domain category, file paths collapse to file class, identifiers are stripped, error strings are pattern-matched to a code from `aria-symbolic-state-dictionary`. Egress carries only `{ code, family, confidence, os_version }` — never user content.
- **Ephemerality is provable.** In-memory buffers zeroed after use. Sanitizer is a pure function with no I/O. Content-leak test (§O) is a release gate — CI blocks any PR where a content string can reach disk, log, or network.
- **Pull-only network model.** Sentinel calls `GET /aria-recipes`, `GET /aria-stop-codes`, `GET /aria-kb-bundle` to pull updates. The only POST it makes is `POST /aria-recipe-feedback` and it carries `{ recipe_id, outcome, ts }` — no signals, no content.

### How §0 maps to the existing iisupp.net stack

The web ARIA at `iisupp.net/aria` was NOT built under §0. It accepts user text directly. Sentinel is a different surface and must NOT call `aria-chat.js` or any function that takes raw user text. Sentinel uses the new endpoints in §B-4 which return read-only data. Codex: any time you find yourself wanting to forward error text to `aria-chat`, stop. That violates §0.

---

## §A · WHAT'S BEING REUSED vs. WHAT'S NEW

### Reused from existing iisupp.net (concrete file references)

| Existing asset | Path | Role in Sentinel |
|---|---|---|
| ARIA persona + tone rules | `assets/aria-core.js` | Voice/style for all Sentinel UI copy |
| ARIA brand tokens | `assets/aria-core.css` + homepage CSS | Gold/black palette, Cinzel + Inter typography |
| Knowledge base seed | `assets/aria-knowledge-base.js` + `assets/aria-kb-local-bundle-v3.*.json` | Bundle locally with installer; refresh from `/aria-recipes` |
| KB chunks | `assets/aria-kb-chunks.json` (~700KB) | Local cache for offline recipe lookup |
| Pattern-first router | `netlify/functions/aria-pattern-router.mjs` (AROC §4 symbolic codes) | Map symbolic code → recipe ID. Sentinel ships the same code list locally. |
| PII redactor | `netlify/functions/_pii-redact.js` | Used inside `sanitizeToSignature()` as defense-in-depth — strips email/SIN/SSN/card/phone from any string before egress |
| Recipe registry | `netlify/functions/aria-recipes.mjs` (already seeded with `SENTINEL_RECIPES`) | Recipe pull endpoint Sentinel calls daily |
| Windows stop-code map | `netlify/functions/aria-stop-codes.mjs` | BSOD lookup — Sentinel ships this list locally; refreshed via pull |
| Symbolic state dictionary | embedded in `aria-pattern-router.mjs` `DOMAINS` + state encoder | Sentinel uses the same DOMAIN.CHAIN encoding (`DISK.FULL`, `NET.DNS.FAIL`, `BSOD.CRITICAL_PROCESS_DIED`) |
| Self-learning logger | `netlify/functions/aria-learning-loop.mjs` | Aggregates anonymous fix feedback (opt-in only — see §G) |
| Ticket format | existing `IIS-YYMMDD-####` numbering | Internal ticket number paired with ServiceNow ticket |
| Circuit breaker | `netlify/functions/aria-circuit-breaker.mjs` (or `_circuit-breaker.mjs`) | Same pattern in Sentinel agent for upstream calls |
| Tenant isolation | `netlify/functions/aria-tenant-isolation-test.js` | Pattern for per-customer scoping in MDM/IT-managed deploys |
| Cron heartbeat helper | `netlify/functions/_heartbeat.mjs` | Pattern for Sentinel's daily recipe-pull cron |
| Existing tier/plans | `netlify/functions/stripe-checkout.js` + `assets/iis-catalog.js` | Sentinel is a NEW separate tier — add `sentinel_personal_m/y`, `sentinel_business_y` to PRICE_MAP, do NOT bundle with existing ARIA Personal/Pro/SMB |
| Design system | `outputs/aria-sentinel-design-handoff/` (6 SVG mockups + master brief) | Designer's Figma must extend; build references the SVGs directly until Figma ships |

### New components (built by Codex under this spec)

| New component | Location |
|---|---|
| Electron desktop app | `apps/sentinel-desktop/` (new top-level folder, monorepo addition) |
| Globe UI | `apps/sentinel-desktop/src/ui/globe/` (Three.js + transparent Electron window) |
| Watchers (detection layer) | `apps/sentinel-desktop/src/watchers/` |
| Fix runner | `apps/sentinel-desktop/src/runner/` |
| Sanitization boundary | `apps/sentinel-desktop/src/safety/sanitize.ts` (with `tests/sanitize.leak.test.ts` content-leak gate) |
| Sub-agent orchestrator | `apps/sentinel-desktop/src/orchestrator/` |
| Tray icon + settings | `apps/sentinel-desktop/src/tray/` |
| BSOD/WinRE module | `apps/sentinel-desktop/src/bsod/` (BCD entry, minidump reader, recovery binary) |
| Chrome extension | `apps/sentinel-extension-chromium/` (works for Chrome + Edge) |
| Safari extension | `apps/sentinel-extension-safari/` (bundled inside macOS app Sprint 2) |
| Backend extensions | `netlify/functions/aria-recipes.mjs` (extend), `aria-stop-codes.mjs` (extend), `aria-recipe-feedback.js` (new, opt-in only) |
| Content-leak test suite | `tests/sentinel/content-leak.spec.ts` (CI release gate) |
| Policy injection test suite | `tests/sentinel/policy-injection.spec.ts` (CI release gate) |
| Sanitizer property tests | `tests/sentinel/sanitize.property.spec.ts` |
| Recipe registry data | `apps/sentinel-desktop/src/recipes/registry.ts` (mirrors `aria-recipes.mjs`) |
| Snapshot/rollback | `apps/sentinel-desktop/src/safety/snapshot.ts` |
| Audit log | `apps/sentinel-desktop/src/audit/log.ts` (tamper-evident, content-free, hash-chained) |
| ServiceNow connector | `apps/sentinel-desktop/src/ticketing/servicenow.ts` |
| Internal IIS ticket connector | `apps/sentinel-desktop/src/ticketing/iis.ts` (existing IIS-YYMMDD-#### sequence) |
| Privacy verifier UI | `apps/sentinel-desktop/src/ui/privacy-verifier/` |
| Code-signing CI workflow | `.github/workflows/sign-and-release.yml` (after Ahmad buys certs) |

---

## §B · ARCHITECTURE

### B-1 · Five layers

```
+--------------------------------------------------------------+
|  L5 · OPERATOR / IT ADMIN CONSOLE  (web, future)             |
|  Customer-side dashboard: deploy MSI, view audit, set policy |
+--------------------------------------------------------------+
|  L4 · BRAND / UX LAYER                                       |
|  Globe UI, fix card, tray, settings, BSOD recovery screen    |
|  Driven by approved design (outputs/aria-sentinel-design-…)  |
+--------------------------------------------------------------+
|  L3 · CONTROL PLANE (iisupp.net, PULL-ONLY for end users)    |
|  GET /aria-recipes        — signed, versioned recipes        |
|  GET /aria-stop-codes     — Windows BSOD code → recipe map   |
|  GET /aria-kb-bundle      — full local cache bundle (signed) |
|  POST /aria-recipe-feedback (OPT-IN ONLY, signature only)    |
|  POST /aria-binary-update — staged auto-update channel       |
|  ⚠ NO endpoint accepts raw error text, screen content,       |
|     URLs, file paths, or user content. Compile-time gate.    |
+--------------------------------------------------------------+
|  L2 · BROWSER EXTENSIONS (Manifest V3)                       |
|  Chrome → Edge → Safari (bundled in macOS app Sprint 2)      |
|  Detect: webRequest errors, console errors via debugger,     |
|   form-submit retries, service-worker hang, cookie issues    |
|  Fix: chrome.browsingData per-origin only                    |
|  Localhost mTLS WebSocket → desktop agent for OS-level fixes |
+--------------------------------------------------------------+
|  L1 · DESKTOP AGENT (Electron, Windows-first → macOS Sprint 2)|
|  Sub-agents: orchestrator + detection + diagnosis +          |
|   remediation + health + communication + ticketing           |
|  All read in-memory only. Sanitization boundary before       |
|   any upward call to L3.                                     |
+--------------------------------------------------------------+
```

### B-2 · Sub-agent topology (the "ARIA with workers" model)

The desktop agent is a single Electron process hosting **one orchestrator + six specialist sub-agents**. Sub-agents run in isolated workers, communicate via a typed message bus, and cannot exceed their declared capability scope. Mediated, just-in-time privilege escalation; logged.

```
                  ┌──────────────────────────────────┐
                  │     ORCHESTRATOR sub-agent       │
                  │  · owns conversation             │
                  │  · enforces §0 + safety gates    │
                  │  · mediates privilege            │
                  │  · assembles ticket + report     │
                  └────────────────┬─────────────────┘
       ┌────────────────┬──────────┼──────────┬────────────────┬─────────────────┐
       ▼                ▼          ▼          ▼                ▼                 ▼
┌────────────┐  ┌────────────┐ ┌─────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐
│ DETECTION  │  │ DIAGNOSIS  │ │REMEDIAT.│ │   HEALTH    │ │COMMUNICATION│ │ TICKETING  │
│ /telemetry │  │  matcher   │ │ runner  │ │  /mainten.  │ │  globe+chat │ │ SNow + IIS │
│ Event Log, │  │ symbolic   │ │PowerShel│ │ proactive   │ │ proactive   │ │ create     │
│ WMI, perf, │  │ + KB +     │ │snapshot │ │ disk space, │ │ announce,   │ │ update,    │
│ WER, etc.  │  │ optional   │ │+ verify │ │ startup,    │ │ save prompt │ │ resolve    │
│            │  │ Claude     │ │+ rollback│ │ pending upd │ │ reboot ack  │ │ tickets    │
└────────────┘  └────────────┘ └─────────┘ └─────────────┘ └─────────────┘ └────────────┘
```

Each sub-agent is a `.ts` module exporting a single class with:
- `name`, `version`, `capabilities[]` (declared scope)
- `start()`, `stop()`, `healthcheck()`
- typed input/output via the bus

### B-3 · Modes

| Mode | Default? | Behavior |
|---|---|---|
| **Manual** | ✅ DEFAULT AT INSTALL (per Ahmad's directive — locks) | Globe present, watches for issues. On detection: shows `[I see a printer issue. Open chat for steps?]` prompt. No fix applied without explicit chat-walkthrough confirmation. Free tier eligibility. |
| **Confirmed** | (paid) | Detect → fix card slides up → buttons `[Fix it now]` `[Tell me more]` `[Not now]`. Fix runs on confirm. Default for paid tier. |
| **Autonomous** | (paid, opt-in setting) | Low-risk recipes (`risk: green`) auto-apply; medium/high (`risk: yellow|red`) still confirm. Post-fix card shown. |
| **Pause** | always available | Tray menu: pause 1h / 24h / until reboot. Hotkey configurable. **DOES NOT pause BSOD takeover** — that's safety, not convenience. |

Mode is stored in `~/.aria-sentinel/config.json` and is gettable/settable via tray menu + settings window. Mode changes are logged to the audit log.

### B-4 · Backend endpoints (extend existing iisupp.net Netlify Functions)

| Endpoint | Method | Already exists? | Purpose | Egress payload from Sentinel |
|---|---|---|---|---|
| `/.netlify/functions/aria-recipes` | GET | ✅ exists (seeded with SENTINEL_RECIPES) | Returns versioned recipe list. Bundle hash + signature. | `?v=<currentVersionHash>` only |
| `/.netlify/functions/aria-stop-codes` | GET | ✅ exists | Windows BSOD code → fix index | `?v=<currentVersionHash>` only |
| `/.netlify/functions/aria-kb-bundle` | GET | needs new | Full local-cache bundle ZIP, signed | `?v=<currentVersionHash>` only |
| `/.netlify/functions/aria-recipe-feedback` | POST | needs new | OPT-IN anonymous fix outcome | `{ recipe_id, outcome:'ok'|'rolled_back'|'escalated', ts }` — NO signal, NO content, NO machine ID |
| `/.netlify/functions/aria-binary-update` | GET | needs new | Auto-update channel manifest | `?platform=win|mac&channel=stable|beta&v=<current>` |

All endpoints **MUST reject** payloads containing fields outside their schema. The function `validatePayload(req, schema)` (already a pattern in iisupp functions) is the gate. Codex: add a CI test that POSTs PII into each endpoint and asserts 400.

---

## §C · DETECTION & TRIGGER ENGINE (Windows-first)

Each detector is a worker in the **DETECTION** sub-agent. Detectors emit `Incident` records to the orchestrator. An `Incident` is:

```ts
type Incident = {
  detector: string;            // 'event-log' | 'perf' | 'wmi' | 'wer' | 'browser-webrequest' | …
  symbolic_code: string;       // e.g. 'DISK.FULL', 'BSOD.CRITICAL_PROCESS_DIED', 'CACHE.STALE'
  family: 'DISK'|'NET'|'BSOD'|'BROWSER'|'APP'|'SYS'|'AUTH'|…;
  confidence: number;          // 0..1
  severity: 'silent-safe'|'requires-save'|'requires-reboot'|'requires-human';
  ts: number;                  // local epoch ms
  // NO raw error strings. NO paths. NO URLs. NO content.
};
```

### C-1 · Native Windows sources Codex must wire

| Source | Tooling | What it catches |
|---|---|---|
| **Event Log** | `Get-WinEvent` via PowerShell child process, OR `node-windows` WMI subscriber | System, Application, Security errors + critical events |
| **WMI / CIM** | `WMI` queries through PowerShell or `wmi-client` Node bindings | Service state changes, device additions/removals, disk SMART warnings |
| **Performance Counters** | `Get-Counter` polled or `pdh.dll` via FFI | CPU sustained >85%, RAM pressure, disk queue length, network throughput drops |
| **Windows Error Reporting (WER)** | Watch `C:\ProgramData\Microsoft\Windows\WER\ReportArchive\` for new `.wer` files | App crash signatures (NOT crash dump CONTENT — only metadata: app name, exception code, faulting module) |
| **Windows Update API** | `Microsoft.Update.Session` COM, polled hourly | Pending updates, stuck updates |
| **Storage APIs** | WMI `Win32_LogicalDisk` + `Get-Volume` | Free space, fragmentation level, SMART health |
| **Reliability Monitor** | `Get-CimInstance Win32_ReliabilityRecords` | Past 14 days of stability events — primary BSOD/crash history source |
| **Service Control Manager** | `sc.exe query` polled / `Win32_Service` WMI | Service stopped/crashed/disabled state changes |
| **Network adapter state** | `Get-NetAdapter` + Windows Connect Now events | Adapter up/down, gateway loss, DNS resolution time |
| **CrashControl registry** | `HKLM\SYSTEM\CurrentControlSet\Control\CrashControl` | Last BSOD timestamp on boot — Tier C of BSOD integration |
| **Notification Center / UIAutomation** | UIAutomation `EventHandler` | Toast notifications and modal error dialogs from any UWP/Win32 app (metadata only — title + window class, NOT body text) |

**Polling cadence:** 2s default. Heavy sources (Reliability Monitor, full WMI sweeps) at 60s. Performance counters at 5s. All polling pauses when laptop is on battery + screen locked (battery-saver mode).

### C-2 · Signature matching

Detector emits raw signal → `signal-to-symbolic.ts` maps it to a symbolic code from the dictionary. The dictionary lives at `apps/sentinel-desktop/src/recipes/symbolic-state-dictionary.ts` and ships with ~150 codes at MVP (extends the 51 in `aria-pattern-router.mjs`).

```ts
// Example mapping
{
  pattern: { source: 'event-log', event_id: 41, provider: 'Microsoft-Windows-Kernel-Power' },
  symbolic_code: 'BSOD.UNEXPECTED_SHUTDOWN',
  family: 'BSOD',
  confidence_base: 0.65,
  severity: 'requires-human'
}
```

Mapping is **pure** — no I/O. Codex MUST add property test (§O) that exhaustively verifies no symbolic-code emission carries raw error text.

### C-3 · Confidence thresholding

- `confidence >= 0.8` → eligible for autonomous (in Autonomous mode for green-risk recipes)
- `0.5 <= confidence < 0.8` → always Confirmed mode behavior (ask)
- `confidence < 0.5` → escalation (don't guess) — open ticket, suggest human review

Codex: confidence is a multiplicative function of `signal strength × recipe confidence_base × historical success rate (local, anonymous)`. Specify the function in `confidence.ts` with unit tests.

### C-4 · Debounce + correlation

Multiple related signals fire within `5s` window collapse into one Incident. The orchestrator deduplicates by `(symbolic_code + last_seen < 60s)`. Prevents storm-on-storm UI spam.

### C-5 · BSOD detection — three integration tiers (locked per Ahmad)

**Tier C — Crash-on-resume (MVP, always-on):**
On agent startup, read `HKLM\SYSTEM\CurrentControlSet\Control\CrashControl\LastBSODTimestamp` + scan `C:\Windows\Minidump\*.dmp` for files newer than agent's last-known-good boot. If found:
1. Parse minidump header (NOT body) for stop code + faulting module name
2. Look up against local `aria-stop-codes` cache → recipe + confidence
3. If `confidence >= 0.8` → show Confirmed-mode fix card on next user interaction
4. If `confidence < 0.5` → show escalation card with the locked copy: *"This will need to be looked at by Desktop Support as it may need replacement parts or reimaging. Please contact your local Desktop support team to get this resolved."*

**Tier A — BCD boot menu entry (MVP, requires UAC at install):**
Installer runs:
```powershell
bcdedit /create /d "ARIA — Solve it for me" /application bootapp
bcdedit /set {newguid} path \EFI\Microsoft\Boot\bootmgfw.efi
bcdedit /displayorder {bootmgr} {newguid} /addlast
```
On next boot after BSOD, user sees standard Windows recovery options + ARIA. ARIA recovery binary (Sprint 4 Tier B, scaffold in Sprint 1) reads minidump, applies recipe, reboots clean.

**Tier B — Custom WinRE image (Sprint 4):**
Modify `winre.wim` via `dism /Mount-Image` + add ARIA Recovery binary + `reagentc /setreimage`. Most powerful, most invasive, deferred to v1.1.

### C-6 · Browser extension detection (Chrome → Edge → Safari)

Service worker watches:
- `chrome.webRequest.onErrorOccurred` — failed requests
- `chrome.webNavigation.onErrorOccurred` — page-load failures
- `chrome.debugger` attached to current tab → console errors (metadata only — error class + message hash, NEVER message body that could leak page state)
- Form submission via content script: counts failed submits per origin in 5min window → `PASSWORD.RETRY.N` signal
- `chrome.cookies` for stuck cookie state

Extension sends symbolic codes to desktop agent via localhost mTLS WebSocket (`wss://127.0.0.1:8443/aria-sentinel` with self-signed pinned cert generated at install).

Extension fixes via `chrome.browsingData.removeCache/Cookies/LocalStorage` scoped to current origin only. NEVER cross-origin.

---

## §D · USER INTERACTION FLOW

Reference visual: `outputs/aria-sentinel-design-handoff/07_user-flow.svg`.

### D-1 · Announce-before-act (locked)

Quote from Ahmad's directive: *"on detection ARIA pops up: 'I see you're having an issue with [X]. I'll take over and resolve it — please save all your work to avoid losing unsaved files. Don't worry, if we need to reboot I'll tell you first.'"*

Locked copy templates in `apps/sentinel-desktop/src/ui/copy.ts`:

```ts
export const COPY = {
  detected_disruptive: (issue: string) =>
    `I see you're having an issue with ${issue}. I'll take over and resolve it — please save all your work to avoid losing unsaved files. Don't worry, if we need to reboot I'll tell you first.`,
  detected_silent: (issue: string) =>
    `I noticed ${issue} and resolved it. Here's the report and ticket #{ticket}. You may resume your work.`,
  suggest_steps: (action: string) =>
    `Can I suggest some technical steps? Let's try ${action}.`,
  reboot_consent:
    `This fix needs a restart to take effect. I'll reboot in 60 seconds unless you cancel. Save your work now.`,
  bsod_escalation:
    `This will need to be looked at by Desktop Support as it may need replacement parts or reimaging. Please contact your local Desktop support team to get this resolved.`,
  disk_low_proactive: (drive: string, top_offender: string) =>
    `Your ${drive} drive is running low. These items are taking up the most space — for example your ${top_offender}. Would you like me to clear it?`
};
```

### D-2 · Save grace period

Configurable per recipe (default 30s). Cancel button always visible. If user accepts immediately, no wait.

### D-3 · Reboot consent gate

Separate confirmation. Reboot button is red. Countdown visible. NEVER silent reboot. Cancel returns to "fix pending" state.

### D-4 · Silent-fix path

For recipes flagged `risk: 'green'` + `disruption: 'none'` AND in Autonomous mode AND `confidence >= 0.85`: fix runs in background, then `COPY.detected_silent` card appears.

### D-5 · Persistent visible indicator

Globe is ALWAYS on screen when agent is active. Never hidden. Tray icon always present. Pause state visible via globe color shift (warm amber) + tray badge.

### D-6 · First-run onboarding (4 cards)

Cards from design package. Onboarding logged with timestamp + version to `audit-log.jsonl` as consent capture event. Required by §G.

### D-7 · Per-incident interaction recording into ticket

Per Ahmad's locked directive: *"Record the entire user conversation/interaction for each incident into the ticket — every prompt ARIA showed, every yes/no the user gave, what was done."*

Implementation: `audit-log.jsonl` per incident captures:
- Every prompt template ID + parameters shown (template IDs only — never user-typed text)
- Every Y/N click + timestamp
- Each recipe step + outcome
- Final outcome (resolved / rolled back / escalated)

This log is appended to the ServiceNow ticket + IIS ticket as a structured timeline. Content-blind: prompt template IDs not prompt text, action class not action contents.

---

## §E · AUTONOMOUS ACTION GOVERNANCE

### E-1 · Deny-by-default allow-list (in code, in config — NEVER ingested from customer docs)

`apps/sentinel-desktop/src/recipes/registry.ts` exports `ALLOWED_ACTIONS`:

```ts
export const ALLOWED_ACTIONS = Object.freeze({
  // Service control
  RESTART_SERVICE: { args: ['service_name:enum'], risk: 'green', requires_snapshot: false },
  STOP_SERVICE: { args: ['service_name:enum'], risk: 'yellow', requires_snapshot: false },

  // Network
  FLUSH_DNS: { args: [], risk: 'green', requires_snapshot: false },
  RESET_NETWORK_ADAPTER: { args: ['adapter_name:enum'], risk: 'yellow', requires_snapshot: false },
  WINSOCK_RESET: { args: [], risk: 'yellow', requires_snapshot: true, requires_reboot: true },

  // Cache + temp
  CLEAR_TEMP_FILES: { args: [], risk: 'green', requires_snapshot: false },
  CLEAR_OUTLOOK_OST: { args: ['profile_name:enum'], risk: 'yellow', requires_snapshot: true },
  CLEAR_TEAMS_CACHE: { args: [], risk: 'green', requires_snapshot: false },
  CLEAR_ONEDRIVE_CACHE: { args: [], risk: 'yellow', requires_snapshot: true },

  // System repair
  SFC_SCAN: { args: [], risk: 'yellow', requires_snapshot: true },
  DISM_RESTORE: { args: [], risk: 'red', requires_snapshot: true, requires_reboot: true },
  WINDOWS_UPDATE_RESET: { args: [], risk: 'yellow', requires_snapshot: true },

  // Process control
  KILL_PROCESS: { args: ['process_name:enum', 'pid:int'], risk: 'yellow', requires_snapshot: false },

  // User-file actions (require per-item confirm, never autonomous)
  DELETE_FILES: { args: ['file_class:enum', 'specific_paths:string[]'],
                   risk: 'red', requires_snapshot: true, autonomous_capable: false,
                   note: 'Only after explicit per-item user confirm. Never autonomous.' },

  // BSOD recipes (boot recovery)
  RUN_BSOD_RECIPE: { args: ['recipe_id:enum'], risk: 'red', requires_snapshot: true,
                     requires_reboot: true, requires_recovery_mode: true },
});
```

Hard ceiling (locked per Ahmad): **No autonomy tier overrides actions that touch user data, security settings, encryption, account permissions, or other users.** These are `autonomous_capable: false` regardless of mode. They always require Confirmed-mode confirmation by the local user.

### E-2 · Snapshot-before-change + rollback

Every action with `requires_snapshot: true` creates a Windows System Restore point via `Checkpoint-Computer -Description "ARIA Sentinel pre-{recipe_id}" -RestorePointType MODIFY_SETTINGS` first. Snapshot ID recorded in audit log.

`snapshot.ts` provides:
- `createSnapshot(recipeId): SnapshotHandle`
- `verifyAfterAction(handle, expectedState): boolean`
- `rollback(handle): void` — invoked automatically if `verifyAfterAction` returns false within 60s of action completion

### E-3 · Idempotency

Every recipe execution has a unique `execution_id` (UUID v4). Re-execution with same `execution_id` is a no-op + returns prior outcome. Stored in `~/.aria-sentinel/execution-cache.sqlite` (encrypted, 7-day retention).

### E-4 · Blast-radius limiting

Cross-fleet rate limit at backend: per `recipe_id`, no more than `5%` of fleet attempts recipe in any 60-minute window. If exceeded, recipe is temporarily disabled fleet-wide via `aria-recipes` returning `recipe.enabled = false`. Codex: add `recipe-circuit-breaker.mjs` on backend.

### E-5 · Kill switches (3 levels)

1. **Per-endpoint:** Tray icon → Pause / Disable. Local user action.
2. **Per-customer:** IT admin can disable fleet via signed config delivered through `/aria-recipes?customer=…`.
3. **Global:** Backend kill switch — `/aria-recipes` returns `{ killed: true, reason }` → all agents enter detect-only mode.

### E-6 · Sandboxed execution

Fix runner spawns PowerShell child processes with `-NoProfile -NonInteractive -ExecutionPolicy Restricted` and only invokes scripts from `apps/sentinel-desktop/src/recipes/scripts/*.ps1` — signed at build time. **No script content is ever derived from AI output, customer KBs, error strings, or any ingested data.** Scripts take typed parameters from `ALLOWED_ACTIONS` and validate before execution.

---

## §F · CUSTOMER POLICY / KB CONTAINMENT (Prompt-Injection-Into-Executor Defense)

Customer-managed deployments will want to upload their own KB / runbook / policy documents. These documents are **untrusted data**, never instructions.

### F-1 · What customer KBs CAN do

- Inform WHEN a recipe should run (e.g. "for our team, don't auto-clear Outlook cache during business hours")
- Suppress recipes (per-recipe enable/disable)
- Set per-recipe confirmation requirements (raise the bar, never lower)
- Specify escalation contact info (visible in escalation cards)

### F-2 · What customer KBs CANNOT do (HARD)

- Add new actions to `ALLOWED_ACTIONS`
- Change recipe content
- Remove safety gates
- Lower the autonomy ceiling
- Bypass content-blind boundary
- Cause arbitrary command execution

### F-3 · Implementation

Customer KBs are parsed by `customerPolicy.parse(json)` into a typed `PolicyOverlay`:

```ts
type PolicyOverlay = {
  recipes_disabled: string[];         // by recipe_id only
  business_hours?: { start: string; end: string; timezone: string };
  confirmation_threshold?: 'always' | 'risk-yellow-plus' | 'risk-red-only';
  escalation_contacts?: { name: string; channel: 'email'|'slack'|'phone'; address: string }[];
  // NOTHING ELSE.
};
```

Any field outside this schema is **discarded silently**. Parser is the gate. Test suite §O includes injection attempts (e.g. `{ "exec_command": "rm -rf /" }`, `{ "new_action": {...} }`) and asserts the parser strips them.

---

## §G · PRIVACY · CONSENT · DATA HANDLING

### G-1 · The sanitization boundary (THE single most important function in the codebase)

`apps/sentinel-desktop/src/safety/sanitize.ts`:

```ts
import { redact } from '../../../netlify/functions/_pii-redact';  // reuse existing PII redactor
import { SYMBOLIC_DICTIONARY } from '../recipes/symbolic-state-dictionary';

/**
 * Pure function. No I/O. No side effects.
 * Input: an Incident from a detector (may contain raw error strings, paths, URLs).
 * Output: a Signature — opaque, content-free, safe for upward call.
 *
 * Codex: this function is THE compliance boundary. The content-leak test in §O
 * asserts that for 10,000 fuzzed inputs containing fake PII / URLs / file paths /
 * document contents, the output's stringified form contains NONE of them.
 */
export function sanitizeToSignature(incident: RawIncident): Signature {
  return {
    code: matchToDictionary(incident),     // → e.g. 'DISK.FULL', 'BSOD.0x000000EF'
    family: classifyFamily(incident),      // → 'DISK' | 'NET' | …
    confidence: scoreConfidence(incident), // → 0..1
    os_version: hashOsVersion(incident.os) // → SHA-256 first 8 chars only
    // NO error_text. NO path. NO url. NO process_name (only enum). NO host. NO domain.
  };
}

function matchToDictionary(incident: RawIncident): string {
  // Pure pattern match against SYMBOLIC_DICTIONARY entries.
  // If no match: return 'UNKNOWN.UNCATEGORIZED' — escalate, do not upload raw.
}

// Strict type — Codex must use exactly this shape for all upward calls:
type Signature = Readonly<{
  code: string;       // symbolic, dictionary-validated
  family: Family;     // enum
  confidence: number; // 0..1
  os_version: string; // 8-char hash
}>;
```

This signature is the ONLY shape that may cross the L1→L3 boundary. The TypeScript type system + a runtime validator + the content-leak test gate enforce it.

### G-2 · Ephemerality contract

Every in-memory buffer holding raw signals is wrapped in `EphemeralBuffer<T>`:

```ts
class EphemeralBuffer<T> {
  constructor(private value: T) {}
  read(fn: (v: T) => Signature): Signature { /* one-time read + zero */ }
  // After read(), value is overwritten with zeros and reference cleared.
}
```

CI test asserts no class fields outside `EphemeralBuffer` ever hold strings matching `/error|stack|message|content|body|html|text/` from a detector output.

### G-3 · End-user consent (not just employer)

First-run shows the consent dialog. Required for any monitoring to start. Logged with:
- Timestamp
- Agent version
- User identity (Windows SID — local only, never uploaded)
- Mode selected
- Boilerplate hash (proves what they consented to)

Stored at `~/.aria-sentinel/consent.json`. Required for agent to leave first-run state.

### G-4 · BYOD vs corporate-device

Sentinel reads `Get-WmiObject Win32_ComputerSystem.DomainRole` at install:
- `0` (Standalone Workstation) → BYOD mode, broader user controls, conservative defaults
- `1`+ (Domain member) → Corporate mode, MDM-deployable, IT-admin overrides allowed (within §F constraints)

### G-5 · Per-jurisdiction handling

Configured via install-time prompt + read from `Get-WinUserLanguageList` + `Get-TimeZone`. Adjusts:
- Consent dialog text (PIPEDA wording for CA, GDPR for EU, CCPA for CA-US, etc.)
- Default telemetry opt-in posture (always OFF, but jurisdiction-specific wording on opt-in)
- Data residency note (Sentinel never sends PII anywhere, so residency is N/A for user data — but recipe-pull endpoints serve regionally)

### G-6 · Telemetry: OFF by default

The opt-in `/aria-recipe-feedback` channel carries **only** `{ recipe_id, outcome, ts }`. No machine ID, no IP fingerprint, no anything-identifiable. Settings UI explains the value (helps improve recipes) + shows opt-out toggle.

### G-7 · Privacy verifier UI

Settings → Privacy tab. Shows:
- Live network monitor: every outgoing connection in last 24h
- Source code links to `sanitize.ts` + `EphemeralBuffer` + content-leak test
- "Reproduce the network audit" button → spawns a verified Wireshark capture demo

Enterprise customers will demand this. Build it from day one.

---

## §H · TICKETING — ServiceNow + IIS

### H-1 · ServiceNow integration

Per-tenant config: `customer_servicenow_url`, `customer_servicenow_credential_alias`. Credentials stored in Windows Credential Vault. Agent calls ServiceNow Table API:

```
POST {customer_servicenow_url}/api/now/table/incident
{
  "short_description": "Auto-resolved by ARIA Sentinel · {symbolic_code}",
  "description": "{structured timeline of prompts shown + user responses + actions + outcomes — all content-blind, template IDs only}",
  "category": "{family}",
  "assigned_to": "{escalation_contact or empty}",
  "u_aria_recipe": "{recipe_id}",
  "u_aria_outcome": "{outcome}",
  "u_iis_internal_id": "IIS-YYMMDD-####"
}
```

### H-2 · Internal IIS ticket

Existing IIS-YYMMDD-#### sequence (reuse current generator). Synced to ServiceNow record's `u_iis_internal_id` field. Local SQLite stores agent-side mirror for offline operation.

### H-3 · Pluggable ticketing layer

`ticketing/connector.ts` interface — alternate connectors: Jira (Sprint 2), Freshservice, Zendesk, M365 Service Health, plain email fallback. Customer selects in settings.

### H-4 · Graceful offline

If ServiceNow unreachable: queue ticket locally (encrypted), generate provisional `IIS-YYMMDD-####`, show user the provisional number. Retry every 5 min until delivered. Audit log records every retry.

---

## §I · AUDIT · REPORTING · EXPLAINABILITY

### I-1 · Tamper-evident audit log

Append-only `~/.aria-sentinel/audit/log-{YYYY-MM-DD}.jsonl`. Each entry hash-chained:

```
{ "seq": N, "prev_hash": "sha256(...)", "hash": "sha256(seq+prev_hash+payload)",
  "ts": ..., "event": "incident_detected" | "fix_applied" | "rollback" | "consent_captured" | "mode_changed" | "kill_switch_engaged",
  "payload": { ... }  // content-blind: codes + recipe_ids + outcomes, never raw text
}
```

Verifier tool `aria-audit-verify` (separate signed binary in installer) reads chain + asserts integrity. IT admins run it during audits.

### I-2 · Per-action explainability

Every action entry includes:
- `triggered_by`: incident signature
- `recipe_id`: which recipe was selected
- `selection_reason`: confidence score + matching dictionary entry + applicable PolicyOverlay
- `result`: outcome + verification results

Customer audit dashboard (Sprint 4+) renders this as a human timeline.

---

## §J · THE AGENT BINARY (privileged endpoint process)

### J-1 · Least standing privilege

Agent runs as the logged-in user. Privilege elevations happen via `runAs` with Windows UAC prompts — JIT, per-action, logged. No permanent admin token. No silent elevation.

### J-2 · Code signing + integrity

- Authenticode-signed (Microsoft EV cert — Ahmad buys after MVP test)
- On startup: agent verifies its own signature + computes hash of installation directory → if mismatch with embedded manifest, refuses to start + alerts user
- All bundled PowerShell scripts hash-pinned in manifest

### J-3 · Secure auto-update (a supply-chain attack vector — treat as critical infrastructure)

- Update manifest signed by IIS release key
- Staged rollout: 1% → 5% → 25% → 100% over 7 days
- Each stage gated by no-regression telemetry (opt-in customers report fix outcomes; sharp drop pauses rollout)
- Instant halt: backend can set `update_paused: true`
- Rollback on update failure
- Update channel: `stable` + `beta`

### J-4 · Hardened agent ↔ control plane channel

- mTLS to `iisupp.net/aria-*`
- Certificate pinning (HPKP-style, baked into installer)
- No implicit trust — every request signed
- Connection drops → enter degraded mode (use local cache, queue ticket retries)

### J-5 · Offline / degraded behavior

Fail-safe, never fail-open. Without control plane:
- Detection: full capability (all local)
- Diagnosis: full capability (local KB)
- Remediation: green-risk recipes only (no yellow/red without control-plane confirmation of recipe-not-revoked)
- Ticketing: queue + provisional number
- BSOD recipes: full capability (local cache is authoritative)

### J-6 · Resource governance

- CPU cap: <1% idle, <5% during fix execution
- Memory cap: 150MB resident
- Disk: <50MB excluding KB cache (~5MB) + audit log (rotated weekly, 90-day retention)
- If user reports performance impact: tray menu → "Low-power mode" reduces polling to 30s

### J-7 · Clean uninstall

Standard MSI uninstaller. Removes:
- All binaries
- Audit log (after offering export)
- KB cache
- Consent record
- BCD entry (Tier A BSOD takeover)
- WinRE modifications (Tier B, when active)
- Stripe subscription unchanged (user manages via portal)

---

## §K · IDENTITY · AUTH · AUTHORIZATION

For the operator/IT-admin console (L5, future) + Sentinel agent registration:

- SSO via SAML/OIDC (existing iisupp.net stack)
- SCIM provisioning
- MFA mandatory for IT admin actions
- Service-to-service: mTLS + signed JWT
- RBAC + ABAC for IT admin actions via OPA policy engine
- Per-endpoint API key (rotatable, scoped to tenant)
- Session expiry + revocation tracking

---

## §L · ARCHITECTURE NON-NEGOTIABLES (Reliability)

- Control plane / data plane separation (UI never executes fix scripts directly — always via orchestrator)
- Async durable execution queue (SQLite-backed) for multi-step fixes
- Event-driven sub-agent bus
- Saga pattern for multi-step fixes (compensating actions defined per step)
- Circuit breakers + exponential backoff + jitter on all I/O
- Dead-letter queue with replay
- Graceful degradation (detect-only when remediator down)
- Health endpoints (liveness, readiness)
- Graceful shutdown drains in-flight work
- Backpressure: per-tenant rate limits

---

## §M · SECURITY HARDENING

- Zero-trust between agent components (mTLS WebSocket on localhost)
- Secrets management: Windows Credential Vault + DPAPI
- Encryption at rest (KB cache + audit log + execution cache) via DPAPI machine-key
- Encryption in transit: TLS 1.3 only, no fallback
- Input validation on every external boundary
- SBOM published per release
- Dependency scanning (Dependabot + Snyk) in CI
- SAST (CodeQL) + DAST + secret scanning
- Per-tenant rate limiting on all backend endpoints
- WAF on iisupp.net (existing Netlify edge)
- Bug bounty program (link to existing `/.well-known/security.txt`)

---

## §N · DATA LAYER (backend, where applicable)

Sentinel itself stores almost nothing centrally. Backend stores:
- Recipe registry (versioned, signed)
- Stop-code map (versioned, signed)
- KB bundles (versioned, signed)
- Anonymous recipe feedback (opt-in, aggregated, never per-user)
- Per-tenant policy overlays (encrypted at rest, tenant-isolated via blob namespacing)

No PII. No content. No machine IDs.

---

## §O · TESTING & QUALITY GATES (release blockers)

### O-1 · Content-leak test (THE primary release gate)

`tests/sentinel/content-leak.spec.ts`:

```ts
import { sanitizeToSignature, EphemeralBuffer } from '../../apps/sentinel-desktop/src/safety/sanitize';
import { runAgentForOneCycle } from '../../apps/sentinel-desktop/test-harness/agent';

describe('Content-leak release gate', () => {
  // 10,000 fuzzed inputs that look like real screen/browser/document content
  const FUZZ_INPUTS = generateContentishFuzzCorpus(10_000);

  for (const input of FUZZ_INPUTS) {
    test(`Input ${input.id}: no leak to network`, async () => {
      const networkCapture = startNetworkCapture();
      const diskCapture    = startDiskWriteCapture();
      const logCapture     = startLogCapture();

      await runAgentForOneCycle({ inject_incident_text: input.text });

      const all = [...networkCapture, ...diskCapture, ...logCapture].join('|');
      for (const phrase of input.canary_phrases) {
        expect(all).not.toContain(phrase);
      }
    });
  }

  test('Signature shape is provably constrained', () => {
    const out = sanitizeToSignature(makeIncidentWithEverything());
    expect(Object.keys(out).sort()).toEqual(['code', 'confidence', 'family', 'os_version']);
    for (const v of Object.values(out)) {
      expect(typeof v).toMatch(/string|number/);
    }
  });
});
```

This test runs on every PR. **Merge is blocked if it fails.**

### O-2 · Policy-injection test gate

`tests/sentinel/policy-injection.spec.ts` — attempts to make uploaded customer KB grant new powers. Must all fail (parser silently strips out-of-schema fields).

### O-3 · Idempotency + rollback tests

For every recipe in registry:
- Re-execute with same `execution_id` → no-op + same outcome
- Inject failure mid-action → assert rollback completes + system state restored

### O-4 · Chaos / fault injection

Probabilistic kill of sub-agents, network drops mid-fix, snapshot creation failure, audit log disk-full. Agent must degrade gracefully.

### O-5 · Standard pyramid

- Unit tests: every sub-agent module, sanitizer, dictionary mapping, confidence scorer
- Integration tests: full detect → diagnose → remediate → ticket cycles
- E2E: Electron + extension in a real Windows VM
- Load / soak: 1000+ simulated incidents per hour for 24h

### O-6 · CI gates (all green to merge)

- Lint
- TypeCheck
- Unit
- Integration
- Content-leak ← BLOCKER
- Policy-injection ← BLOCKER
- Idempotency suite ← BLOCKER
- SAST
- Dependency scan
- License scan

---

## §P · DEPLOYMENT & RELEASE

- IaC: Terraform for backend Netlify config + DNS
- Config as code
- Blue-green deploys for backend
- Feature flags per tenant (use existing iisupp.net Stripe-coupon pattern as backend)
- Backward-compatible migrations
- Auto-update for agent: staged 1%→5%→25%→100% over 7 days

---

## §Q · COMPLIANCE & GOVERNANCE

- SOC 2 Type II controls from day one (Common Criteria mapping in `/compliance/` hub already live on iisupp.net)
- Sector frameworks deferred unless contract pulls forward:
  - HIPAA-equivalent (health vertical)
  - PCI-DSS (if payments touched — currently no)
  - ISO 27001 (international, on-award)
- Documented IR plan with severity tiers + runbooks (reuse `docs/DR-RUNBOOK.md` pattern)
- BCP / DR with RTO 4h / RPO 24h
- Blameless postmortems → fixes
- Customer status page (reuse existing `/status` on iisupp.net)

---

## §R · OPS & LIFECYCLE

- Runbooks per common failure
- On-call escalation (Ahmad primary while solo; SLA → 2h ack)
- Capacity planning + cost monitoring
- ADRs in `docs/adr/` (new folder)
- API + integration docs at `/aria-sentinel/docs/`
- Versioned changelog + deprecation policy

---

## §S · LAUNCH-BLOCKERS (must ship in v1 — brutal to retrofit)

In priority order:

1. **Content-blind telemetry collectors.** Detection layer physically cannot read content. CI gates assert this.
2. **`sanitizeToSignature()` + `EphemeralBuffer<T>` + content-leak test gate.** Signature-only egress. Release-blocking test.
3. **Announce-before-act + save prompt + reboot consent gate + persistent visible indicator.** UI locks from §D.
4. **Sub-agent orchestrator with mediated, JIT, logged privilege escalation.** Architecture from §B-2.
5. **Deny-by-default `ALLOWED_ACTIONS` allow-list with `autonomous_capable: false` ceiling.** Data/security actions always need human.
6. **Snapshot-before-change + auto-rollback + idempotency.** §E-2 + §E-3.
7. **Customer KB/PolicyOverlay containment + parser as gate.** §F + policy-injection test gate.
8. **Immutable, tamper-evident, content-free audit log + per-action explainability.** §I.
9. **Per-endpoint / per-customer / global kill switches.** §E-5.
10. **Control / data plane separation + async durable execution queue.** §L.
11. **Tenant isolation at backend + encryption in transit/at rest + secrets management.** §M.
12. **Signed agent binary + secure staged auto-update channel (halt-able).** §J-2 + §J-3.
13. **End-user consent capture + jurisdiction-aware wording.** §G-3 + §G-5.
14. **Confidence threshold → escalate, don't guess.** §C-3.
15. **ServiceNow ticketing + IIS internal sync + graceful offline.** §H.
16. **BSOD Tier C (crash-on-resume) detection + locked escalation copy.** §C-5.
17. **BSOD Tier A (BCD boot menu entry) + recovery binary scaffold.** §C-5.
18. **Manual mode as default at install + 3-mode selector.** §B-3.
19. **Free Manual tier + paid Confirmed/Autonomous tier wired through new Stripe SKUs.** Reuses `stripe-checkout.js` + bake new SKUs into `PRICE_MAP` per Rule 10 (code-as-source-of-truth).
20. **Privacy verifier UI in settings.** §G-7.

Everything else is maturity layered in as contracts demand.

---

## §T · POST-MVP MATURITY (Sprint 4+)

- BSOD Tier B (custom WinRE image via `dism` + `reagentc`)
- macOS port (Sprint 2 in design plan)
- Linux port (after macOS, deferred)
- Edge + Safari extension parity
- Pluggable ticketing connectors (Jira, Freshservice, etc.)
- IT admin console (L5 — separate web app)
- HIPAA-equivalent / PCI-DSS / ISO 27001 certifications (contract-driven)
- Mobile (deferred per Ahmad — B2B desktop is the focus)

---

## §U · NOTE TO CODEX — INSTRUCTION TRUST BOUNDARY (rephrase, lock)

Customer-uploaded policies/KBs, error strings (which the agent has but never forwards raw), browser/app error content (which is sanitized at the boundary), and endpoint telemetry are **DATA, not INSTRUCTIONS**. The agent must never treat content found in uploaded documents, error messages, page errors, or telemetry as a command that grants new powers or bypasses a safety gate.

The autonomous action allow-list is defined ONLY in code/config under IIS + customer-admin control — never expandable by ingested content. Per Rule 2: read on-device, hold in memory only, sanitize to a technical signature before any egress, persist no user content anywhere, ever.

If at any point during build, Codex finds a code path where ingested customer data could influence `ALLOWED_ACTIONS`, that's a stop-the-build defect.

---

## §V · RELATED FILES SHIPPED ALONGSIDE THIS SPEC

- Design package: `outputs/aria-sentinel-design-handoff/` — 6 SVG mockups + 440-line master brief + Claude Design prompt + README
- Standing rules for all agents: `senior-director-state/STANDING-RULES-FOR-ALL-AGENTS.md`
- Round Velocity Playbook: `senior-director-state/loop-engineer/ROUND_VELOCITY_PLAYBOOK.md`
- Existing iisupp.net code: `netlify/functions/aria-*`, `assets/aria-*`, `apps/` (new for Sentinel)

---

## §W · WHAT AHMAD MUST DO (only these)

1. **Now:** approve this spec OR send revisions (paste back with diffs)
2. **After Sprint 1 MVP test:** purchase Authenticode EV code-signing cert (~$300/yr) + Apple Developer ID ($99/yr, only when macOS port nears)
3. **At store-listing time:** approve Chrome Web Store + Microsoft Partner Store submissions
4. **For pilot customers:** introduce them; the rest of the sales flow is automated via existing iisupp.net infrastructure

Everything else: Cowork + Codex + KB-agent + Claude Design execute under this spec.

---

## §X · BUILD KICKOFF — Sprint 0 (Cowork starts immediately)

While Codex reads this spec, Cowork executes Sprint 0:

- [x] Backend `/aria-recipes` exists, seeded with Sentinel recipes (commit `99c4128` and earlier)
- [x] Backend `/aria-stop-codes` exists with seed BSOD codes
- [ ] Extend symbolic dictionary from 51 → ~150 codes (Cowork)
- [ ] Add `/aria-kb-bundle` endpoint serving signed local-cache bundle
- [ ] Add `/aria-recipe-feedback` endpoint (opt-in only, signature schema)
- [ ] Add `/aria-binary-update` manifest endpoint
- [ ] Recipe registry data file `apps/sentinel-desktop/src/recipes/registry.ts` with the 25 MVP recipes typed
- [ ] PRICE_MAP entries for new Sentinel tiers (code-as-source-of-truth)

After Sprint 0, Codex picks up Sprint 1 (Electron app + Chrome extension MVP).

---

## §Y · CHANGE LOG FOR THIS SPEC

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-06-19 | Claude Chat | Initial draft |
| 1.0 | 2026-06-19 | Cowork × Ahmad | Extended with: reuse map from real codebase, sanitization boundary as real code spec, BSOD Tier A/B/C integration (Ahmad's locked requirement), Manual mode as install default (locked), code-as-source-of-truth pattern (Rule 10 propagation), 25-recipe MVP set, cross-reference to design handoff package, ServiceNow + IIS ticket structure, content-leak test gate code, policy-injection test gate, idempotency + rollback test specifics, privacy verifier UI, BYOD vs corporate handling, jurisdiction adaptation. |

---

*End of spec. Codex: read top to bottom, then start Sprint 1 from the §S launch-blocker list.*

---

# PART 4 · DESIGN MASTER BRIEF (the UI spec, 16 sections)

# ARIA Sentinel — Design Handoff Master Brief

**Recipient:** Claude Design session (or any senior product designer)
**Author:** Cowork × Ahmad Wasee · Integrated IT Support Inc.
**Date:** 2026-06-19
**Status:** Approved scope, awaiting design execution

---

## 0 · TL;DR for the designer

ARIA Sentinel is a **persistent on-device error-resolver** for Windows desktops + all major browsers. It watches the user's machine for crashes, errors, and friction (BSOD, app crash, browser cache stale, repeated login fails, slow PC) — and either applies the fix automatically (Autonomous mode), asks first (Confirmed mode), or walks the user through it via chat (Manual mode, default at install).

It manifests as a **floating gold globe** that hugs the viewport edges, dodges the cursor, and surfaces fix proposals via a branded card that slides up from the globe.

**Hard product positioning:**
- B2B-first. Built for businesses.
- **Strict privacy.** Nothing leaves the device. KB recipes come DOWN from `iisupp.net/aria-recipes`, all matching + execution happens locally.
- Standalone product, separate pricing from existing ARIA SaaS tiers.
- Windows desktop first. Chrome + Edge + Safari (within macOS app) extensions all parts of v1.
- Mobile deferred.

**Deliverables you (designer) need to produce:**
1. Brand-aligned high-fidelity mockups for every UI surface listed in §6
2. Presentation deck (12-16 slides) for internal alignment + investor/customer demo
3. Stage-by-stage build visualization (Sprint 0 through Sprint 6)
4. Figma file with components, color tokens, typography tokens, motion specs
5. Marketing one-pager + landing page concept for `iisupp.net/aria-sentinel/`

---

## 1 · Product positioning

**Name:** ARIA Sentinel
**Tagline:** *Resident IT support that never sleeps.*
**One-liner:** ARIA Sentinel lives on your PC, watches for tech problems, and fixes them before they slow you down — without sending your data anywhere.

**Audience:** SMB owners, mid-market IT leads, and enterprise procurement teams who want to reduce help-desk ticket volume without giving up data sovereignty.

**Pricing model:** Standalone subscription. Pricing tiers TBD (separate from ARIA Personal/Pro/SMB/Mid/Enterprise tiers already live on iisupp.net/plans). Manual mode = free trial / freemium. Autonomous + Confirmed modes = paid.

**Why now:** Tech support is moving from "ticket → human" to "agent → ambient fix." First mover wins customer retention + recurring revenue.

---

## 2 · Brand foundations (use the same system as iisupp.net)

### Colors
| Role | Hex | Use |
|---|---|---|
| Background primary | `#050505` | App chrome, dark surfaces |
| Background secondary | `#0a0a0a` | Cards, modals |
| Background tertiary | `#141414` | Inset panels |
| Border | `#2a2a2a` | Divider lines |
| Accent gold | `#c5a059` | Primary brand, globe core, CTA |
| Accent gold light | `#f1dca7` | Highlights, hover state |
| Accent gold dark | `#8b6d2f` | Pressed state |
| Text primary | `#ffffff` | Primary text |
| Text secondary | `#aaaaaa` | Secondary text |
| Text muted | `#666666` | Disclaimers |
| Success | `#7afbff` | Fix-applied confirmation |
| Warning | `#ffcb6b` | Action required from user |
| Error | `#ff7e7e` | Fatal / contact support |

### Typography
- **Display / Headings:** `Cinzel` (serif, used for ARIA logo, hero text, modal headlines)
- **Body / UI:** `Inter` (sans-serif, all UI labels, copy, buttons)
- **Mono / Code:** `ui-monospace, SF Mono, Monaco, Menlo` (timestamps, log excerpts, technical detail)

### Globe identity
- A gold sphere with concentric circles + crosshair lines (same geometry as iisupp.net hero globe)
- Slowly rotates (~30s per full rotation)
- Soft inner glow + outer haze
- See SVG mockup `02_globe-states.svg` for 5 states
- Size: 64px diameter default, 96px when active/diagnosing

### Voice & tone (UI copy)
- Calm, competent, never alarmed
- Short sentences. CEO/operator voice.
- Never use "Oops" / "Whoops" / exclamation marks
- Never apologize for system errors that aren't ARIA's fault
- Confirmation language: "I detected X. Fixing now." / "Done. Refresh to finish."
- Manual mode: "I think this is a printer driver issue. Want me to walk you through it?"

---

## 3 · Modes (3 + edge case)

### Manual (default at install)
- Globe present, watches for issues
- When error detected → globe pulses + prompt: *"I see a printer issue. Open chat for steps?"*
- User clicks → opens chat overlay → ARIA walks through it step by step
- No fixes applied automatically

### Confirmed (paid)
- Globe detects error → fix card slides up: *"I detected disk almost full (3% free). Clear temp files + cache to recover ~4GB?"*
- Buttons: **[Yes, fix it]** **[Tell me more]** **[Not now]**
- On confirm → animation → done card

### Autonomous (paid, opt-in setting)
- Globe detects + fixes silently for low-risk recipes (cache clear, DNS flush, etc.)
- Post-fix card appears: *"I cleared your Chrome cache for [domain]. Refresh the page."*
- Higher-risk fixes (driver reinstall, registry edit) still confirm regardless of mode

### Pause / panic
- Tray icon → "Pause ARIA for 24 hours"
- Global hotkey to pause
- Important: this never disables the BSOD takeover (that's safety, not convenience)

---

## 4 · CRITICAL feature — Blue Screen of Death (BSOD) integration

Ahmad's quote (lock this requirement):
> *"For blue screen issues, once ARIA is installed on the system somehow find a way to make ARIA solutions available as an option on every and any blue screen. When user clicks 'ARIA — Solve it for me' it looks up the error codes in MS database and applies the fix or suggests, and if no other options available then tells user this will need to be looked at by Desktop Support."*

### How this actually works on Windows

Windows BSODs run in **kernel error state**, not user mode. Apps don't run there normally. Three integration points solve this:

**Tier A — Boot Configuration Data (BCD) entry** (achievable in MVP)
- Installer adds an entry to BCD via `bcdedit /create` pointing to a custom WinRE bootmgr menu item: *"ARIA — Solve it for me"*
- When a BSOD occurs, on next boot the user sees the standard Recovery screen AND ARIA's option
- Selecting it boots into WinRE-mode ARIA Sentinel Recovery, which reads the dump file from `C:\Windows\Minidump\`, matches the stop code against the local KB + Microsoft's published BSOD code list, applies the fix
- This is what the UI mockup `04_bsod-takeover.svg` represents

**Tier B — Reagentc + custom recovery image** (Sprint 4)
- Installer modifies `winre.wim` to include ARIA Sentinel Recovery binary
- `reagentc /setreimage` points recovery agent to the modified image
- On crash → automatic boot into ARIA Recovery → fix attempt → resume normal boot
- Requires elevation at install (UAC), one-time

**Tier C — Crash-on-resume detection** (always-on fallback)
- ARIA Sentinel reads `HKLM\SYSTEM\CurrentControlSet\Control\CrashControl\LastBSODTimestamp` on every start
- If last BSOD was < 5 minutes ago, immediately shows fix card on next normal boot
- This catches ANY BSOD even if the boot menu / WinRE customization fails
- No system modification required → safer fallback

**Recommended for MVP:** Ship Tier A + Tier C. Tier B as Sprint 4 polish.

### BSOD fix-or-handoff logic

```
1. ARIA reads stop code (e.g. CRITICAL_PROCESS_DIED / 0x000000EF)
2. Looks up against local KB → matches "Outlook PST corruption" recipe
3. If recipe has confidence > 0.8 → applies fix
4. If 0.5 < confidence < 0.8 → presents fix as suggestion, asks user
5. If confidence < 0.5 → escalation message:
   "This BSOD looks like it may need hardware inspection (RAM, disk, or driver).
    Please contact your local Desktop Support team to get this resolved.
    Error: 0xC000021A — Critical system process terminated."
6. Logs the event locally for next-boot reporting (no upload, just local audit log)
```

### Hardware-failure escalation copy (Ahmad's wording, locked):
> *"This will need to be looked at by Desktop Support as it may need replacement parts or reimaging. Please contact your local Desktop support team to get this resolved."*

---

## 5 · Architecture (4 layers)

```
+--------------------------------------------------------------+
|  L4 - BRAND LAYER                                            |
|  Gold globe, Cinzel/Inter, ARIA voice (existing TTS)         |
+--------------------------------------------------------------+
|  L3 - BACKEND (iisupp.net Netlify Functions - PULL-ONLY)     |
|  /aria-recipes        <- versioned KB recipes (signed)       |
|  /aria-stop-codes     <- Windows BSOD code lookup index      |
|  /aria-recipe-feedback (optional, opt-in, anon)              |
|  No user data EVER uploads from device                       |
+--------------------------------------------------------------+
|  L2 - BROWSER EXTENSIONS (Manifest V3)                       |
|  Chrome -> Edge -> Safari (bundled in macOS app, Sprint 2)   |
|  Service worker watcher + content-script globe               |
|  Localhost WebSocket -> desktop agent for OS-level fixes     |
+--------------------------------------------------------------+
|  L1 - DESKTOP AGENT (Electron, Windows-first)                |
|  Globe UI (transparent Electron window, Three.js globe)      |
|  Background watcher (Event Viewer, Reliability Monitor,      |
|   WMI, registry watchers, perf counters)                     |
|  Fix runner (PowerShell elevated, sandboxed)                 |
|  Local KB cache (SQLite, encrypted at rest)                  |
|  BSOD/WinRE integration (Tier A + Tier C above)              |
|  Tray icon + settings UI                                     |
|  System Restore point creation before risky fixes            |
+--------------------------------------------------------------+
```

See `05_architecture-diagram.svg` for the visual.

### Privacy guarantee — engineered, not promised
- **No upload paths exist in the binary.** Verifiable by network monitor.
- Only HTTP traffic: GET requests to `iisupp.net/.netlify/functions/aria-recipes?v=…` (recipe pulls) and `aria-stop-codes` (BSOD lookup table).
- Recipe pulls happen on a daily schedule; user-triggered "Update knowledge" button forces a pull.
- KB stored in encrypted SQLite at `%APPDATA%\AriaSentinel\kb.db`, key derived from machine-bound credential vault.
- Crash reports + telemetry: OFF by default. Opt-in toggle in settings.
- Open-source the privacy verification harness so customers (esp. enterprise) can audit it.

---

## 6 · UI surfaces to design (the actual work)

### High priority (MVP)
| # | Surface | Purpose | Reference mockup |
|---|---|---|---|
| 1 | Floating globe (5 states) | Always-on idle / listening / diagnosing / fixing / done | `02_globe-states.svg` |
| 2 | Fix card | Slides up from globe with detected issue + action | `03_fix-card.svg` |
| 3 | BSOD takeover screen | "ARIA — Solve it for me" recovery option | `04_bsod-takeover.svg` |
| 4 | Tray icon menu | Right-click options: pause / settings / quit / mode | (designer to draft) |
| 5 | Settings window | Mode selector, recipe categories, privacy verification, hotkeys | (designer to draft) |
| 6 | Installer flow | 4 steps: welcome → permissions → mode select → done | (designer to draft) |
| 7 | First-run permission prompts | UAC explanation, Windows defender warning explanation | (designer to draft) |
| 8 | Manual mode chat window | ARIA chat overlay invoked from globe | (designer to draft) |
| 9 | Browser extension globe (in-page) | Same gold globe overlaid on web pages | (designer to draft) |
| 10 | Recipe applied / done state card | Confirmation that fix worked | (designer to draft) |
| 11 | Escalation card (hardware failure) | "Contact Desktop Support" with copy from §4 | (designer to draft) |
| 12 | Landing page hero — `iisupp.net/aria-sentinel/` | Marketing + buy CTA | (designer to draft) |

### Medium priority (Sprint 4-5)
| 13 | Autonomous mode opt-in flow | Trust upgrade UX |
| 14 | Recipe transparency view | "Here's exactly what I did" log |
| 15 | Restore point indicator | "I created a System Restore point first" badge |
| 16 | Crash-recovery flow | What user sees after a BSOD |

### Low priority (Sprint 6+ polish)
| 17 | Edge-hugging globe demo | Animated GIF showing globe physics |
| 18 | Onboarding tour (4-5 cards) | First-time experience |
| 19 | Settings → Recipes tab | Per-recipe enable/disable |
| 20 | macOS adapter (Sprint 2) | macOS-specific UI parity |

---

## 7 · Globe motion specs

### Idle state
- Drift slowly along nearest edge (~10px per second)
- Slight bob (±3px vertical sine wave)
- Inner glow pulse: opacity 0.6 → 0.9 over 4s loop

### Cursor approach (mouse within 80px)
- Smoothly move along the edge AWAY from cursor (linear interp, ~200ms response)
- Stick to corners (corner-snap with 30% magnetism)
- Never move INTO the screen area — always remains on edges

### Diagnosing state
- Globe rotates at 2x speed
- Inner concentric circles pulse outward
- Small text below: "Diagnosing…" in Cinzel italic 11px

### Fixing state
- Globe rotation accelerates to 4x speed
- Particles emit upward in gold trails
- Inner glow intensifies (opacity 0.9 → 1.0)
- Optional sound: subtle "fff" whoosh (only if user enabled audio)

### Done state
- Single bright pulse (gold flash)
- Checkmark forms inside globe for 1.5s
- Returns to idle
- Fix card slides up from globe for confirmation

### Error/escalation state
- Globe inner glow shifts amber (#ffcb6b)
- Soft pulse pattern (slower than idle)
- Escalation card slides up — same template as fix card but with warning chip

---

## 8 · Build stages (sprint diagram — designer should visualize)

| Sprint | Title | Scope | Status |
|---|---|---|---|
| 0 | Backend foundations | `/aria-recipes` + `/aria-stop-codes` + recipe registry + KB expansion to ~150 codes | Ready to start |
| 1 | Windows + Chrome MVP | Electron app + 8 desktop detectors + 8 fixes + Chrome extension + 6 browser detectors + 6 fixes + globe UI + tray + BSOD Tier C detection | Sprint 0 must finish first |
| 2 | macOS port | Same Electron codebase, macOS-specific detectors + permissions UX | After Sprint 1 ships beta |
| 3 | Edge + Safari extensions | Manifest tweaks, Safari packaged into macOS app | Parallel with Sprint 2 |
| 4 | Autonomous mode + BSOD Tier A + safety guards | Restore point creation, recipe versioning, rollback, BCD boot entry | After v1 beta tested |
| 5 | Recipe expansion to 75+ | KB-agent autonomous improvement loop adds recipes | Continuous |
| 6 | Polish + animations + multi-monitor + DPI | Production hardening | Pre-launch |
| 7 | iOS Safari extension + Android (deferred) | After v1 ships and produces revenue | Not in this brief |

See `06_sprint-stages.svg` for the visual.

---

## 9 · Top 25 detection→fix recipes shipping in MVP

Designer doesn't need to design these individually but should know they exist for the Recipe tab UI.

**Desktop (Windows):**
1. DISK.FULL — clear temp + browser caches + downloads >30d
2. NET.DNS.FAIL — `ipconfig /flushdns` + adapter reset
3. NET.WIFI.DROP — disconnect/reconnect adapter
4. OUTLOOK.CRASH — clear OST + repair profile
5. PRINT.OFFLINE — restart Print Spooler service
6. WIN.UPDATE.STUCK — reset Windows Update components
7. SLOW.PC — identify top resource hog + suggest kill
8. BLUE.SCREEN — read minidump + match stop code → recipe (BSOD path above)
9. TEAMS.STUCK — clear Teams cache
10. ONEDRIVE.SYNC.STUCK — reset OneDrive (`onedrive.exe /reset`)
11. AUDIO.MUTE — restart audiosrv
12. BLUETOOTH.OFF — re-enable BT stack
13. VPN.DROP — reconnect last VPN profile

**Browser:**
14. CACHE.STALE — clear cache for current origin
15. COOKIE.JAR.STUCK — clear cookies for current origin
16. PASSWORD.RETRY.2 — clear saved password for domain after 2 failed attempts
17. SERVICE.WORKER.STUCK — unregister SW + hard reload
18. AUTOFILL.WRONG — clear autofill for domain
19. CERT.EXPIRED — diagnose device clock vs cert validity
20. MIXED.CONTENT — clear mixed-content state + reload
21. EXT.CONFLICT — identify conflicting extension + offer disable
22. TAB.HANG — kill + reopen tab preserving URL
23. ZOOM.WEIRD — reset per-origin zoom to 100%
24. AD.BLOCK.BREAK — offer whitelist current site
25. SLOW.LOAD — trace TTFB + diagnose DNS/network

---

## 10 · Presentation deck outline (designer to build)

**Internal alignment deck — 12 slides:**

1. Cover — ARIA Sentinel logo + tagline
2. The problem (4 stats: IT ticket volume, repeat issues, cost per ticket, user friction time)
3. The product in one sentence + globe screenshot
4. How it works (3 modes — Manual default, Confirmed, Autonomous)
5. The 4-layer architecture diagram
6. Privacy by engineering, not by promise
7. BSOD integration (the wow moment)
8. Top recipes (visual grid of 25)
9. Demo flow — install → first detection → fix → done
10. Pricing model (separate product, B2B-first)
11. Roadmap by sprint
12. CTA + contact (founder direct)

**Investor / customer demo deck — 16 slides:**
- All of above plus:
13. Market timing — why ambient agents now
14. Competitive landscape (no real competitors at this strict-privacy positioning)
15. Distribution strategy (direct download MVP → store listings later)
16. Pilot offer + booking link

---

## 11 · Landing page concept — `iisupp.net/aria-sentinel/`

**Hero:**
- H1: *"Resident IT support that never sleeps."*
- Sub: *"ARIA Sentinel lives on your Windows machine and fixes problems before they slow you down. Your data never leaves your device."*
- CTA: **[Download for Windows]** (gold pill, Cinzel) + small *"or book a 15-min demo"* link
- Hero visual: gold globe floating, fix card sliding up

**Sections:**
1. The 3 modes (Manual / Confirmed / Autonomous) — 3 cards
2. BSOD demo — animated mockup of recovery option
3. Privacy by engineering — verification path explanation
4. Recipe library — scrolling carousel of fix scenarios
5. For IT teams — GPO/MSI/SCCM deployment one-pager link
6. Pricing — single plan card (TBD)
7. FAQ — does it slow my PC, will it brick something, what about my data, etc.
8. Footer — security.txt, privacy verification harness, source-available privacy module link

---

## 12 · Engineering constraints the designer must respect

- **Electron is the runtime.** All UI is HTML/CSS/JS. SVG + Three.js for globe. Lottie for animations.
- **Maximum surface real estate the globe + card can occupy at once:** 320px × 200px (don't design wider chrome that can't render in the transparent overlay window).
- **Globe is click-through except its 80px hitbox.** Card region IS clickable.
- **DPI awareness:** all assets at 1×, 2×, 3× scales. Use SVG where possible.
- **Multi-monitor:** globe must position correctly. Card must not span monitors.
- **Light/dark:** **Dark only.** Globe theme is gold-on-black regardless of Windows theme.
- **No external CDN dependencies at runtime.** All assets shipped in the installer.
- **Animation budget:** total CPU/GPU usage of idle globe < 1% of a modern Intel laptop CPU. No 60fps continuous animation when idle — drop to 30fps after 5s of no activity.

---

## 13 · What the designer MUST NOT do

- Don't change the gold-on-black color system (matches existing iisupp.net brand)
- Don't use stock illustrations / icons — everything custom or from the existing iisupp.net library
- Don't add testimonials or 5-star ratings (Rule 7 — no fake proof, locked in our memory)
- Don't use the word "guarantee" / "money-back" / "risk-free" anywhere (Rule 7 also)
- Don't mention 21+ years of experience — only 15+ (Rule 5 — resume-honest)
- Don't include Raymond James anywhere (HARD rule)
- Don't include emojis in the product UI
- Don't make the globe distracting — it must feel calm, not chatty
- Don't ship without verification: every state mocked, every animation timed, every flow tested

---

## 14 · Deliverables checklist

- [ ] Figma file with components + tokens (color, typography, spacing, motion)
- [ ] 20 high-fidelity mockups (all surfaces in §6 plus presentation slides)
- [ ] Sprint-stage visualization (timeline, see `06_sprint-stages.svg` as starting reference)
- [ ] Architecture diagram (use `05_architecture-diagram.svg` as starting reference)
- [ ] Globe state library (use `02_globe-states.svg` as starting reference)
- [ ] Animated globe demo (Lottie JSON or MP4)
- [ ] Landing page hero mockup + 6 supporting sections
- [ ] Marketing one-pager (PDF, 1 page)
- [ ] Internal alignment deck (12 slides, Google Slides or Keynote)
- [ ] Customer/investor demo deck (16 slides)
- [ ] BSOD takeover screen mockup (use `04_bsod-takeover.svg` as starting reference)
- [ ] First-run installer flow mockups (4 screens)
- [ ] Globe edge-hugging behavior spec (motion timing, easing curves)

---

## 15 · Approval gate

Before any production design files are exported:

1. Designer ships v1 of all critical-priority mockups + animation specs
2. Ahmad reviews via the gated preview pattern (iisupp.net/preview/aria-sentinel-design)
3. Approved mockups become the source of truth — devs do not improvise
4. Each sprint references the approved Figma file at handoff

---

## 16 · Builder handoff after design

When design is approved, the build is split:
- **Backend (Cowork)** — Sprint 0 work, already started: `/aria-recipes`, `/aria-stop-codes`, KB expansion
- **Electron desktop app (Codex)** — Sprint 1-2 work
- **Browser extensions (Codex)** — Sprint 1-3 work
- **Recipe registry expansion (KB-agent)** — Sprint 5 continuous loop
- **Polish + animations (Cowork)** — Sprint 6

Each builder gets a packet referencing the Figma + this brief.

---

*End of brief.*

For questions or scope clarifications, contact Ahmad Wasee (ahmad.wasee@iisupp.net).

---

# PART 5 · THE 25 MVP RECIPES (DETAILED — Codex implements each)

## Desktop recipes (Windows)

### R-01 · DISK.FULL
- **Detector:** WMI `Win32_LogicalDisk.FreeSpace < 5% of Size` on C:
- **Risk:** green
- **Recipe:** Clear `%TEMP%`, clear browser caches (Chrome / Edge / Firefox via the registered paths), clear Downloads folder files older than 30 days *— only after per-item user confirm*, suggest OneDrive Files On-Demand
- **Snapshot required:** no
- **Reboot required:** no
- **Confidence base:** 0.92
- **Failure mode:** none — recoverable, all actions reversible from Recycle Bin
- **User-facing copy:** `COPY.disk_low_proactive('C:', 'Downloads')` — shows top offender by size

### R-02 · NET.DNS.FAIL
- **Detector:** Sustained DNS resolution > 3s over 30s window (perf counter)
- **Risk:** green
- **Recipe:** `ipconfig /flushdns` + `ipconfig /registerdns` + `Restart-Service Dnscache`
- **Snapshot required:** no
- **Reboot required:** no
- **Confidence base:** 0.88

### R-03 · NET.WIFI.DROP
- **Detector:** `Get-NetAdapter` Wi-Fi adapter state change to disconnected
- **Risk:** green
- **Recipe:** `netsh wlan disconnect` + `netsh wlan connect name=<last_profile>` (profile is enum, never user-supplied string)
- **Snapshot required:** no
- **Reboot required:** no
- **Confidence base:** 0.78

### R-04 · OUTLOOK.CRASH
- **Detector:** WER report match: AppCrash on outlook.exe within 60s, OR Event Log Application 1000 with FaultingApplication=OUTLOOK.EXE
- **Risk:** yellow
- **Recipe:** Close Outlook, rename OST file (don't delete), restart Outlook to rebuild profile
- **Snapshot required:** yes (rename = reversible)
- **Reboot required:** no
- **Confidence base:** 0.72

### R-05 · PRINT.OFFLINE
- **Detector:** Print Spooler service state = stopped OR queued jobs > 5 for > 10min
- **Risk:** green
- **Recipe:** `Restart-Service Spooler -Force`
- **Snapshot required:** no
- **Reboot required:** no
- **Confidence base:** 0.85

### R-06 · WIN.UPDATE.STUCK
- **Detector:** `Get-WindowsUpdateLog` or COM `Microsoft.Update.Session` reports same update pending > 7d
- **Risk:** yellow
- **Recipe:** Stop wuauserv + bits + cryptsvc + msiserver; rename SoftwareDistribution + catroot2; restart services
- **Snapshot required:** yes
- **Reboot required:** no (usually)
- **Confidence base:** 0.70

### R-07 · SLOW.PC
- **Detector:** CPU sustained > 85% for 5min OR RAM committed > 90% for 5min
- **Risk:** yellow (asks before killing anything)
- **Recipe:** Identify top resource hog process; offer to kill it (per-item user confirm; never autonomous)
- **Snapshot required:** no (kill is reversible — relaunch app)
- **Reboot required:** no
- **Confidence base:** 0.62

### R-08 · BSOD.* (covers all stop codes via the lookup table)
- **Detector:** Tier C — registry `HKLM\SYSTEM\CurrentControlSet\Control\CrashControl\LastBSODTimestamp` + `C:\Windows\Minidump\*.dmp` newer than agent's last-known-good boot
- **Risk:** red
- **Recipe:** Parse minidump header (metadata only — stop code + faulting module name). Look up `aria-stop-codes` local cache. If `confidence >= 0.8`, present recipe via Confirmed-mode card. If `confidence < 0.5`, show escalation card with locked copy.
- **Snapshot required:** yes
- **Reboot required:** yes (often)
- **Confidence base:** per stop code
- **Escalation copy (verbatim-locked):** *"This will need to be looked at by Desktop Support as it may need replacement parts or reimaging. Please contact your local Desktop support team to get this resolved."*

### R-09 · TEAMS.STUCK
- **Detector:** Teams.exe high CPU > 80% sustained 3min OR error dialog title match
- **Risk:** green
- **Recipe:** Kill Teams processes, clear `%APPDATA%\Microsoft\Teams\Cache` + `\blob_storage` + `\databases` + `\GPUCache` + `\IndexedDB`, relaunch Teams
- **Snapshot required:** no
- **Reboot required:** no
- **Confidence base:** 0.86

### R-10 · ONEDRIVE.SYNC.STUCK
- **Detector:** OneDrive icon overlay = stuck/red, OR sync queue > 100 items unchanged for > 30min
- **Risk:** yellow
- **Recipe:** `onedrive.exe /reset` then relaunch
- **Snapshot required:** yes (reset is reversible — re-sync repopulates)
- **Reboot required:** no
- **Confidence base:** 0.74

### R-11 · AUDIO.MUTE (no sound from any app)
- **Detector:** All audio devices report 0 output AND `audiosrv` service running, OR `audiosrv` stopped
- **Risk:** green
- **Recipe:** `Restart-Service Audiosrv -Force` + `Restart-Service AudioEndpointBuilder -Force`
- **Snapshot required:** no
- **Reboot required:** no
- **Confidence base:** 0.80

### R-12 · BLUETOOTH.OFF (unexpectedly)
- **Detector:** BT radio state change to off without user action (no UI input within 10s)
- **Risk:** green
- **Recipe:** Re-enable BT stack via `bthserv` service restart
- **Snapshot required:** no
- **Reboot required:** no
- **Confidence base:** 0.72

### R-13 · VPN.DROP
- **Detector:** VPN adapter state change to disconnected without user action
- **Risk:** green
- **Recipe:** Reconnect last-used VPN profile via `rasdial <profile>`
- **Snapshot required:** no
- **Reboot required:** no
- **Confidence base:** 0.70

## Browser recipes (Chrome / Edge / Safari)

### R-14 · CACHE.STALE
- **Detector:** Repeated 4xx after 200 in 10min window for same origin
- **Risk:** green
- **Recipe:** `chrome.browsingData.removeCache({ origins: [origin] })` + hard reload
- **Confidence base:** 0.85

### R-15 · COOKIE.JAR.STUCK (login loop)
- **Detector:** 3+ redirect cycles within 60s on same origin
- **Risk:** green
- **Recipe:** `chrome.browsingData.removeCookies({ origins: [origin] })` + reload
- **Confidence base:** 0.80

### R-16 · PASSWORD.RETRY.2
- **Detector:** 2 consecutive failed form submits on same origin (content-script form listener tracks submit count only, never values)
- **Risk:** yellow (asks)
- **Recipe:** "I see you're having trouble logging in. Want me to clear the saved password for this site and you can try with the current one?" → on yes, `chrome.passwords.deleteCredential({ origin })`
- **Confidence base:** 0.75

### R-17 · SERVICE.WORKER.STUCK
- **Detector:** Service worker activation timeout > 30s
- **Risk:** green
- **Recipe:** Unregister SWs for current origin + hard reload bypass cache
- **Confidence base:** 0.82

### R-18 · AUTOFILL.WRONG
- **Detector:** User corrects autofilled form fields > 2 times in 10min on same origin
- **Risk:** yellow (asks)
- **Recipe:** Clear autofill entries for current domain
- **Confidence base:** 0.65

### R-19 · CERT.EXPIRED (NET::ERR_CERT_DATE_INVALID)
- **Detector:** webNavigation.onErrorOccurred with cert-related error code
- **Risk:** yellow
- **Recipe:** Diagnose device clock vs cert validity. If clock wrong, offer to sync via `w32tm /resync`. If cert genuinely expired on site side, surface advisory ("not safe to bypass — try again later or contact site owner")
- **Confidence base:** 0.78

### R-20 · MIXED.CONTENT (warning persists)
- **Detector:** Mixed-content warning event + user has reloaded > 2 times
- **Risk:** green
- **Recipe:** Clear mixed-content state for origin + reload
- **Confidence base:** 0.70

### R-21 · EXT.CONFLICT
- **Detector:** Page fails to load AND user has > 3 extensions enabled
- **Risk:** yellow (asks)
- **Recipe:** Walk through binary-search disable: disable half, reload, narrow down. Suggest disable on conflict identified.
- **Confidence base:** 0.55 (lower → asks Manual-mode walkthrough)

### R-22 · TAB.HANG
- **Detector:** Tab unresponsive for > 30s
- **Risk:** green
- **Recipe:** Kill tab process + reopen URL in new tab
- **Confidence base:** 0.82

### R-23 · ZOOM.WEIRD (per-origin zoom out of range)
- **Detector:** Per-origin zoom < 50% or > 200% AND user just landed
- **Risk:** green
- **Recipe:** Reset zoom to 100% for current origin
- **Confidence base:** 0.85

### R-24 · AD.BLOCK.BREAK (site broken by ad-blocker)
- **Detector:** Site detection event + console errors mentioning ad-blocker hostnames
- **Risk:** green
- **Recipe:** Offer "Whitelist this site temporarily?" → flip via extension API
- **Confidence base:** 0.65

### R-25 · SLOW.LOAD
- **Detector:** TTFB > 5s consistently for current origin
- **Risk:** green
- **Recipe:** Trace DNS / TCP / TLS handshake to identify slow stage; surface diagnosis; offer DNS flush
- **Confidence base:** 0.60

---

# PART 6 · DESIGN VISUAL REFERENCES

These SVG mockups live in the repo at `outputs/aria-sentinel-design-handoff/`. Codex: open them, use them as visual ground truth for UI implementation. All renderable in any browser or SVG viewer.

| File | What it shows |
|---|---|
| `02_globe-states.svg` | The 5 globe states (idle/listening/diagnosing/fixing/done) with motion specs |
| `03_fix-card.svg` | The fix card UI in 4 variants (detected/fixing/done/escalation) |
| `04_bsod-takeover.svg` | The BSOD recovery screen with "ARIA — Solve it for me" option styled in gold |
| `05_architecture-diagram.svg` | The 4-layer system architecture |
| `06_sprint-stages.svg` | The 7-sprint timeline + AI-hour estimates |
| `07_user-flow.svg` | The linear user journey from install to first fix + BSOD edge lane |

---

# PART 7 · SPRINT-BY-SPRINT PLAN

## Sprint 0 · Backend extensions (you start here; no dependencies)

- [ ] Extend `netlify/functions/aria-pattern-router.mjs` DOMAINS + state encoder: dictionary from 51 → 150 codes covering all 25 MVP recipes
- [ ] Mirror dictionary in `apps/sentinel-desktop/src/recipes/symbolic-state-dictionary.ts`
- [ ] Extend `netlify/functions/aria-recipes.mjs` with all 25 MVP recipes (full schema per spec)
- [ ] Extend `netlify/functions/aria-stop-codes.mjs` with top 25 Windows stop codes
- [ ] Ship `netlify/functions/aria-kb-bundle.mjs` (signed local-cache zip endpoint)
- [ ] Ship `netlify/functions/aria-recipe-feedback.js` (opt-in only, signature-only schema, rejects anything outside)
- [ ] Ship `netlify/functions/aria-binary-update.mjs` (staged auto-update manifest)
- [ ] Bake Sentinel Stripe price IDs (`sentinel_personal_m`, `sentinel_personal_y`, `sentinel_business_y`) into `stripe-checkout.js` PRICE_MAP — env var override fallback per Rule 10
- [ ] Add Sentinel product entries to `assets/iis-catalog.js` + `plans/index.html` (new tiers, NOT bundled with existing ARIA tiers)
- [ ] Update `scripts/stripe-setup.mjs` with new SENTINEL section so Ahmad can create the Stripe products in one run; baked-in price IDs become fallback when env vars are unset
- [ ] Confirm content-blind on every new endpoint via CI test that POSTs PII and asserts 400

## Sprint 1 · Windows + Chrome MVP (the heart of the build)

- [ ] Scaffold `apps/sentinel-desktop/` as Electron app (Node 20, Electron 30+, TypeScript strict, Vite or Webpack)
- [ ] Implement `apps/sentinel-desktop/src/safety/sanitize.ts` — THE compliance function (spec §G-1). Pure, no I/O. Reuse `_pii-redact.js` logic
- [ ] Implement `apps/sentinel-desktop/src/safety/ephemeral-buffer.ts` — `EphemeralBuffer<T>` per spec §G-2
- [ ] Implement `tests/sentinel/content-leak.spec.ts` as CI release gate (spec §O-1) with 10,000 fuzzed inputs. Add to `.github/workflows/ci.yml` (if PAT lacks workflow scope, ship to outputs/ + tell Ahmad to paste)
- [ ] Implement `tests/sentinel/policy-injection.spec.ts` as CI release gate
- [ ] Implement orchestrator + 6 sub-agents per spec §B-2:
  - `src/orchestrator/index.ts`
  - `src/sub-agents/detection/` (event-log + WMI + perf + WER + reliability-monitor + crashcontrol + sc + net-adapter)
  - `src/sub-agents/diagnosis/` (signal-to-symbolic + confidence + KB lookup)
  - `src/sub-agents/remediation/` (PowerShell runner + snapshot + verify + rollback + idempotency)
  - `src/sub-agents/health/` (proactive disk + startup + temp cleanup + pending updates)
  - `src/sub-agents/communication/` (globe + fix card + chat + announce-before-act + reboot consent)
  - `src/sub-agents/ticketing/` (ServiceNow + IIS + graceful offline)
- [ ] Wire 8 desktop detectors + 8 fixes (R-01 through R-08 above)
- [ ] Implement floating globe UI per `02_globe-states.svg`:
  - Three.js + transparent Electron window
  - Click-through except 80px hitbox
  - Edge-hugging physics + cursor evasion
  - 5 states with motion specs from design brief
- [ ] Implement fix card UI per `03_fix-card.svg` (4 variants)
- [ ] **Manual mode default at install** (locked per spec §B-3)
- [ ] Tray icon + right-click menu (Pause 1h/24h/until-reboot · Mode select · Settings · Quit)
- [ ] 4-step installer (welcome → permissions explainer → mode select → done)
- [ ] BSOD Tier C (crash-on-resume) detection — always-on, no system modification
- [ ] Snapshot-before-change + auto-rollback per spec §E-2
- [ ] Tamper-evident hash-chained audit log per spec §I-1
- [ ] ServiceNow + IIS ticket connectors per spec §H + graceful offline
- [ ] Privacy verifier UI in settings per spec §G-7
- [ ] Scaffold `apps/sentinel-extension-chromium/` Manifest V3
- [ ] Wire 6 browser detectors + 6 fixes (R-14 through R-19 above)
- [ ] In-page globe in extension content script
- [ ] Localhost mTLS WebSocket bridge between extension and desktop agent

## Sprint 2 · macOS port

- [ ] Same Electron codebase. Add `src/watchers/macos/`:
  - `log stream` for system log
  - Crash reports in `~/Library/Logs/DiagnosticReports/`
  - NSWorkspace notifications via FFI
- [ ] macOS permissions UX flow: Full Disk Access + Accessibility (System Settings deep links)
- [ ] Code-sign via Apple Developer ID (Ahmad buys when this sprint starts; until then sign ad-hoc + warn in installer)

## Sprint 3 · Edge + Safari extensions

- [ ] Edge: ship Chrome bundle to Edge Add-ons (same code, Manifest V3 tweaks)
- [ ] Safari: bundle inside macOS app, Apple notarization
- [ ] Add R-20 through R-25 browser recipes

## Sprint 4 · Autonomous mode + BSOD Tier A + safety hardening

- [ ] Autonomous mode opt-in flow per spec §B-3 + design brief Section 3
- [ ] BSOD Tier A: installer adds BCD entry via `bcdedit /create` per spec §C-5
- [ ] Restore point creation enforced on every yellow/red recipe
- [ ] Per-recipe rollback path tested
- [ ] Cross-fleet rate limiting on backend (spec §E-4: per-recipe 5% fleet/hour cap)
- [ ] Per-endpoint / per-customer / global kill switches per spec §E-5
- [ ] Recipe circuit breaker on backend (`recipe-circuit-breaker.mjs`)

## Sprint 5 · Recipe expansion to 75

Add 50 more recipes covering:
- AUDIO.MUTE, BLUETOOTH.OFF, VPN.DROP (R-11, R-12, R-13 if not done in Sprint 1)
- ONEDRIVE.SYNC.STUCK (R-10 if not done)
- All common Windows event log error families
- Top 50 Stack Overflow tech-support patterns Ahmad's customers would hit
- Each recipe: detector wiring + fix script + snapshot/rollback test + idempotency test + content-leak test pass

## Sprint 6 · Polish to v1.0

- [ ] Lottie animations on fix-applied state per design package
- [ ] DPI-aware rendering across 100/125/150/200% Windows scaling
- [ ] Multi-monitor globe positioning
- [ ] Low-power mode toggle per spec §J-6
- [ ] Onboarding tour (4 cards) per design
- [ ] Customer audit dashboard scaffold at `iisupp.net/sentinel-admin/`
- [ ] Final docs at `iisupp.net/aria-sentinel/docs/`
- [ ] v1.0 release notes, SBOM, security disclosure addendum

---

# PART 8 · LAUNCH-BLOCKERS (must-ship-in-v1 list)

In priority order from spec §S — DO NOT defer any of these:

1. Content-blind telemetry collectors
2. `sanitizeToSignature()` + `EphemeralBuffer<T>` + content-leak test gate
3. Announce-before-act + save prompt + reboot consent + persistent visible indicator
4. Sub-agent orchestrator with mediated, JIT, logged privilege escalation
5. Deny-by-default `ALLOWED_ACTIONS` allow-list with `autonomous_capable: false` ceiling
6. Snapshot-before-change + auto-rollback + idempotency
7. Customer KB/PolicyOverlay containment + parser as gate
8. Immutable, tamper-evident, content-free audit log + per-action explainability
9. Per-endpoint / per-customer / global kill switches
10. Control / data plane separation + async durable execution queue
11. Tenant isolation at backend + encryption in transit/at rest + secrets management
12. Signed agent binary + secure staged auto-update channel (halt-able)
13. End-user consent capture + jurisdiction-aware wording
14. Confidence threshold → escalate, don't guess
15. ServiceNow ticketing + IIS internal sync + graceful offline
16. BSOD Tier C (crash-on-resume) detection + locked escalation copy
17. BSOD Tier A (BCD boot menu entry) + recovery binary scaffold
18. Manual mode as default at install + 3-mode selector
19. Free Manual tier + paid Confirmed/Autonomous tier via baked Stripe SKUs
20. Privacy verifier UI in settings

---

# PART 9 · TESTING / CI GATES (all green to merge)

Every PR must pass:
- TypeScript strict
- Lint (ESLint + Prettier)
- Unit tests
- Integration tests
- **Content-leak test ← BLOCKER** (10,000 fuzzed inputs; no canary phrase reaches network/disk/log)
- **Policy-injection test ← BLOCKER** (attempt to make uploaded customer KB grant new powers; parser must silently strip)
- **Idempotency + rollback test ← BLOCKER** (per recipe touched in PR)
- SAST (CodeQL)
- Dependency scan (Dependabot or Snyk)
- License scan
- Secret scanning

Test pyramid weight: heaviest on detect→diagnose→remediate→rollback. Chaos / fault injection on critical remediation paths. Staging mirrors prod; remediation never tested first in prod.

---

# PART 10 · PR + COMMUNICATION PROTOCOL

- Work on feature branches per sprint (e.g. `sprint-1-mvp`, `sprint-2-macos`)
- Commit early + often. Push every working state.
- One PR per logical chunk (orchestrator, sanitizer, content-leak test, globe UI, etc). Keep PRs under 500 lines where possible.
- Cowork reviews + approves PRs. If Cowork doesn't reply in 24h and CI is green → merge.
- If anything in this spec is ambiguous to you: append a clarification question to `docs/COLLAB_BRIEF.md` instead of guessing. Cowork picks it up within ~hour.
- Update `docs/ARIA-SENTINEL-CODEX-SPEC.md` change log (§Y) when you complete a sprint.
- Use heredoc + Python in `/tmp/iisupp-push-cowork` clone for any edit to a >1000-line HTML file (mount-truncation risk per `feedback_edit_tool_truncates_index_html.md`).

---

# PART 11 · WHAT AHMAD MUST DO (only these — surface to him when each gates ship)

1. **After Sprint 1 MVP shipped + internal test passed:**
   - Buy Microsoft Authenticode EV cert (~$300/yr, Comodo or DigiCert, 1-3 day verification). You drive the form via browser-prefill (memory rule `feedback_browser_prefill_for_ahmad`). He clicks submit.

2. **Before Sprint 2 (macOS) ships:**
   - Buy Apple Developer ID ($99/yr). Same prefill pattern.

3. **At store-listing time (after Sprint 6 polish):**
   - Approve Chrome Web Store submit, Microsoft Partner Store submit, Apple App Store submit. You drive each session; he clicks submit.

4. **For pilot customers:**
   - Introduce them by name; you handle onboarding via existing iisupp.net pilot flow.

**Don't ask Ahmad anything else.** Anything else: ship it via commit.

---

# PART 12 · START HERE

1. Read PART 1 (mandate). 90 seconds.
2. Read PART 2 (10 standing rules). 2 minutes.
3. Read PART 3 (spec §0 through §Y — full source of truth). 30-45 minutes — do it carefully.
4. Skim PART 4 (design brief). Cross-reference SVG mockups.
5. Read PART 5 (25 recipes detail). Tag the 8 desktop + 6 browser ones for Sprint 1.
6. Open `docs/COLLAB_BRIEF.md` and append a line: `Codex picked up the ARIA Sentinel spec YYYY-MM-DD`. This signals Cowork you're live.
7. Branch `sprint-0-backend`. Execute Sprint 0 from PART 7.
8. Branch `sprint-1-mvp`. Execute Sprint 1 from PART 7.
9. Ship Sprint 1 to Ahmad for internal test before Sprint 2.
10. Iterate. Sprints 2-6 in order.

---

# PART 13 · CONTACT / ESCALATION

- **Ahmad:** ahmad.wasee@iisupp.net (founder, only one with checkbook)
- **Cowork:** runs in this same repo; check `docs/COLLAB_BRIEF.md` for live status
- **Slack #aria-sentinel:** created by Ahmad's onboarding cron when first customer pilots
- **Bug bounty:** `/.well-known/security.txt` on iisupp.net

---

# PART 14 · ANTI-SOFTENING ENFORCEMENT (Ahmad's note to Cowork — applies equally to you)

> *"Watch that it doesn't quietly soften the two Section-0 rules when it sees the existing web code, since the web ARIA wasn't built under the content-blind constraint. If the output treats 'read the screen' casually or lets the solution-lookup ship raw error strings, push it back on that — that boundary is the difference between a millions-dollar asset and a liability, and it's the one thing most likely to get watered down in translation."*

When you encounter any pattern in the existing iisupp.net codebase that takes raw user text (e.g. `aria-chat.js` takes user-typed strings directly) — **DO NOT** reuse that pattern for Sentinel. The web ARIA is a different surface with different consent semantics. Sentinel's L1↔L3 channel carries only `Signature` objects (`{code, family, confidence, os_version}`). The content-leak test will catch you if you slip; build it first so you can't slip.

---

# END OF PACKAGE

Total: ~2,300 lines including all inlined parts. This is everything. No other file is required to start coding.

If you have read this far and understand: branch `sprint-0-backend`, append a `Codex picked up ARIA Sentinel spec YYYY-MM-DD` line to `docs/COLLAB_BRIEF.md`, and start shipping.

GO.
