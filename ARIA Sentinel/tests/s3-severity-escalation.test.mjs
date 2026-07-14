// STAGE 3 S3 / BRAIN-AUDIT F7 — SEVERITY-WEIGHTED ESCALATION.
// The old rule was flat: 3 failed safe attempts before a human is looped in. For a high-impact issue
// that is 3 attempts too many. Locked here:
//   • high/critical → a human after ONE attempt; critical escalates in PARALLEL with that attempt;
//   • medium → 2; low → 3 (the historic floor is preserved, not weakened);
//   • severity is DERIVED from evidence the caller really has — never inflated to look responsive;
//   • a recurrence escalates on its own (repeating a fix that did not hold is the F1 bug);
//   • back-compatible: an explicit threshold still wins, and the old 3-attempt default still stands;
//   • 🔒 R11 — a blocked issue never produces an escalation payload at all.
import assert from "node:assert/strict";
import { classifySeverity, escalationThreshold, shouldEscalate, escalationAllowed, SEVERITY_THRESHOLDS, DEFAULT_ATTEMPT_THRESHOLD } from "../src/shared/escalation-policy.mjs";
import { buildEscalationDraft } from "../src/shared/diagnostic-reasoner.mjs";

// 1 — thresholds. The low-severity floor is exactly the historic rule; nothing got weaker.
assert.equal(SEVERITY_THRESHOLDS.critical, 1);
assert.equal(SEVERITY_THRESHOLDS.high, 1);
assert.equal(SEVERITY_THRESHOLDS.medium, 2);
assert.equal(SEVERITY_THRESHOLDS.low, DEFAULT_ATTEMPT_THRESHOLD);
assert.equal(escalationThreshold("high"), 1);
assert.equal(escalationThreshold(undefined), 3, "unknown severity → the historic 3, never 1 (no inflation)");

// 2 — severity is evidence-derived, and it does not flatter us.
assert.equal(classifySeverity({ dataAtRisk: true }), "critical");
assert.equal(classifySeverity({ securityImpact: true }), "critical");
assert.equal(classifySeverity({ workBlocking: true, scope: "whole-machine" }), "high");
assert.equal(classifySeverity({ workBlocking: true, scope: "network" }), "high");
assert.equal(classifySeverity({ workBlocking: true, scope: "single-app" }), "medium");
assert.equal(classifySeverity({ workBlocking: true, scope: "single-app", recurred: true }), "high", "a work-blocking issue that CAME BACK is worse");
assert.equal(classifySeverity({}), "low", "no evidence → low, never 'critical, just in case'");

// 3 — a high-impact issue reaches a human after ONE failed safe attempt.
{
  const d = shouldEscalate({ severity: "high", attempts: 1 });
  assert.equal(d.escalate, true);
  assert.equal(d.threshold, 1);
  assert.ok(d.line.includes("1 safe attempt"));
}
// medium waits for 2, low still waits for 3 — and says how many are left, honestly.
assert.equal(shouldEscalate({ severity: "medium", attempts: 1 }).escalate, false);
assert.equal(shouldEscalate({ severity: "medium", attempts: 2 }).escalate, true);
assert.equal(shouldEscalate({ severity: "low", attempts: 2 }).escalate, false);
assert.equal(shouldEscalate({ severity: "low", attempts: 3 }).escalate, true);
assert.ok(shouldEscalate({ severity: "low", attempts: 1 }).line.includes("2 safe attempts left"));

// 4 — critical loops the human in IN PARALLEL: we do not wait to fail first.
{
  const d = shouldEscalate({ severity: "critical", attempts: 0 });
  assert.equal(d.parallel, true);
  assert.equal(shouldEscalate({ severity: "low", attempts: 0 }).parallel, false);
}

// 5 — a recurrence escalates on its own, at any severity (F1: never repeat a fix that did not hold).
{
  const d = shouldEscalate({ severity: "low", attempts: 0, recurred: true });
  assert.equal(d.escalate, true);
  assert.equal(d.reason, "recurrence");
  assert.ok(d.line.includes("came back"));
}

// 6 — the escalation DRAFT is now severity-weighted, and stays back-compatible.
{
  const attempts = [{ recipeId: "restart-audio", outcome: "no-change" }];
  assert.equal(buildEscalationDraft({ symptomTitle: "No sound", attempts }), null, "1 attempt, no severity → the historic 3 still applies");
  const high = buildEscalationDraft({ symptomTitle: "No network at all", attempts, severity: "high" });
  assert.equal(high.escalate, true, "high severity escalates after ONE failed attempt");
  assert.equal(high.threshold, 1);
  assert.equal(high.severity, "high");
  assert.equal(high.contentBlind, true);
  assert.ok(high.shortDescription.includes("1 safe attempt"), "and the wording is honest about how many we tried");
  // Explicit threshold still wins (old callers keep their behaviour exactly).
  assert.equal(buildEscalationDraft({ symptomTitle: "x", attempts, severity: "high" }, 3), null);
  // The payload stays symbolic — recipe ids and outcomes, never content.
  assert.deepEqual(high.attempts, [{ recipeId: "restart-audio", outcome: "no-change" }]);
}

// 7 — 🔒 R11: no escalation payload may ever be built for a blocked issue.
assert.equal(escalationAllowed({ symptom: "printer" }), true);
assert.equal(escalationAllowed({ path: "C:\\Private pics and Vids\\x.jpg" }), false);

console.log("s3-severity-escalation test passed (high → 1 attempt · critical in parallel · low floor preserved · recurrence escalates · severity never inflated · back-compatible · R11 first).");
