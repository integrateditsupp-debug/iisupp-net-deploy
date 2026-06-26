# Codex Working-Style Playbook
_Rolling output of the `codex-observer` loop (Observer class). READ-ONLY scan — no commits, no pushes, $0, no LLM._

- **generatedAt:** 2026-06-25T13:09:34Z
- **window:** last 2 days (since 2026-06-23T13:09:34Z)
- **scope:** local branch tips, deduped (`git log --branches --since=2d`)
- **HEAD (checked-out):** `300d240` @ `cc/sentinel-resolve-parity-2026-06-24` — **unchanged vs prior scan** (checkout parked on a 06-24 03:11 branch)
- **Newest commit across all branches:** `60a4093b` @ `cc/coverage-sentinel-2026-06-24` (2026-06-24T19:54:25-04:00)
- **method note:** git is **usable** through the Cowork bash mount this run — `packed-refs` reads clean and `git log`/`show-ref`/`rev-parse` all exit 0 (the 06-23/06-24 packed-refs NUL corruption is resolved per the 06-25 goal-alignment integrity check). The original `observe-codex.mjs` is not mounted in this session (it lives in `local_442f5d4e`), so the scan was reproduced from `git log`.

## Headline
- **58 commits** in the 2-day window across local branches.
- **30 of those are NET-NEW since the prior scan** (2026-06-24T13:16:09Z) — all committed 2026-06-24T16:34→19:54 ET, landing on **two NEW `cc/coverage-*` branches** (`cc/coverage-buildout-2026-06-24`, `cc/coverage-sentinel-2026-06-24`).
- The unchanged `300d240` HEAD is a **red herring**: the working checkout is still on the old `cc/sentinel-resolve-parity` branch — the real new work is on the coverage branches, **not merged to `main`** (main still 2026-06-16, ~9 days stale).
- **`codex/*` namesake lane: still 0 commits in window** — all eight `codex/*` branches last moved 2026-06-18 (dormant ~7 days). All velocity remains on the **`cc/*` lane**.

## What the new push actually is (06-24 PM)
A coordinated **"coverage Slice 1-4" + "DoD criterion 1-5"** verification sprint on **ARIA Sentinel**: Tier 1-4 KB articles + guided recipes, a 100-call matcher re-test (66% → **100% PASS**), Tier-0 execution "proven for REAL on live Windows" with rollback, `aria-sentinel://` OS deep-link routing, and a Slice D topic-bleed/LLM-wiring fix. Cadence has shifted from **"RUN NN" numbered slices → DoD-criterion-driven, evidence-first commits**.

## Lane / tag mix — NEW: hard flip toward `[cc]`
54/58 commits (93.1%) carry a bracket-tag prefix (down from prior 86/87 = 98.9%).

| tag | commits (now) | prior (06-24) |
|---|---|---|
| `[cc]` | 42 | 6 |
| `[ops]` | 3 | 5 |
| `[hotfix]` | 3 | 3 |
| `[sentinel]` | 2 | 49 |
| `[aria]` | 0 | 17 |
| `[autonomous]` | 1 | 3 |
| `[web]`/`[trust]`/`[deploy]` | 1 each | 1 each |
| untagged | 4 | 1 |

The `[sentinel]`+`[aria]` surge that dominated the prior window aged out; the `[cc]` coverage/DoD work now dominates. Author identities: Ahmad 50 · Cowork (Claude) 5 · Cowork-Director 2 · aria-classifier-loop 1.

## Leading tokens (commit verbs / topics) — NEW vocabulary
`slice 15 · coverage 13 · dod 10 · criterion 10 · sentinel 10 · real 7 · chat 6 · recipes 6 · home 6 · nav 6 · fix 5 · llm 5`

**`run`** — the prior #1 token at 42 — has **dropped out of the top set entirely.** New dominant terms: `slice`, `coverage`, `dod`, `criterion`, `recipes`, `real`, `llm`. This is a genuine working-style shift toward definition-of-done + live-evidence language.

## Top directories touched (path-touches, window)
| dir (1st segment) | touches |
|---|---|
| `ARIA Sentinel` | 802 |
| `aria-vault` | 387 |
| `knowledge-base` | 177 |
| `netlify` | 104 |
| `apps` | 38 |
| `docs` | 23 |
| `outputs` | 22 |
| `assets` | 20 |
| `compliance` | 18 |
| `sdk` | 15 |

2-segment hotspots: ARIA Sentinel/tests 201 · ARIA Sentinel/src 168 · ARIA Sentinel/dist 110 · netlify/functions 104 · ARIA Sentinel/docs 90 · aria-vault/07_Cortex 88 · aria-vault/iisupp-strategic 86 · aria-vault/01_Frontal 73 · apps/sentinel-desktop 36 · ARIA Sentinel/design-review 34

**New dir prominence vs prior:** `compliance/` enters the top-10 (replacing `tests`); `ARIA Sentinel/docs` (90) and `ARIA Sentinel/design-review` (34) are new 2-seg hotspots; `ARIA Sentinel/tests` jumped 68→201 and `ARIA Sentinel/src` 65→168 — consistent with a test-and-verify-heavy sprint.

## Churn
**+538,843 / −11,417** lines. Heavily inflated by committed generated artifacts (`ARIA Sentinel/dist`, KB JSON, `aria-vault` exports, test fixtures). Treat raw churn as unreliable for effort sizing.

## Branch activity (newest commit per local branch)
| branch | last commit |
|---|---|
| `cc/coverage-sentinel-2026-06-24` | 2026-06-24 |
| `cc/coverage-buildout-2026-06-24` | 2026-06-24 |
| `cc/home-hero-nav-2026-06-24` | 2026-06-24 |
| `cc/sentinel-resolve-parity-2026-06-24` | 2026-06-24 |
| `cc/master-run-2026-06-23` | 2026-06-24 |
| `sprint-0-backend` | 2026-06-23 |
| `run-24-25-clean` | 2026-06-22 |
| `codex/deploy-hygiene-pass-2026-06-18` | 2026-06-18 |
| `codex/aria-action-row-cleanup-2026-06-18` | 2026-06-18 |
| `codex/aria-deployment-collapse-2026-06-18` | 2026-06-18 |
| `codex/aria-global-pulse-tv-2026-06-18` | 2026-06-18 |
| `codex/fix-aria-layout-2026-06-18` | 2026-06-18 |
| `codex/finish100-post-round14` | 2026-06-18 |
| `codex/round9-bottom-2026-06-18` | 2026-06-18 |
| `codex/revenue-synthesis-2026-06-17` | 2026-06-18 |
| `main` | 2026-06-16 |
| `learning-loop-activation` | 2026-05-26 |
| `kb-bulk-push` | 2026-05-12 |

## Flags for Ahmad
1. **Unmerged Sentinel progress.** The 06-24 PM coverage+DoD push (DoD criteria 1-5 "proven for REAL on live Windows", matcher 66%→100%) sits on `cc/coverage-*` feature branches — **not on `main` (still 06-16, ~9d stale).** Worth a merge/publish decision.
2. **Compliance dir appeared, self-policed.** New `compliance/` work is tagged "READINESS maps (self-assessment — NOT certification)" — correctly avoids the no-certification-claims hard rule. No action needed, noted for awareness.
3. **Tag discipline slipped slightly** — 4 untagged vs 1 prior (93% vs 98.9%).
4. **`codex/*` namesake lane dormant 7 days.** All build velocity is CC/Cowork lane; the literal Codex branches haven't moved since 06-18.

_Stop-condition tracker: this run found NEW patterns → cadence stays at 2×/working-day (not stepped to weekly)._
