---
type: flywheel-record
brain_region: corpus-callosum
created: 2026-06-30
run: RUN-C C3 (conversion path — 5-minute onboarding)
writer: Cowork flywheel
rule14: verified with live git + live test run in a clean /tmp clone off origin/main
---

# Flywheel 2026-06-30 — RUN-C C3 SHIPPED + MERGED (5-minute onboarding activation + time-to-first-value)

**Real, pushed to origin/main. Suite 196/196 → 197/197 green. Sole git writer at merge (in a clean /tmp clone; the mount .git was never touched).**

## Startup verification (Rule 14 — re-checked, did not trust prior claims)
- The Cowork mount `.git` was dirty + locked (on branch `cc/run-a-a1`, stale git-commit lock) and its `origin/main` ref was stale at `93c7daa`. Did NOT operate on that view.
- Fresh blobless clone off origin → TRUE `origin/main` tip = **be2f4c0** ("RUN-C C2 shipped+merged, 196/196"). Confirmed **C1 AND C2 are already merged** (C2 merge `c6184cc`). Ran `node tests/run-all.mjs` on that tip → **196/196 green** (prior C2 claim confirmed honest; pure-node suite, no node_modules needed).
- Re-confirmed (live git) the 6 `cc/run-a*/run-b*` branches are STILL stale + regressive: none is an ancestor of main (merge-base `6d824b5`; main +98 vs branch +18–27); the deleted-on-purpose inflated trust pages (`trust/perf.html`, `routing-accuracy.html`, `ai-evals.html`, `methodology.html`) are PRESENT on the branches but ABSENT on main → merging resurrects inflated content = Rule 14 regression. **Correctly NOT merged.**
- C2 already merged + no C3 branch existing → per NEVER-HOLD, built the real frontier (RUN-C C3) on current main myself.

## What shipped (RUN-C C3 — measurable 5-minute onboarding)
The 6-step SETUP wizard and 3-step ONBOARDING walkthrough already existed in `app-config.mjs`, but they only track *click-through* ("did the user see the intro?"). They did NOT answer the buyer's #1 criterion: **how fast does a brand-new user reach a REAL resolved issue?** C3 adds that activation/value layer.

New pure, dependency-free module **`ARIA Sentinel/src/shared/onboarding-activation.mjs`** modelling the spec path:
`started → mode_picked → connect_done (skippable) → first_value (real KB answer OR real safe fix) → report_viewed`
- **`timeToFirstValueMs` / `formatDuration`** make "time to first resolved issue" a real, measurable number that feeds the RUN-B metrics (`metrics.mjs` mttr / firstTouchResolution).
- **Rule 14 (real-or-empty):** TTFV is `null` (label "—") until there is a real start AND a real value event — never a fabricated countdown. A `first_value` requires a valid kind (`kb_answer`|`safe_fix`); a recorded value is **idempotent** (the first real timestamp wins — it cannot be gamed faster OR slower). Corrupt order (value before start) → `null`, never negative.
- **No dead step:** `nextStep()` always returns a real next action until the journey is complete; `deadStep` is false by construction and the suite asserts it at every intermediate state (mirrors C1's funnel-link-guard philosophy).
- **Fed by REAL signals:** `deriveJourney()` folds real `app-config` setup completion + a real KB-hit/safe-fix value event + report-viewed into the journey (tested against `defaultAppConfig()`/`completeSetup()`), so the layer is wired to real product state, not standalone.
- Milestones map to real surfaces only (no invented features): mode = setup wizard; connect = `entra-graph-client.mjs`/`servicenow.mjs` or skip; value = `aria-local-kb.mjs`/`symptom-kb.mjs` or `recipe-runner.mjs`/`recommend-action.mjs`; report = `report-generator.mjs`.
- Safety note: the wizard's safe **Manual** default is preserved (its own test pins it); C3 measures whichever mode is picked, recommending Confirmed for fastest value — it does NOT override the safe default.

**Locked in:** `ARIA Sentinel/tests/onboarding-activation.test.mjs` (8 groups), registered in `run-all.mjs`. Additive only: +413 lines, no deletions. **197/197 green** (was 196).

## Honest program status
- main: **GREEN 197/197**, RUN-C **C1 + C2 + C3 = ALL DONE** (conversion path complete + test-guarded on main).
- **Next (no hold):** RUN-C exit = walk the funnel as a cold visitor (Cowork verify) → release **RUN-D (go-to-market)**: case-study engine fed by the C2 intake + C3 activation data, pilot-outreach packaging, and staged (one-click) public publish. RUN-D packet auto-queued.

## Related
- [[VISION-AND-GOAL-STANDING]]
- [[Live-Operations-Log]]
- [[_CorpusCallosum]]
- [[Cowork]]
- [[Claude-Code]]
