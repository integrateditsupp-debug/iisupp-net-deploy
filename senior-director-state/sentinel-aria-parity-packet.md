# Claude Code — ARIA Sentinel ↔ Web PARITY + "Resolve for me" (2026-06-24)

Authority: Ahmad. Director: Cowork. ONE run; commit + push (review branches). **ARIA web (iisupp.net/aria) and ARIA Sentinel (Windows desktop app in `ARIA Sentinel/`) are the SAME product — one cloud surface, one local surface, one brain.** Read first: `aria-vault/01_Frontal/Sentinel/_Sentinel.md`, `01_Frontal/ARIA/_ARIA.md`, `02_Hippocampus/RULES.md`, and recent `11_CorpusCallosum/Live-Operations-Log.md` (RUN 29 = 3-mode safety pipeline; RUN 33 = Sentinel chat redesigned to match web).

## Branch map (web vs local)
- WEB changes (`aria.html` / `assets/aria-core.js`) → branch off CURRENT `origin/main`.
- SENTINEL changes (`ARIA Sentinel/` renderer) → branch off `sprint-0-backend` (the full Sentinel app lives there by design; `main` carries only a deploy subset).
- Two commits, ONE run. Push both review branches. Do NOT deploy/build — Ahmad previews → merges web → triggers deploy; Ahmad runs the Sentinel OTA build.

## TASK 1 — Test ARIA Sentinel first (baseline)
- `cd "ARIA Sentinel"` → run its test script (`npm test` or the project runner). Report suite count + pass/fail. Vault baseline ≈ 179 green. Fix any reds this run introduces before committing.

## TASK 2 — Product unification (web + local = one ARIA, shared brain, shared agents)
- Confirm BOTH surfaces use the SAME brain: KB (`knowledge-base/` + `aria_brain_pack/`), recipes, stop-codes, and the locked fall-through chain (KB $0 → Anthropic → offline local KB). If either surface duplicates logic, point both at the shared modules.
- Add a "Web + Sentinel = one product, one brain; the same agents (Claude-Code / KB-agent / OPS-agent) build both surfaces" note to `aria-vault/01_Frontal/ARIA/_ARIA.md` AND `01_Frontal/Sentinel/_Sentinel.md`, and reflect it in `docs/STRUCTURE.md`.

## TASK 3 — Sentinel: ENABLE "Resolve it for me" (currently grayed out)
- Find the disabled "Resolve it for me" control in the Sentinel renderer; enable it.
- Wire it to the EXISTING gated local-fix pipeline (RUN 29): **supervisor → policy → countdown → kill-switch → allowed-tier**.
- SAFETY — NON-NEGOTIABLE (treat as R8-class): default mode = **Confirmed** (user approves each fix). NEVER default to Autonomous. Keep per-mode dry-run defaults (Manual ON; Confirmed/Autonomous gated). Kill-switch must abort mid-fix. No fix executes without an explicit user confirm + visible countdown/cancel. "Resolve it for me" = run the matched detection→fix recipe locally, gated + reversible.

## TASK 4 — Sentinel chat box = web chat box (EXACT parity)
- Make the Sentinel "ARIA Chat" UI identical to iisupp.net/aria (`aria.html`): same layout, bubbles, KB article cards, source badges (KB $0 / via Anthropic / offline), company header + gold globe, fonts, spacing, behavior. RUN 33 started this — finish FULL parity (markup + CSS + interaction).
- Only intentional difference: Sentinel adds the local "Resolve it for me" action (Task 3); web shows the download gate (Task 5). Everything else identical.

## TASK 5 — Web: ENABLE "Resolve for me", gate behind a Sentinel-download prompt
- In `aria.html` / `assets/aria-core.js`, enable the currently-grayed "Resolve for me" button.
- On click (web): open a clean black+gold modal — *"To resolve this on your system, download ARIA Sentinel — local troubleshooting runs safely on your own device."* — with the **download link** (reuse the existing Sentinel download / "Install App" URL already in the repo; find it under the Install App action or `downloads/`).
- Web NEVER executes local fixes — it only routes the user to Sentinel. Preview-before-push (R6).

## VERIFY (before commit)
- Sentinel: tests green; "Resolve it for me" enabled + gated (Confirmed default + countdown + kill-switch); chat visually matches web (screenshot the renderer at its window sizes).
- Web: `node tools/iis-tester-agent.mjs --online` still 4 PASS; "Resolve for me" enabled; click → download modal with a WORKING link; ARIA + paywall + trial bar intact (R8); headless screenshots of `aria.html`.

## COMMIT + PUSH (one run, two review branches — no deploy/build)
- Web: `cc/web-resolve-gate-2026-06-24` off `origin/main` → commit → push.
- Sentinel: `cc/sentinel-resolve-parity-2026-06-24` off `sprint-0-backend` → commit → push.
- Append a summary line to `aria-vault/11_CorpusCallosum/Live-Operations-Log.md` + a decision note `aria-vault/09_Decisions/D-20260624-aria-web-sentinel-one-product.md`.

## Gates
R6 preview (web visual). R8 ARIA/Aperture/Sentinel-core never break. R13 trace to vault. R14 one batched run. **Sentinel auto-fix safety gates are MANDATORY — never auto-execute a local fix without Confirmed-mode approval + kill-switch.**

## Note on the live ARIA 400 (separate, do not touch here)
ARIA's cloud `aria-chat` is currently 400ing because the Anthropic key/org lacks access to the Claude 4.x models (being resolved separately via Netlify function logs). Do NOT change models or keys in this run — the offline local-KB fall-through keeps Sentinel useful regardless.

---
## UPDATE 2026-06-24 — Sentinel test BASELINE (Cowork ran the full 185-test suite)
Ran `node tests/run-all.mjs` on sprint-0-backend (8e72dcab) via an isolated worktree. RESULT = HEALTHY. PASS: Security · Privacy (10000 fuzz / 0 leaks) · Audit hash-chain · SOC2-map (CC1–CC9) · Regulatory (PIPEDA/GDPR/CCPA/CASL) · Accessibility · Scenario (167: 77/77 recipes + 90/90 out-of-domain escalated) · Test-KB-QA (20/20 + 5/5 off-KB) · QA 46/46 · User-journey 5/5 · Build-exclusion · Icon-pipeline · Security-banner.
ONE BLOCKER (halts the runner): `tests/run18-enterprise-wiring.test.mjs:45` asserts `RELEASE_NOTES_0.1.15.md exists on disk` → FALSE (file missing; recurring version-bump churn).
→ TASK 1a (DO FIRST): create `ARIA Sentinel/RELEASE_NOTES_0.1.15.md` (content = the 0.1.15 changes) + commit on sprint-0-backend → re-run `npm test` → confirm FULL green (tests after run18 will then execute). The app is healthy; this is a missing doc only.

## Task 5 REFINED (Ahmad 2026-06-24) — web "Resolve it for me" = TWO-option modal
On the web, when a user asks ARIA for technical help, ENABLE "Resolve it for me". On click → modal with TWO choices:
  (A) **Download ARIA Sentinel** — copy: "Download the desktop app for localized troubleshooting on your system." + the Sentinel download link.
  (B) **Continue with walkthrough** — stay in the web chat; ARIA guides the user step-by-step (no local execution).
Web never runs local fixes: (A) routes to Sentinel, (B) continues the guided chat. Black+gold styling; preview-before-push (R6).

## Task 1b — make the test runner resilient (improvement, do with 1a)
`tests/run-all.mjs` dies on the FIRST uncaught throw (run18 halted the whole suite → masked every test after it). Wrap each test in try/catch, collect results, run ALL, then print a final PASS/FAIL summary listing the reds. One missing file must never hide the rest. (Optional `--bail` flag to opt back into fail-fast.)

## COMMIT + PUSH + MERGE (locked 2026-06-24 — R15)
- CC: at the END of the run, `git commit` + `git push` BOTH review branches to origin (GitHub). Never leave uncommitted/unpushed.
- Cowork then QAs + merges the WEB review branch → main + pushes (Ahmad does NOT merge by hand). The Sentinel branch lands on sprint-0-backend for the OTA build (not main).
- One-writer rule (R16): run this in CC's OWN clone/worktree; no other agent writes the same .git meanwhile.
