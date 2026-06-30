---
type: flywheel-run-record
brain_region: corpus-callosum
created: 2026-06-30
author: Cowork Flywheel
rule14: verified-with-git
---

# Flywheel Run — 2026-06-30 · GREEN main + supersede stale RUN-A/RUN-B branches

> Rule 14: every claim below was verified with live `git` in a clean `/tmp` clone off `origin/main`. No fabrication. The mount `.git` was NOT touched (stale `*.lock` files + dirty tree); all git work happened in the isolated clone, pushed to `origin/main` as sole writer.

## What shipped to main (real, pushed)
- **Fixed the one red on `main`.** `ARIA Sentinel/tests/site-pricing-guard.test.mjs` listed `trust/perf.html` and `trust/routing-accuracy.html`, but commit **`eb8f404` (HARD RULE 14: honest Trust Center)** had already **deleted those two pages on purpose**. The guard threw `ENOENT` -> suite was 193/194.
- Fix: delist the two deleted pages, **add the live honest `trust.html`** so coverage is strengthened (both `trust.html` + `trust/index.html` verified clean of every stale tier token).
- Result: **194/194 suites green.** Merged `cc/run-c-guardfix-2026-06-30` -> `main` (`--no-ff`), pushed: `fed274f..c344e1f`.

## Why the 6 RUN-A / RUN-B branches were NOT merged (they would regress main)
PROGRESS-LEDGER said "Sequence A+B complete, awaiting merge." Live git showed that is **stale**:

- Branches (`cc/run-a-a1..a4`, `cc/run-b-b1`, `cc/run-b-b4`) all base on **`4fadc47`**, which is **NOT an ancestor of `origin/main`**. Merge-base is the old `6d824b5`.
- Since then **`main` advanced 89 commits**; the branches carry 27 old commits. Bulk-merging diffs **794-816 files / ~218k insertions** against that old base.
- `main` has **already shipped the same Sequence A/B themes via different commits**:
  - `8b2752e` — audit A1: delete fake renderAutoResolution metrics at source (= A1 "kill fake metrics")
  - `eb8f404` — honest Trust Center (= B3 "honest trust surface")
  - `8c03e2e` + `ef9b4dc` — AXIS Command Center (= B4 "director chat")
  - `b0ef932` / `c717592` / `39d409e` — /aria "Resolve it for me" handoff
- The stale branches still **contain the OLD inflated trust pages** (`trust/perf.html`, `trust/routing-accuracy.html`, `trust/ai-evals.html`, `trust/methodology.html`) that `eb8f404` deleted for honesty. Merging them would **resurrect deleted-on-purpose inflated content** -> a direct **Rule 14 regression**. One branch commit says verbatim: "no main merge -- would regress."

**Verdict (honest):** main is AHEAD of these branches, not behind. They are **SUPERSEDED**, not "ready to merge." Recommend Ahmad **delete the 6 stale `cc/run-a*`/`cc/run-b*` remote branches**. Any genuinely-unique sliver (e.g. B1 desktop "Was this fixed?" deflection chip, if absent from main) should be re-implemented surgically on current main, never by merging the stale stack.

## Next safe steps (no hold)
1. RUN-A/RUN-B intent is effectively live on main via the independent commits above + this green-up. Real next frontier: **RUN-C (conversion path): C1 funnel audit, C2 free-pilot mechanic, C3 5-min onboarding** — build surgically on current main.
2. Clean up stale branches (Ahmad one-click `git push origin --delete ...`).

## Related
- [[Live-Operations-Log]]
- [[VISION-AND-GOAL-STANDING]]
- [[_CorpusCallosum]]
- [[Claude-Code]]
- [[Cowork]]
- [[_Sentinel]]
