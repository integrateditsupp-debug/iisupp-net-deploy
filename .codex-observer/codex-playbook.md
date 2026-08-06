# Codex Playbook — scan 2026-08-05T21:09:45Z

## Verdict
Codex proper: **0 commits, 34 days dormant** (last 2026-07-02). This loop continues to observe a
Cowork/CC-only commit stream. The "Codex" framing is now purely historical.

## Window (2d) — 31 commits, HEAD e413131c on main
Authors: Cowork 23 | CC Stage2 6 | cowork-loop 1 | Claude Cowork 1
Top dirs: scripts 28 | tests 27 | netlify 27 | ARIA Sentinel 27 | public 16 | .well-known 16 | assets 14 | root 14
Top verbs: run 8 | feed 5 | merge 4 | unify 3 | flywheel 3 | security 2

## Delta vs prior scan (13:05Z, HEAD ec9141b9) — +12 commits in ~8h
- **New dirs: none.** Second consecutive clean-dir scan; structure has settled.
- **New verbs: `run`, `404`.** `run` now dominant (8) — the RUN-AH..AN lettered-cycle cadence
  replaced the earlier `feed`/`unify`/`flywheel` hygiene phase as the primary commit shape.
- Churn shift: `scripts` (8 -> 28) and `ARIA Sentinel` (9 -> 27) tripled; tests kept pace (14 -> 27),
  so the test-to-source ratio did not degrade during the burst.

## Notable patterns this window
1. **RUN-AH -> RUN-AN lettered cycle** (7 commits) — each ships a guard that refuses a class of claim:
   AJ (a staged click must name what it clicks), AK (claims carry measurement stamps or the write refuses),
   AL/AM (feed cannot go stale silently), AN (customer-path link graph, 894 links walked, 0 broken).
2. **Self-refusing emitters** is now the house pattern: guards throw at write time rather than reporting.
3. **Classifier regression caught in-flight** (RUN-AN): registry arrived RED exit 1, intent `default`
   85.82% under its 86% floor, traced to one unbounded typo alternate, word-bounded, 92.64% -> 92.96%.
4. **Discovery worth acting on**: `pricing.html` does not exist — `/plans/` is the real pricing surface.
5. Business reality unchanged across all 7 RUN commits: **second messages sent 0, meetings 0, revenue none.**

## Flags for Ahmad
1. `.git/index.lock` present again — mtime 2026-08-05T17:48Z, ~3h old, stale residue from the 13:48
   commit (NOT the frozen 07-28 lock, and NOT a live agent). Agents keep leaving it behind. Delete it.
2. Codex 34 days dormant — rename this loop `repo-observer` or retire it. 6th consecutive scan saying so.
3. `observe-codex.mjs` still absent and its outputs dir unmounted — every scan since 07-21 is manual
   reconstruction. Make the fallback official in LOOPS_SPEC.md §6 or rebuild the script in-repo.
4. Guard machinery is compounding fast; the revenue line has not moved in 7 cycles. The build is
   getting more honest, not more sold.
