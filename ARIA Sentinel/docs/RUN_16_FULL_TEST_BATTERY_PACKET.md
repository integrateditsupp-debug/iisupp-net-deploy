# RUN 16 · Full-Spectrum Test Battery — Debug · QA · Behavior · Security · Privacy · Compliance · Legal · Audit (~8hr)

> Comes AFTER RUN 15 (self-heal + globe v3 + ARIA-brain). RUN 16 proves the entire v1.0 RC + RUN 15 hardening with a complete test universe across 12 dimensions. **No green = no v1.0 publish.**

## Pre-read
- docs/RUN_15_REPORT.md (just-shipped state)
- docs/RUN_15_QA_FINDINGS.md (Cowork's live observations)
- docs/PRIVACY_AND_SECURITY.md (RUN 1-3 privacy invariants)
- docs/ENTERPRISE_READINESS.md (current 9.9 score)
- docs/COMPETITIVE_LANDSCAPE.md (parity reference)
- src/shared/network-capture.mjs (privacy verifier — 6-host runtime + 2-3 update paths)

═══════════════════════════════════════════════════════════════
## §1 · Test universe (12 dimensions)
═══════════════════════════════════════════════════════════════

Every dimension MUST produce a green test suite. Reports written to docs/RUN_16_TEST_RESULTS_<dimension>.md.

### A · Debug battery
- Inject deliberate faults into each of: every IPC channel · every watcher · every recipe · every preload binding · every Settings tab handler
- Self-heal engine (RUN 15) MUST detect & recover OR escalate within one cycle
- Asserts: 0 silent failures · every fault produces a report

### B · QA battery
- Every button: assert click → expected state change within 2s
- Every tab: assert content renders without console.error
- Every recipe: dry-run succeeds + restore-point taken
- Every Hotkey: globalShortcut.isRegistered === true
- 47-item button/tab inventory in `tests/qa-inventory.json` — every entry must pass

### C · User behavior battery
- Simulated user journeys (Playwright-style headless):
  1. First-launch → trial starts → see globe → ask ARIA "outlook wont open" → recipe surfaces → dry-run → done
  2. 12h trial expiry → buttons disabled → plan-picker modal → Stripe portal opens in browser
  3. License entry → modal accepts valid HMAC key → unlocks
  4. Mode switch Manual → Autonomous → globe behavior changes (always-on-top)
  5. Stop ARIA → globe vanishes → Start ARIA → globe returns → monitoring restarts
- Assert: 0 dead-ends, every journey ends at success state

### D · Security battery
- Static analysis: `eslint-plugin-security` rule pass on entire src/
- Recipe allowlist: confirm denylist intact (no shell escapes, no arbitrary cmd execution)
- IPC: contextIsolation: true verified · no remote module enabled · no nodeIntegration in renderer
- Auto-update signature: assert manifest sha512 verified before install (electron-updater built-in)
- License HMAC: confirm constant-time compare (no timing oracle)
- Admin auth: confirm bcrypt-validated, env-var only, no fallback
- Input sanitization: assertContentSafePayload covers all user→main IPC payloads
- Cross-window XSS: confirm CSP headers in every BrowserWindow

### E · Privacy battery
- 6-host telemetry allowlist UNCHANGED (RUN 3 baseline)
- Update channel +2 paths (RUN 14) UNCHANGED
- ARIA-brain +1-2 paths (RUN 15) — explicit test that NO other iisupp.net path leaks
- Content-blind sanitization: 10,000-input fuzz on every watcher (sustained over 6h CI run) — 0 leaks
- Globe greetings: assert never includes user data, screen content, or filesystem paths
- Self-heal reports: assert sanitized (no stack-trace paths, no env values, no user content)
- Test: disable wifi mid-fix → confirm no telemetry queues up locally with user content waiting to be flushed

### F · Scenario battery
- Existing scenario-suite.mjs at 75 — extend to 150 scenarios across:
  - Common Windows issues (BSOD, disk full, network down, app crash, etc.)
  - Long-tail issues (driver conflict, registry corruption, MSI install fail)
  - Edge cases (network 100% utilized, disk 99% full, RAM OOM, process zombie)
- Each scenario: assert ARIA picks right recipe OR escalates correctly

### G · Test KB upload + targeted Q&A
- Create `tests/fixtures/test-kb.md` with 20 specific entries (e.g., "If Outlook crashes with code 0x800CCC0F, rename OST file")
- Upload via Settings → Knowledge & policy → drop test-kb.md
- For each entry: ask ARIA the scenario question in chat
- Assert: response cites the exact KB entry · no hallucinated answers · "I don't know" returned for off-KB queries

### H · Audit battery
- Audit log: every action user takes + every action ARIA takes → logged with ISO timestamp
- Audit export: CSV + PDF → assert all entries present, no duplicates, no missing fields
- Tampering test: manually modify audit log on disk → next session detects mismatch → alerts admin
- Time-window queries: "show me everything ARIA did between X and Y" → exact match

### I · Compliance battery — SOC 2 readiness
- Map each SOC 2 Common Criteria control to a Sentinel feature OR documented gap:
  - CC1 (Control Environment): RULES.md + admin separation
  - CC2 (Communication): audit log + admin console
  - CC3 (Risk Assessment): privacy verifier + recipe risk classes
  - CC4 (Monitoring): self-heal engine + nightly fuzz
  - CC5 (Control Activities): per-recipe gate + dry-run mode
  - CC6 (Logical Access): admin auth + license validation
  - CC7 (System Operations): auto-update + rollback
  - CC8 (Change Management): git tags + RUN reports
  - CC9 (Risk Mitigation): backup + recovery
- Output: SOC 2 readiness scorecard in docs/SOC2_READINESS_MAP.md

### J · Regulatory battery — Canada + EU + US
- PIPEDA (Canada): no PII leaves customer device without explicit consent · verified via privacy battery
- GDPR (EU): right-to-export user data (audit log download) · right-to-delete (uninstall wipes ~/.aria-sentinel) · data minimization (content-blind sanitization)
- CCPA (California): "do not sell" — N/A since we never collect PII
- CASL (Canada anti-spam): email only on explicit user request (license magic-link), no marketing without opt-in
- Output: regulatory checklist in docs/REGULATORY_COMPLIANCE_MAP.md

### K · Legal battery
- EULA exists at docs/EULA.md — covers liability cap, IP, termination
- DPA template at docs/DPA_TEMPLATE.md — for enterprise customers
- Open-source license inventory: every dependency's license logged in SBOM-LITE
- No GPL or AGPL deps (would force open-source) — verify
- Trademark check: "ARIA Sentinel" + "Integrated IT Support Inc." not infringing on existing marks (manual web search documented)

### L · Accessibility battery (bonus — enterprise buyers expect)
- WCAG 2.1 AA on every visible UI: color contrast · keyboard nav · screen reader compat
- Use axe-core lint on each renderer HTML

═══════════════════════════════════════════════════════════════
## §2 · Tests
═══════════════════════════════════════════════════════════════

Per-dimension test files:
- `tests/debug-battery.test.mjs`
- `tests/qa-battery.test.mjs`
- `tests/user-journey.test.mjs`
- `tests/security-battery.test.mjs`
- `tests/privacy-battery.test.mjs` (extends content-leak to 10K corpus)
- `tests/scenario-battery.test.mjs` (extends to 150)
- `tests/test-kb-qa.test.mjs`
- `tests/audit-battery.test.mjs`
- `tests/soc2-map.test.mjs` (asserts every CC has a mapped feature/gap)
- `tests/regulatory-map.test.mjs`
- `tests/legal-inventory.test.mjs`
- `tests/accessibility-battery.test.mjs`

Existing 60+ suites stay green. Target: ≥75 suites green.

═══════════════════════════════════════════════════════════════
## §3 · Acceptance
═══════════════════════════════════════════════════════════════

- ✅ npm test = ≥75/75 green
- ✅ 12 docs/RUN_16_TEST_RESULTS_<dim>.md files written, all green
- ✅ docs/SOC2_READINESS_MAP.md scored ≥70% mapped (target 100% within 2 follow-up runs)
- ✅ docs/REGULATORY_COMPLIANCE_MAP.md checklist all green or annotated gap
- ✅ ENTERPRISE_READINESS bumped to 9.95 (10.0 reserved for after pen test + first paid pilot)

═══════════════════════════════════════════════════════════════
## §4 · Locked rules
═══════════════════════════════════════════════════════════════

- Zero new deps (eslint-plugin-security + axe-core are dev-deps not runtime — acceptable as exceptions IF needed; justify in report)
- Privacy invariants UNCHANGED
- Test KB upload uses Sentinel's existing knowledge-policy flow — no new endpoint
- Test fixtures (test-kb.md, qa-inventory.json) committed local only, not bundled in customer .exe
- Write docs/RUN_16_REPORT.md + 12 dimension result files
- Commit `[sentinel] RUN 16: full test battery — debug · qa · behavior · security · privacy · scenarios · KB-QA · audit · SOC2 · regulatory · legal · accessibility`

═══════════════════════════════════════════════════════════════
## §5 · Order
═══════════════════════════════════════════════════════════════

1. QA inventory (tests/qa-inventory.json — every button/tab/IPC/handler/hotkey/recipe)
2. Pure-core test batteries (A-G) in parallel where possible
3. Compliance + regulatory + legal docs (I-K) — mostly documentation
4. Accessibility (L) — last
5. Aggregate + report
6. Commit

Ship it.
