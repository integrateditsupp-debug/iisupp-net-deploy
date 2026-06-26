# Codex Playbook — Delta
_New patterns only. Emitted by `codex-observer` for Cowork coordination._

- **this scan:** 2026-06-25T13:09:34Z (window since 2026-06-23T13:09:34Z)
- **prior scan:** 2026-06-24T13:16:09Z (window since 2026-06-22T13:16Z)
- **verdict:** **NEW PATTERNS** — 30 net-new commits since prior scan.

## Net-new since prior scan
- **30 commits**, all 2026-06-24T16:34→19:54 ET, on **2 NEW branches**: `cc/coverage-buildout-2026-06-24`, `cc/coverage-sentinel-2026-06-24`.
- Newest across all branches: `60a4093b` (06-24 19:54). Checked-out HEAD `300d240` unchanged (parked on old branch — do not read as "no activity").

## New patterns detected
1. **Cadence shift: RUN-NN → DoD-criterion.** `run` (prior #1, 42×) gone from top tokens. New: `slice` 15, `coverage` 13, `dod` 10, `criterion` 10, `recipes` 6, `real` 7, `llm` 5. Evidence-first / definition-of-done commit style.
2. **Tag-lane flip:** `[cc]` 6→42 (now dominant); `[sentinel]` 49→2; `[aria]` 17→0.
3. **New directories:** `compliance/` (top-10, replaces `tests`); `ARIA Sentinel/docs` (90) + `ARIA Sentinel/design-review` (34) new 2-seg hotspots; `ARIA Sentinel/tests` 68→201, `src` 65→168.
4. **New branches:** `cc/coverage-buildout-2026-06-24`, `cc/coverage-sentinel-2026-06-24`.

## Unchanged
- `codex/*` namesake lane: still 0 in window, last 06-18 (now dormant ~7d).
- Ahmad-dominant authorship (50/58).
- Churn still artifact-inflated (+539K/−11K).

## Coordination note for Cowork
The Sentinel coverage+DoD work is **complete-and-verified on feature branches but unmerged to `main`**. If Cowork is about to touch Sentinel, branch from `cc/coverage-sentinel-2026-06-24` (newest), not from stale `main`.
