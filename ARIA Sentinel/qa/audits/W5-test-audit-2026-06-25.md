# ARIA Sentinel — W5 Integrations Tab — Test & Audit Report
**Date:** 2026-06-25  **By:** Cowork (Director), independent verification  **Scope:** W5 Slices 1–3  **Rule:** RULE 13 (dated test/audit record)

## Summary
W5 (Integrations tab + read-only Test connection + UI cleanup) is **functionally built and CC's suite passed in its clean /tmp build** (186 suites, integrations 9/9, system-inventory-grouping 6/6). Independent re-run from the **mount working copy** exposed a **mount-truncation defect on 5 files** (the known gremlin) and one privacy-surface change requiring Ahmad's awareness. **Do not commit from this mount.**

## ✅ What worked (verified by Cowork)
- **Integrations tab (Slice 1):** 8 cards, 2 groups (Identity & Service / M365), honest grey "Not configured" badges, edition-gated, nav budget intact (≤10 tabs), ARIA chat + 3 modes + Ctrl+Alt+K untouched. Screenshot: design-review/w5-integrations-tab-slice1.png.
- **Test connection (Slice 2) — design correct:** read-only contract (ServiceNow ping GET limit=1; Entra client-credentials → GET /users?$top=1, GET-only asserted; CRM/RSA/Office stubs return {ok:false,"Not configured"}). Intact source files (integrations.mjs, entra-graph-client.mjs, directory.mjs, integrations.test.mjs) **PASS node --check**. Screenshot: w5-integrations-tab-slice2.png.
- **System Inventory cleanup (Slice 3): VERIFIED PASS in mount** — `system-inventory-grouping.test.mjs` 6/6: 3 collapsible groups (Apps/Drivers/Security updates), live counts, single filter box, clean empty state, no blank dead panel, gold theme kept, read-only path unchanged. Screenshot: w5-system-inventory-slice3.png.

## ❌ What failed (Cowork independent re-run)
- **Mount-truncation gremlin corrupted 5 W5 files in this working copy** — each ends mid-statement, fails parse at the cut:
  - `src/shared/servicenow.mjs` — 274 lines (CC wrote 295) — FAIL @275
  - `src/main/main.mjs` — FAIL @3250 (CC 3256)
  - `src/main/preload.cjs` — 141 (CC 143) — FAIL @142
  - `src/renderer/renderer.js` — 1980 (CC 2039) — FAIL @1981
  - `tests/privacy-audit.mjs` — 60 lines, truncated mid `listFiles()` — FAIL @61
- **Consequence:** running `tests/run-all.mjs` from the mount CRASHES on the truncated privacy-audit import; the "resilient" runner silently skipped it, so a mount run could falsely look green while the **privacy guard isn't executing**.
- **Root cause:** NOT a CC logic error — CC's /tmp build is intact and passed. The mount's copy of these files is truncated (standing gremlin: "build in /tmp, origin is truth").

## ⚠️ Needs Ahmad awareness / decision
- **New outbound host class:** Slice 2 added `login.microsoftonline.com` + `graph.microsoft.com` to the privacy-audit allowlist (alongside `*.service-now.com`). GET-only, **dormant until DIRECTORY_* creds + admin consent**, but it grows ARIA's outbound footprint. Approve as expected for the Entra integration, or restrict.
- **Settings deep-clean:** CC applied row-consistency CSS but did NOT restructure Settings markup (already grouped under Mode/Hotkeys/Troubleshoot/Support/About). Decide if a deeper Settings pass is wanted.

## 🔧 What needs improvement / next actions
1. **Commit W5 from a CLEAN source, never this mount.** Tomorrow: CC re-emits the truncated tails of the 5 files in a fresh /tmp clone (its build is the truth), re-runs run-all.mjs to confirm privacy-audit actually executes (not skipped), then commits from /tmp. Cowork pushes origin.
2. **Harden the test runner:** the resilient runner must FAIL LOUD (non-zero + named file) when a suite file can't be imported, so a truncation can never masquerade as green again.
3. **Re-verify privacy-audit runs** post-fix (it's the guard that must catch unexpected outbound hosts).
4. Then resume: Slice 2 live test once DIRECTORY_* creds provisioned; W6 services card.

## Evidence
- Screenshots: design-review/w5-integrations-tab-slice1.png, w5-integrations-tab-slice2.png, w5-system-inventory-slice3.png
- Verified PASS: integrations.mjs, entra-graph-client.mjs, directory.mjs, integrations.test.mjs (node --check); system-inventory-grouping.test.mjs 6/6
- Verified FAIL (truncation): servicenow.mjs, main.mjs, preload.cjs, renderer.js, privacy-audit.mjs

---

## CORRECTION (2026-06-25 ~19:55) — truncation was a sandbox artifact, NOT a product defect
CC re-reported full line counts measured on the **real filesystem** (`/c/Users/...`): servicenow.mjs **295**, main.mjs **3256**, preload.cjs **143**, renderer.js **2039** — and its `run-all.mjs` passed (186, privacy-audit included). Cowork's sandbox **mount mirror persistently shows truncated copies** (274/3249/141/1980/60) of the same files and fails to parse them. Conclusion: **the files are intact on Ahmad's disk; the truncation lives only in Cowork's sandbox mirror** = a verification-environment limitation, not a defect in W5.

**Revised standing:**
- ✅ W5 Slices 1–3 are **good** (intact on real FS, CC suite green, screenshots valid).
- ⚠️ Cowork must NOT run `node --check`/`run-all` or git on these files from its sandbox mirror — results are false. Verification of these files = trust CC's real-FS run, or use a fresh origin clone.
- 🔧 Still worth doing (cheap safety): **harden run-all.mjs to fail-loud** on any un-importable suite file, so a real truncation could never hide behind "green." (Not urgent; no current defect.)
- ⚠️ Privacy flag unchanged: 2 new MS hosts in the allowlist (GET-only, dormant) — Ahmad awareness.

## DECISION LOGGED (2026-06-25) — privacy hosts APPROVED
Ahmad approved keeping `login.microsoftonline.com` + `graph.microsoft.com` in the privacy allowlist (GET-only, dormant until creds + admin consent). See aria-vault/09_Decisions/D-20260625-privacy-hosts-entra.md. No further action on this item.
