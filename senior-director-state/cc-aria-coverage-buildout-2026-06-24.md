# Claude Code — ARIA Coverage Build-Out vs the 230-Call Catalog (2026-06-24)

Authority: Ahmad. Director: Cowork. ONE batched run, committed + pushed in slices (R15). Run in CC's OWN clone/worktree — no other agent writes the same `.git` (R16).

**Read first:** `strategic-reference/Future-of-Computing-EXPANDED.docx` (the 230-call catalog + tiers), `ARIA Sentinel/dev-docs/100-common-call-test-2026-06-24.md` (matcher baseline), `ARIA Sentinel/dev-docs/aria-web-test-2026-06-24.md` (web bugs), `knowledge-base/_meta/escalation-matrix.md`, `knowledge-base/_meta/routing.md`, `netlify/functions/aria-research.mjs` (locked fall-through: KB $0 → Anthropic → offline KB), `ARIA Sentinel/src/main/recipes/tier-0/catalog.mjs` (safe-recipe schema), `ARIA Sentinel/docs/SOC2_READINESS_MAP.md`, `aria-vault/02_Hippocampus/RULES.md`.

## Why (audit result)
Coverage vs the 230 calls: **Tier 1 ~85–90%** (strong), **Tier 2 ~55–65%**, **Tier 3 ~50%** (mostly correct escalate-to-human, but missing runbooks), **Tier 4 "Coming" ~5–10%** (the strategic gap). The 100-call test baseline: **66 PASS / 25 PARTIAL / 11 FAIL** — most failures are matcher/keyword-index gaps, NOT missing content. This packet closes the gaps **without breaking ARIA core, the paywall, the trial bar, the fall-through chain, or recipe safety gates (R8).**

## Hard gates (every slice)
- **R8:** never break ARIA chat, paywall, trial bar, Aperture, Sentinel core, or the locked fall-through. New recipes inherit the Tier-0 safety schema (allowlist, deny-list, audit-logged, content-blind, confirm + countdown + kill-switch + restore point). NEVER add an auto-executing local fix without those gates.
- **R6:** preview before any web-visible change (headless screenshot of `aria.html` if touched).
- **R13:** trace every slice to the vault. **R15:** `git commit` + `git push` at the end of EACH slice. Cowork merges web→main. **R16:** run in CC's own clone/worktree.
- Keep tests green: `node tools/iis-tester-agent.mjs --online` (web), `ARIA Sentinel` `node tests/run-all.mjs`, recipe tests.

---

## DEFINITION OF DONE — 100% LIVE, NO DRY-RUN, TESTED ON LIVE (Ahmad, 2026-06-24)
Do NOT stop at "code written." The app must WORK, proven by REAL execution on a LIVE machine/site. No dry-run anywhere in production. Keep iterating + re-testing ON LIVE until EVERY item passes. No excuses — find a way.
1. **Recipes run for REAL** on a live Windows machine (no dry-run): the fix completes, a restore point + audit entry are created, and Ctrl+Alt+K aborts mid-fix. Verify ≥10 representative recipes end-to-end.
2. **Web chat works:** topic-switch (ask printer → then "RAM vs storage" → it answers RAM, not the printer); CLEAR/END resets the session; a free-form question ("16 vs 32GB RAM for video editing") returns a real LLM answer; recipe questions still return the fix.
3. **Web "Resolve it for me"** opens ARIA Sentinel via deep-link and Sentinel auto-runs the fix; if Sentinel isn't installed → download/open prompt.
4. **Recipes tab** = A→Z dropdown + search ("zoom" → all zoom recipes).
5. **Matcher**: re-run the `ARIA Sentinel/dev-docs/100-common-call-test` harness → target **≥95% PASS** (from the 66% baseline) after the synonym + KB-index fixes.
6. **All tests green:** `node tests/run-all.mjs` (Sentinel) + `node tools/iis-tester-agent.mjs --online` (web).
7. **Every MAJOR change recorded** in `ARIA Sentinel/dev-docs/CHANGELOG.md` (date · what · why · files · verified-on-live Y/N) + a vault Live-Ops-Log line.
Cowork re-tests on LIVE after each CC push and signs off only when 1–7 all pass.

---

## SLICE 0 (do first) — fix the truncated mesh linker
`aria-vault/scripts/link-web.mjs` is **truncated on origin** (~149 lines; ends mid-statement at `candidates.add(noteKey(ot…` → SyntaxError, won't run). Restore the full linker: complete the dangling function AND the file-writing pass that regenerates the `<!-- LINK-WEB:auto -->` Related blocks. Verify `node aria-vault/scripts/link-web.mjs` exits 0 and Related blocks repopulate. Commit + push.

## SLICE A — QUICK WIN (right after Slice 0; ship fast)
The recipe-tab UI is a Sentinel renderer change → branch off `sprint-0-backend`; recipe/matcher items touch shared recipe data (web `netlify/functions/aria-recipes-data.mjs` + `ARIA Sentinel/src/.../recipes`). **(CC already started this: Office/Excel web recipe added + `scoreRecipe` substring bug diagnosed — finish it.)**
1. **Office/Excel recipe** ("Excel/Word won't open / format not valid / locked") mirroring `APP - OUTLOOK`: Office Quick-Repair, Open-and-Repair, clear cache / unlock, verify extension. Wire into web + Sentinel recipe sets + an L1 KB article.
2. **Harden the offline matcher.** `scoreRecipe` does substring matching, so "the internet **is** down" misses "internet down". Build a synonyms/keywords → recipe map (internet|wifi|"no websites"|"no connection" → internet-down; excel|spreadsheet|xlsx → office/excel) so phrasing resolves WITHOUT the cloud LLM. **Also: add the existing-but-unindexed KB articles to `knowledge-base/_meta/index-by-keyword.json`** (the 100-call test found password, passkey, mobile-email, BYOD, lost-laptop, deleted-file, new-device articles all exist but aren't indexed — indexing them alone lifts the pass rate a lot). Add a matcher test asserting the 100-call phrasings resolve.
3. **Recipes tab → finder** (Sentinel renderer): an **A→Z alphabetical dropdown** + a **search field** beside it. Typing "zoom" + Enter filters to ALL zoom recipes (title + category + keywords). Keep per-card safety buttons (R8). This is ARIA's "common issue solutions" library — make it searchable.

VERIFY: Office/Excel recipe runs; matcher test passes; Recipes tab dropdown + search work; `node tests/run-all.mjs` green; screenshot.

## SLICE B — PRODUCTION ENABLEMENT (recipes actually run; safety rails stay) — HIGH PRIORITY
**Ahmad directive (2026-06-24): NO DRY-RUN anywhere in production — 100% LIVE, tested on live.** Remove the global dry-run block; every recipe executes for REAL. Modes differ by AUTONOMY, not execute-vs-preview:
- **Manual** = ARIA walks the user through and RUNS each step when they click it (real, one step at a time — not a preview).
- **Confirmed** (new-install default) = the fix runs after a single approve + countdown.
- **Autonomous** = auto-runs green low-risk recipes; orange/red still confirm.
- Set `ARIA_SENTINEL_ALLOW_SYSTEM_FIXES=1` ON by default in the signed/production build. Honor each step's `risk` + `requiresConfirm` (these are user-control, NOT dry-run).
- **KEEP (non-negotiable — sellable + SOC2 + liability):** restore point before every change, Ctrl+Alt+K kill-switch, full audit log, allowlist/deny-list, mode gating. "No dry-run" = real fixes run — NOT "no safeguards." These rails are selling points and SOC2 evidence.
- Re-label Recipes-tab buttons by mode (Manual → "Preview", Confirmed/Autonomous → "Resolve").
- VERIFY in a VM: each recipe executes for real, rolls back, kill-switch aborts mid-fix, restore point created, audit log records it. Tests green. Screenshot each mode.

## SLICE C — WEB "Resolve it for me" → open-with-ARIA-Sentinel autonomous handoff — HIGH PRIORITY
Goal: on iisupp.net/aria, "Resolve it for me" → if the user HAS Sentinel, hand the issue to Sentinel which solves it autonomously; if not, prompt to get/open it. Web NEVER runs a local fix itself (R8) — it only routes.
- Register a protocol handler in the Sentinel Electron app: `setAsDefaultProtocolClient('aria-sentinel')`. Handle `aria-sentinel://resolve?recipe=<id>&intent=<text>` → Sentinel loads the recipe and runs it in **Autonomous** for green recipes (risky still confirm) with countdown + kill-switch + restore point.
- Web flow (`aria.html` / `assets/aria-core.js`): "Resolve it for me" → attempt `aria-sentinel://resolve?recipe=<matchedId>`. Primary button **"Open with ARIA Sentinel"**. If it fires → Sentinel opens + auto-runs. If nothing handles it (not installed) → fall back to the existing download/walkthrough modal.
- Pass ONLY a recipe id + intent over the link — never a system command. Preview-before-push (R6).
- VERIFY: with Sentinel installed, "Resolve it for me" opens Sentinel + auto-runs; without it → download modal. Headless screenshot.

## SLICE D — WEB CHAT LOGIC FIXES (from live test 2026-06-24) — HIGH PRIORITY (pre-sale blocker)
Live test on iisupp.net/aria (see `ARIA Sentinel/dev-docs/aria-web-test-2026-06-24.md`):
- ARIA **locks onto the first issue** — unrelated follow-ups ("RAM vs storage", "16 vs 32GB RAM") were both deflected back to "What is the printer doing?". Fix: allow topic switches; don't pin the session to the first matched recipe.
- **CLEAR / END CHAT do not reset** the conversation/context. Fix: make them start a clean session.
- **Route non-recipe questions to the LLM** (the Anthropic key is now set) and verify a free-form question returns a real answer. The recipe path already works (printer fix was correct + detailed).
- VERIFY: topic-switch mid-session works; CLEAR resets; "16 vs 32GB RAM for video editing" returns an LLM answer; recipe path still works. Screenshots.

## SLICE 1 (P1 — Tier 1/2 volume gaps, fast wins, highest ticket volume)
Add to `knowledge-base/` (existing schema) + matching web recipes in `aria-recipes-data.mjs` (dry-run/guided; web never executes local fixes):
- **Passkey/passwordless recovery**: 2 L1 articles + 2 guided recipes.
- **Mail authentication** (SPF/DKIM/DMARC) standalone L2 + 1 diagnostic recipe.
- **SASE/SSE (ZTNA)** L2, **Wi-Fi survey** L2, **patch-management** L2 (3 articles).
- Recipes: **suspicious-login/conditional-access self-check** + **OneDrive KFM repair** (2). Update `_meta/routing.md`.

## SLICE 2 (P2 — Tier 3 premium runbooks)
L3 runbooks tied to `escalation-matrix.md` triggers (human-led; ARIA triages + documents): **RAID/SAN rebuild, hypervisor-cluster-down, CA expiry, zero-day fleet patch, DDoS, forensic-preservation** (6) + standalone **DR/BC** and **M365/Workspace tenant-migration** L3 (2).

## SLICE 3 (P3 — Tier 4 "Coming": the strategic moat; near-zero today)
Articles + dry-run/guided recipes; route via new Tier-4 signals in `_meta/routing.md`:
- **AI-agent governance pack** (6 articles): governance, agent IR, agent audit-trail (tie to Aperture), spend-guardrails, agent identity onboard/offboard, shadow-AI discovery — + 3 recipes + 1 IR runbook.
- **AI-threat pack** (3 + 1 workflow): prompt-injection/RAG-leakage, AI vishing, deepfake — + callback-verification protocol.
- **Next-gen endpoint pack** (4): model-drift/auto-update breakage, on-device NPU issues, self-healing-endpoint → human escalation, local-LLM GPU build-out.
- **Frontier-infra pack** (7): PQC/quantum-safe migration + harvest-now playbook, private 5G, satellite/LEO failover, AR/smart-glasses, wearables, robotics/cobot/OT, edge-node triage.

## SLICE 4 (P4 — compliance maps, sales-enabling)
In `compliance/`: control maps for **EU AI Act** + **NIST AI RMF** (2). Promote **HIPAA** + **ISO 27001 (SoA)** from `aria_brain_pack` bits to formal maps. Add **C2PA/content-provenance** policy. Keep SOC2 as the reference format.

---

## Build order & approval gates
1. Slice 0 → Cowork verifies linker runs.
2. Slice A (quick win) → Cowork QA. Ship fast.
3. Slice D (web chat bugs — pre-sale blocker) → Cowork QA (topic-switch, CLEAR reset, LLM answers).
4. Slice B (production execution) → Cowork QA in a VM (real fixes run + roll back + kill-switch + restore point). The "sellable" gate.
5. Slice C (web→Sentinel handoff) → Cowork QA (deep-link opens Sentinel + auto-runs; no-Sentinel falls back).
6. Slice 1 → Cowork QA + merge to main (volume wins). 7. Slices 2–4 → Cowork QA in order; Tier-4 (Slice 3) is the differentiator.
- **Approval gate:** do NOT publish any compliance/cert claim as "certified" — readiness maps/self-assessments only (legal review pending). Flag external compliance assertions for Ahmad.

## Trace
Append a summary line per slice to `aria-vault/11_CorpusCallosum/Live-Operations-Log.md` + a decision note `aria-vault/09_Decisions/D-20260624-aria-coverage-buildout.md`. Update `docs/STRUCTURE.md` for new KB folders. Save all dev docs in `ARIA Sentinel/dev-docs/`.

## Next prompt (after this run)
Convert Tiers 1–2 into a published fixed-price service catalog (SKUs + flat managed rate) using the ARIA? column — every "Partial → Full" is margin. Direct revenue follow-on.
