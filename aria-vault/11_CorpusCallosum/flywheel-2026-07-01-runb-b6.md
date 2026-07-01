---
type: flywheel-run-record
brain_region: corpus-callosum
created: 2026-07-01
author: Cowork Flywheel
rule14: verified-with-git
---

# Flywheel Run — 2026-07-01 · RUN-B B6 regression-sweep LOCK merged · RUN-B COMPLETE · RUN-E released

> Rule 14: every claim verified with live `git` + a real `node tests/run-all.mjs` in a clean `/tmp` clone off `origin/main`. The mount `.git` was NOT touched (it has a crashed-process lock + a dirty tree) — all git work happened in the isolated clone, pushed to `origin/main` as sole writer (`d5e3568..a630c71`, verified via `ls-remote`).

## What shipped to main (real, pushed)
- **RUN-B B6 — regression-sweep LOCK.** New `ARIA Sentinel/tests/b6-regression-sweep.test.mjs` (registered in `run-all.mjs`). B6 was "run the whole suite once"; this makes it a PERMANENT, re-runnable gate. It goes red if:
  - any RUN-B shared module (`resolution-outcome` / `value-proof` / `globe-confirmation` / `trust-posture` / `roi`) is deleted;
  - any RUN-B feature gate or the public `funnel-link-guard` / `site-pricing-guard` / `classifier-accuracy` gate is unregistered from `run-all.mjs` (nobody can quietly drop a gate to fake green);
  - the B3 over-claim guard is weakened (test proves it still catches an affirmative cert claim + still passes honest negation);
  - real-or-empty breaks (B1 deflection + B2 value-proof MUST be null until a real fix — no `$0`-as-a-win);
  - **any of the 4 inflated Trust pages deleted for honesty is resurrected** (`trust/perf.html`, `trust/routing-accuracy.html`, `trust/ai-evals.html`, `trust/methodology.html`) — a direct anti-supersede-regression guard.
- **Negative-tested (not vacuous):** planting an inflated Trust page makes the gate exit `1`; clean suite exits `0`. Verified both exit codes live.
- **Suite: 204 → 205 green** on the merged HEAD. Additive (+1 test, +1 registration line, zero deletions).
- Merge `cc/run-b-b6-sweep-2026-07-01` -> `main` (`--no-ff`), pushed `d5e3568..a630c71` (`a630c71` confirmed = remote `main` via `ls-remote`).

## Re-verified (Rule 14, my own live git — not just trusting the prior record)
The stale 06-29 branches (`cc/run-a-a1..a4`, `cc/run-b-b1`, `cc/run-b-b4`) are **SUPERSEDED, must NOT be merged**:
- All merge-base = `6d824b5` (2026-06-24); `main` is **121 commits ahead** of them.
- They still carry the 4 inflated Trust pages `main` deleted on purpose — merging = a Rule 14 regression.
- `main` already shipped their honest intent via independent commits (A1 audit, honest Trust Center, AXIS = B4).
- **B6's new gate now makes that regression impossible to merge silently** (it would go red first).
- Recommend Ahmad one-click delete the 6 stale remote branches (janitorial; not a hold).

## Program status vs Master exit criteria (CLIENT-READY-PROGRAM §4)
1. Honesty — A1 killed fake metrics; B3 over-claim guard; **B6 locks it.** ✅
2. Retrieval — classifier **92.39% over 332,163** at test time; KB routing suites green. ✅
3. Value proof — B1 real deflection + B2 real ROI, real-or-empty, wired to surfaces. ✅
4. Conversion — RUN-C C1/C2/C3 merged (funnel, free-pilot, ≤5-min onboarding, Stripe reachable, no dead links). ✅
5. GTM — RUN-D D1/D2/D2-wire/D3 (battlecard, ROI one-pager, pilot->paid engine, case-study, outreach staged). ✅
6. Quality — full suite **205/205 green**; edge cases covered. ✅
**Verdict: the CLIENT-READY product/GTM program (A→D) is COMPLETE on main.** Per RUN-D's closer: declare client-ready → shift to the revenue/scale phase.

## Auto-created + released the next sequence (no idle)
- **RUN-E — FIRST PAYING PILOT & REVENUE ACTIVATION** — `aria-vault/01_Frontal/RUN-E-first-paying-pilot.md` (tracked) + mirror in `senior-director-state/cc-runs/` (where the flywheel reads). Turns the client-ready product into real revenue: pilot activation kit (E1), pilot→paid proof autorun (E2), revenue-now pipeline + acquisition-scout board (E3). All buildable slices free + Rule 14; sends/signing/payment/accounts/deploy/acquisition stay Ahmad one-click.

## Next safe steps (no hold)
1. Build RUN-E E1 (pilot activation kit) surgically on current main — free, no external send.
2. Ahmad one-click (NOT holds): live Electron/browser smoke of the merged B-series; delete 6 stale branches; the staged D3 outreach send list.

## Related
- [[Live-Operations-Log]]
- [[VISION-AND-GOAL-STANDING]]
- [[RUN-E-first-paying-pilot]]
- [[_CorpusCallosum]]
- [[Claude-Code]]
- [[Cowork]]
- [[_Sentinel]]
