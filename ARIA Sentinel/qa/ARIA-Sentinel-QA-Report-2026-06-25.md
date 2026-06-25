# ARIA Sentinel — QA Test Report
**Integrated IT Support Inc. · Desktop AI IT-Support Agent**

| | |
|---|---|
| **Report date** | 2026-06-25 |
| **Build under test** | `main` @ commit `31c8872` (deep-link + web-handoff merge) |
| **Test runtime** | Node v22.22.3 (automated layer, Linux CI sandbox) |
| **QA lead** | Cowork (Claude) — independent QA pass |
| **Status** | **Stage 1 of 2 complete** — automated + code-grounding done; live on-device pass pending |

> **Integrity statement.** Every figure in this report is from a real, reproducible test run on the commit named above. No result is estimated, carried over from a prior doc, or fabricated. Where a test could not be run, it is marked **NOT-TESTED** with the reason — never counted as a pass. This standard exists because this report is intended to support enterprise and government sales, where a single fabricated metric is a disqualifying liability.

---

## 1. Executive summary

ARIA Sentinel's **safety and privacy core is strong and verified**: 188/188 automated suites pass, and **zero data leaks** were found across ~12,700 adversarial/fuzz inputs. The three operating modes, kill-switch, restore points, dry-run gating, and the code-defined action allow-list are implemented as designed and enforced in code.

**One Critical issue blocks a "client-ready" verdict today:** the product's advertised **98.64%** intent-classification accuracy is a *stale, hard-coded figure*. A fresh run of the current classifier scores **91.8%**, and one intent (`kb:active-directory`) scores **49%**, violating the project's own stated "no intent below 50%" gate. The accuracy claim must be corrected and the regression fixed before the number is used in any sales material.

**Verdict: NOT YET client-ready.** Estimated 1 Critical + 1 High must-fix, plus the live on-device validation pass, stand between this build and a paying enterprise/government customer. None are architectural — the foundation is sound.

---

## 2. Phase status

| Phase | Scope | Status |
|---|---|---|
| **1 — Pre-flight / smoke** | App wiring, KB load, logger, backend contracts | ✅ Automated PASS · ⏳ live launch pending |
| **2 — Three modes** | Manual / Confirm / Autonomous disposition + isolation | ✅ Logic PASS (test-3-modes 5/5, mode-error-matrix 13×3) · ⏳ live pending |
| **3 — Scenario L1–L3** | Detection + routing across ticket spectrum | ⚠️ Logic PASS (167-scenario battery + 21 detectors) but classifier accuracy regressed (see §4) · ⏳ live "clueless user" runs pending |
| **4 — Privacy & safety gates** | Content-blindness, sanitization, allow-list, escalation | ✅ PASS — 0 leaks / ~12,700 inputs |
| **5 — Live on this machine** | Real faults on the installed app, all 3 modes | ⏳ NOT STARTED — requires your go-ahead to act on your endpoint |

---

## 3. Automated results (real, this build)

| Suite / harness | Total | Pass | Fail | Covers |
|---|---|---|---|---|
| `tests/run-all.mjs` (188 suite files) | 188 | **188** | 0 | Full battery; honest runner (exit 1 on any red) |
| `scripts/test-3-modes.mjs` | 5 | 5 | 0 | Manual/Confirm/Autonomous dispositions |
| `scenario-battery` (inside run-all) | 167 | 167 | 0 | L1–L3 scenario routing |
| `windows-error-sweep` | 21 | 21 | 0 | Windows fault detectors |
| `mode-error-matrix` | 13×3 | pass | 0 | Each fault behaves correctly per mode |
| `overlay-physics` | 8,000 ticks | pass | 0 | UI overlay stability |
| **Privacy battery** | 10,000 fuzz | **0 leaks** | — | Content-blindness |
| Content-leak fuzz | 1,500 | 0 leaks | — | Sanitization to symbolic codes |
| Windows + macOS watchers fuzz | 1,200 | 0 leaks | — | Signal-only watching |
| Policy-injection | 52 attempts | **52 stripped** | 0 | Allow-list cannot be expanded by ingested text |
| **Classifier — mega corpus (fresh run)** | **332,163** | **304,955 (91.8%)** | 27,208 | Web /aria intent routing accuracy |

**Privacy aggregate: ~12,700 adversarial inputs → 0 leaks.**

---

## 4. Bugs & findings (ranked)

### 🔴 CRITICAL
**C-1 — Classifier accuracy is misrepresented; live accuracy is 91.8%, not 98.64%; one intent fails the project's own floor.**
- Fresh, deterministic run of `run-mega-scenarios.js` on this build: **91.8% (304,955/332,163)**.
- The advertised **98.64%** is a **hard-coded string** read from `docs/aria-web-159k-results.md` (2026-06-23); the tester (`iis-tester-agent` check ACC-1) does **not** recompute it.
- **`kb:active-directory` = 49% (1,875/3,810)** — below the project's stated "HARD STOP: any intent <50%". Example: *"account locked in ad"* → `password` instead of `kb:active-directory`.
- Other sub-90% intents: `default` 87%, `kb:m365` 85%, `resolution` 85%, `escalation` 84%.
- **Impact:** the 98.64% figure cannot be used in any proposal, datasheet, or demo until it reflects a real current measurement. **Repro:** `node tests/run-mega-scenarios.js` on `31c8872`.
- **Owner:** Claude Code (queued, task `Q-QA1`).

### 🟠 HIGH
**H-1 — Self-reported accuracy is not self-measuring.** Because ACC-1 prints a stored number rather than recomputing, the product's own dashboards/tests can show "98.64% ✓" while the classifier silently regresses. Any accuracy surfaced to a customer must be computed at test time. (Queued, `Q-QA1`.)

### 🟡 MEDIUM
**M-1 — Resilience check tests a non-existent path.** `iis-tester` `CHAOS-1` references `ARIA Sentinel/src/main.js`; the real entry is `src/main/main.mjs`, so the check passes vacuously. (Queued, `Q-QA1`.)
**M-2 — No per-intent test traceability.** `REGEN-1`: 0 of 69 classifier intents map to a named regression test — coverage exists but isn't auditable per intent (a gap a gov auditor will ask about). (Queued, `Q-QA1`.)

### 🟢 LOW
**L-1 — Online probes unverified locally.** Security-headers, latency, hallucination-refusal, and jailbreak checks (SEC-1/PERF-1/HALL-1/JAIL-1) require live calls to `iisupp.net` and were correctly skipped in the sandbox. To be run in the live pass.

---

## 5. Privacy & safety gate verdict (release-blocking section)

| Gate | Verdict | Evidence |
|---|---|---|
| Reads error signals only — never screen/keystrokes/file contents | ✅ **No leak** | 10,000-input privacy battery + watcher fuzz → 0 leaks; `path-guard.mjs` blocks the private folder, surfaced only as "1 personal folder excluded" |
| Outbound queries sanitized to technical signatures | ✅ **No leak** | `sanitizeToSignature` / `assertContentSafePayload`; network-capture + telemetry + event-log suites symbolic-only |
| No autonomous action outside the code/config allow-list | ✅ **Held** | `catalog.mjs` is the single source; `TIER0_DENY` hard-blocks format/diskpart/bcdedit/reg/del; 52/52 injection attempts stripped |
| Ingested text treated as data, never instruction | ✅ **Held** | policy-injection suite — allow-list stays code-defined under attack |
| Low-confidence faults escalate, not guess | ✅ **By design** | `KB_CONFIDENCE_MIN = 8`; escalation drafted only after ≥3 failed Tier-0 attempts |
| Every fix + interaction captured in the ticket | ✅ **By design** | content-blind ServiceNow draft; full logger path |

**Did any user data leak? NO** (0 / ~12,700 inputs). **Did any action run outside the allow-list? NO.** **Did ARIA over-reach on L3 in automated tests? NO** (web-originated/deep-link actions are force-clamped to Confirmed; Autonomous requires explicit opt-in). *L3 over-reach under live conditions is still to be confirmed in Phase 5.*

---

## 6. How the design is implemented (grounding)

- **Modes** — `src/shared/autonomous.mjs` + `main.mjs:3002`. Autonomous can never enable silently (opt-in modal `{understood:true}`).
- **Safety pipeline** — `main.mjs:1831`: R11 → supervisor critic → vetted-tier dry-run policy → 10s countdown (`action-countdown.mjs`) → dry-run-gated executor. Kill-switch `Ctrl+Alt+K` (`kill-switch.mjs`, `main.mjs:548`); restore point `main.mjs:817`; Autonomous cap 3/recipe/24h + 30-min cooldown + fleet rate-limit.
- **Deep-link** — `main.mjs:184` + `deep-link.mjs`: only `aria-sentinel://resolve?recipe=<known-id>&intent=<text>` actioned; foreign schemes rejected; web actions clamped to Confirmed.
- **Privacy boundary** — `aria-brain-client.mjs` + `safety.mjs` + `path-guard.mjs`: KB-first ($0) → LLM only on no-match/low-confidence/timeout; `scrubR11` on replies.
- **Allow-list** — `recipes/tier-0/catalog.mjs`: 20 recipes, `dryRunDefault:true`, no `shell:true`, no `eval`, never deletes user documents.

---

## 7. Not tested (and why) — to complete in Stage 2

- **Live Electron runtime / GUI / real recipe execution on Windows** — automated layer validates logic/wiring, not a launched app executing PowerShell on a real host. → Phase 5 live pass.
- **Online production probes** (security headers, latency, hallucination, jailbreak) — need authorized live calls to `iisupp.net`. → Phase 5.
- **158k KB scenario set (specifically)** — the 332k mega corpus ran (91.8%); the dedicated 158k KB set is queued for a fresh recorded run (`Q-QA1`).
- **Full scenario × 3-mode LIVE matrix** ("clueless user" end-to-end) — see `coverage-matrix.md`; logic-tested, live pending.

---

## 8. Must-fix before "client-ready: YES"

1. **Fix C-1:** re-run the 158k KB + 332k corpora, record the REAL number, replace every hard-coded 98.64%, and raise `kb:active-directory` above the 50% floor (target ≥95% overall). *(CC, `Q-QA1`.)*
2. **Fix H-1:** make any surfaced accuracy compute at test time.
3. **Complete Phase 5** live on-device pass across L1/L2/L3 × 3 modes, including the privacy gates under live conditions and L3 escalation (destructive L3 simulated only).
4. Then re-issue this report as **v1.0 Final** with the live matrix filled in.

*Stage-1 verdict: foundation sound, safety strong, one accuracy misrepresentation must be fixed. Not yet sellable as-is; close after C-1 + the live pass.*
