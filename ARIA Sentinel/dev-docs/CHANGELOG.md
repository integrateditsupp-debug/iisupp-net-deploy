# ARIA / Sentinel — Major Change Log

Organized record of **major** changes (Ahmad directive, 2026-06-24: record all major changes, properly organized). Newest first.
**Process:** every major change → add a row here AND a line in `aria-vault/11_CorpusCallosum/Live-Operations-Log.md`. A change is "done" only when **Verified on LIVE = YES**.

| Date | Change | Why | Files / Area | Verified on LIVE? | By |
|------|--------|-----|--------------|-------------------|-----|
| 2026-06-24 | CC packet: added **Definition of Done** (100% live, no dry-run, test-on-live, iterate-until-pass) + Slice B reframed to fully-live | Ahmad: make the app 100% live + tested on live, no excuses | `senior-director-state/cc-aria-coverage-buildout-2026-06-24.md` | n/a (spec) | Cowork |
| 2026-06-24 | CC packet: added **Slice B** (production execution), **Slice C** (web→Sentinel deep-link handoff), **Slice D** (web chat-logic bugs) | Production-ready; fix stuck-session + build the autonomous handoff | packet | n/a (spec) | Cowork |
| 2026-06-24 | **ARIA web live test** — recipe path PASS (printer fix correct); found stuck-session + CLEAR-no-reset bugs; no Resolve→Sentinel handoff yet | Verify ARIA after key fix | live iisupp.net/aria | YES (tested) | Cowork |
| 2026-06-24 | **Netlify redeploy** `main@740ab84` (no-cache) to pick up `ANTHROPIC_API_KEY` | ARIA cloud 400 — key was missing/malformed | Netlify env + build | YES — ARIA returned a correct fix | Cowork |
| 2026-06-24 | **100-call matcher test** baseline 66 PASS / 25 PARTIAL / 11 FAIL; gaps are matcher/index, not content | Quantify coverage; target ≥95% after Slice A | `dev-docs/100-common-call-test-2026-06-24.md` | YES (harness) | Cowork |
| 2026-06-24 | CC (in progress): **Office/Excel recipe** added (web) + `scoreRecipe` substring-match bug diagnosed | Coverage gap + varied-phrasing misses | `aria-recipes-data.mjs`, `src/shared/recipes.mjs` | pending | Claude-Code |
| 2026-06-24 | **Backups** reconfigured: source `iisupp-net-deploy/aria-vault`; 2 locations (GitHub/ARIA + Documents); twice-daily auto | Never lose the vault again (R17) | `_vault-backups/`, `Documents/ARIA-Vault-Backups/` | YES — both 772 KB | Cowork |
| 2026-06-24 | **Vault recovered** to 145 notes after git-corruption incident; R15/R16/R17 locked | Corruption from concurrent `.git` writers | `aria-vault/` | YES — opens in Obsidian | Cowork |

## Open items (must reach Verified-on-LIVE = YES)
- Slice D: web topic-switch + CLEAR reset + LLM free-form answer — **not yet fixed** (live test still shows stuck-session).
- Slice B: recipes execute for real on a live machine + roll back + kill-switch.
- Slice C: "Resolve it for me" → opens Sentinel + auto-runs.
- Slice A: matcher ≥95% on the 100-call harness; Recipes tab dropdown + search.

## 2026-06-24 — Deploy + live re-test (Cowork)
- MERGED web branch + rebuilt KB bundles (280 articles) -> main @ b0ef4bf, auto-deployed. Web tester 0 FAIL. Verified LIVE: YES.
- LIVE re-test: 3 web bugs remain (DoD #2) — in-session topic-bleed, NEW CHAT no-reset, aria-chat LLM never fires. -> Slice D Round 2. Verified LIVE: NO.

## 2026-06-24 — Slice D Round 2 merged + live re-test (Cowork)
- MERGED Round 2 -> main @ f00f864, deployed. Topic-bleed fix + NEW CHAT/CLEAR hard-reset shipped.
- LIVE re-test: free-form questions STILL never call aria-chat (only aria-event fires) — triage front-door intercepts the LLM. DoD#2 NOT met -> CC Round 3 (cc-run-queue.md Q1). Verified LIVE: NO.
- Set up CC run queue + status loop (senior-director-state/cc-run-queue.md + cc-run-status.md).
