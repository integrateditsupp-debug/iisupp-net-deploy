// STAGE 3 S2 · brain-audit F2 (pure half) — goal-probe GRADE + honest resolution claim.
// Proves the one law: a SERVICE-STATE probe may never say "issue resolved" (spooler Running != printing
// works). Only an outcome-grade probe with a LIVE binding, a real change, and a non-preview run can.
import assert from "node:assert/strict";
import {
  gradeProbe, planProvesOutcome, resolutionClaim, countsAsDeflection,
  GRADE_OUTCOME, GRADE_SERVICE_STATE, GRADE_UNKNOWN, GRADE_RANK,
  SERVICE_STATE_INTERPRETS, OUTCOME_INTERPRETS,
  CLAIM_RESOLVED, CLAIM_UNVERIFIED, CLAIM_NOT_RESOLVED, CLAIM_NO_CHANGE, CLAIM_PREVIEW, CLAIM_BLOCKED
} from "../src/shared/goal-probe-grade.mjs";
import { PROBE_INTERPRETS } from "../src/shared/resolution-plan.mjs";

const probe = (interpret, description = "probe") => ({ command: "Get-Service Spooler", interpret, description });
const planWith = (p) => ({ id: "print-recovery", title: "Printing", goalProbe: p });
const allBound = { isOutcomeProbeBound: () => true };

// 1 — the F2 premise is REAL, not assumed: every grade the plan schema can express today is
// service-state. If someone adds an outcome interpret to the schema, this test tells them to
// teach it to the grader too (the two halves can never drift apart silently).
assert.deepEqual([...PROBE_INTERPRETS].sort(), [...SERVICE_STATE_INTERPRETS].sort());
for (const i of PROBE_INTERPRETS) assert.equal(gradeProbe(probe(i)).grade, GRADE_SERVICE_STATE);

// 2 — grading: service-state / outcome / unknown, and rank ordering.
assert.equal(gradeProbe(probe("service-running")).grade, GRADE_SERVICE_STATE);
assert.equal(gradeProbe(probe("print-test-page-succeeded")).grade, GRADE_OUTCOME);
assert.equal(gradeProbe(probe("vibes")).grade, GRADE_UNKNOWN);
assert.equal(gradeProbe(null).grade, GRADE_UNKNOWN);
assert.equal(gradeProbe(undefined).canDeclareResolved, false);
assert.equal(gradeProbe(probe("")).grade, GRADE_UNKNOWN);
assert.ok(GRADE_RANK[GRADE_OUTCOME] > GRADE_RANK[GRADE_SERVICE_STATE]);
assert.ok(GRADE_RANK[GRADE_SERVICE_STATE] > GRADE_RANK[GRADE_UNKNOWN]);

// 3 — a service-state probe can NEVER declare a fix, even when it passes. This is the whole point.
assert.equal(gradeProbe(probe("service-running")).canDeclareResolved, false);
assert.equal(gradeProbe(probe("count-positive")).canDeclareResolved, false);
// ...and no injected binding can promote it — the gate is the GRADE, not the binding.
assert.equal(gradeProbe(probe("service-running"), allBound).canDeclareResolved, false);

// 4 — an outcome probe is honest about not being wired yet: declared != live.
for (const i of OUTCOME_INTERPRETS) {
  assert.equal(gradeProbe(probe(i)).grade, GRADE_OUTCOME);
  assert.equal(gradeProbe(probe(i)).bound, false, `${i} must default to unbound`);
  assert.equal(gradeProbe(probe(i)).canDeclareResolved, false, `${i} unbound must not declare a fix`);
  assert.equal(gradeProbe(probe(i), allBound).canDeclareResolved, true);
}
assert.equal(planProvesOutcome(planWith(probe("service-running")), allBound), false);
assert.equal(planProvesOutcome(planWith(probe("host-resolves")), allBound), true);

// 5 — THE headline case (F2 verbatim): spooler Running, printing still broken.
const spooler = resolutionClaim({ plan: planWith(probe("service-running", "Spooler is Running")), probePassed: true, anyStepChanged: true, evidence: "Running" });
assert.equal(spooler.claim, CLAIM_UNVERIFIED);
assert.equal(spooler.resolved, false);
assert.equal(spooler.requiresOutcomeProbe, true);
assert.ok(!/resolved/i.test(spooler.line), "an unverified line must never contain a resolution claim");
assert.ok(/have not verified/i.test(spooler.line));

// 6 — the only path to "resolved": outcome grade + bound + real change + live run.
const good = { plan: planWith(probe("print-test-page-succeeded", "a test page printed")), probePassed: true, anyStepChanged: true, evidence: "page printed" };
const win = resolutionClaim(good, allBound);
assert.equal(win.claim, CLAIM_RESOLVED);
assert.equal(win.resolved, true);
assert.equal(win.grade, GRADE_OUTCOME);
assert.ok(win.line.includes("a test page printed"));
assert.equal(countsAsDeflection(good, allBound), true);

// 7 — every suppressor is terminal and none can be overridden by a strong grade.
assert.equal(resolutionClaim({ ...good, dryRun: true }, allBound).claim, CLAIM_PREVIEW);       // dry-run never claims success
assert.equal(resolutionClaim({ ...good, probePassed: false }, allBound).claim, CLAIM_NOT_RESOLVED);
assert.equal(resolutionClaim({ ...good, anyStepChanged: false }, allBound).claim, CLAIM_NO_CHANGE); // no-op-neutral is never a fix
for (const bad of [{ dryRun: true }, { probePassed: false }, { anyStepChanged: false }]) {
  const r = resolutionClaim({ ...good, ...bad }, allBound);
  assert.equal(r.resolved, false);
  assert.equal(countsAsDeflection({ ...good, ...bad }, allBound), false);
}
// non-boolean truthies must not sneak through (strict === true everywhere).
assert.equal(resolutionClaim({ ...good, probePassed: "yes" }, allBound).claim, CLAIM_NOT_RESOLVED);
assert.equal(resolutionClaim({ ...good, anyStepChanged: 1 }, allBound).claim, CLAIM_NO_CHANGE);

// 8 — MONOTONIC SAFETY: across the full grade x pass x change x dryRun table, `resolved` is true
// ONLY for the single legal combination. Nothing else can ever be shown as a fix.
let resolvedCount = 0, total = 0;
for (const interpret of ["service-running", "count-positive", "print-test-page-succeeded", "host-resolves", "vibes", ""]) {
  for (const probePassed of [true, false]) {
    for (const anyStepChanged of [true, false]) {
      for (const dryRun of [true, false]) {
        for (const opts of [{}, allBound]) {
          total += 1;
          const r = resolutionClaim({ plan: planWith(probe(interpret)), probePassed, anyStepChanged, dryRun }, opts);
          if (r.resolved) {
            resolvedCount += 1;
            assert.equal(r.grade, GRADE_OUTCOME);
            assert.ok(probePassed && anyStepChanged && !dryRun && opts === allBound);
          } else {
            assert.notEqual(r.claim, CLAIM_RESOLVED);
          }
        }
      }
    }
  }
}
assert.equal(total, 96);
assert.equal(resolvedCount, 2, "only the two bound outcome interprets, fully clean, may resolve");

// 9 — R11 is check #1: an off-limits reference blocks the claim before grading, content-blind.
const blocked = resolutionClaim({ plan: planWith(probe("print-test-page-succeeded", "C:/Users/x/Private pics and Vids/a.png")), probePassed: true, anyStepChanged: true }, allBound);
assert.equal(blocked.claim, CLAIM_BLOCKED);
assert.equal(blocked.resolved, false);
assert.equal(blocked.surfaced, "1 personal folder excluded");
assert.ok(!/Private pics/i.test(JSON.stringify(blocked)), "R11: the folder name must never leak into the claim");
assert.equal(gradeProbe(probe("service-running", "Private pics and Vids")).surfaced, "1 personal folder excluded");
// evidence is R11-redacted on the way out too.
const redacted = resolutionClaim({ plan: planWith(probe("host-resolves", "host resolves")), probePassed: true, anyStepChanged: true, evidence: "ok D:/Private pics and Vids/x" }, allBound);
assert.ok(!/Private pics/i.test(redacted.evidence));

// 10 — purity: no fs/spawn/DOM/Electron, and repeated calls are side-effect free.
const src = await (await import("node:fs/promises")).readFile(new URL("../src/shared/goal-probe-grade.mjs", import.meta.url), "utf8");
for (const banned of ["node:fs", "node:child_process", "electron", "document.", "window."]) {
  assert.ok(!src.includes(banned), `goal-probe-grade must stay pure — found ${banned}`);
}
const frozen = planWith(probe("host-resolves"));
const a = resolutionClaim({ plan: frozen, probePassed: true, anyStepChanged: true }, allBound);
const b = resolutionClaim({ plan: frozen, probePassed: true, anyStepChanged: true }, allBound);
assert.deepEqual(a, b);

console.log("goal-probe-grade test passed (F2 pure half: service-state can never claim a fix - only a bound outcome probe can; dry-run/no-change/fail are terminal; R11 first; 96-case table proves monotonic safety).");
