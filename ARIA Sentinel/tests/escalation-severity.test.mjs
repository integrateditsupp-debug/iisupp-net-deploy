// STAGE 3 S3 · brain-audit F7 — SEVERITY-WEIGHTED ESCALATION. High-impact issues escalate after 1 failed
// safe attempt (not a flat 3); medium after 2; low after 3. Content-blind classification (Rule 14 / R11);
// backward-compatible with the flat-3 default; composes with the existing buildEscalationDraft threshold.
import assert from "node:assert/strict";
import {
  SEVERITY_THRESHOLDS, DEFAULT_THRESHOLD,
  severityOf, escalationThreshold, escalationThresholdFor, shouldEscalate
} from "../src/shared/escalation-severity.mjs";
import { buildEscalationDraft } from "../src/shared/diagnostic-reasoner.mjs";

// 1 — thresholds are the audited values; default stays the flat-3 (no regression).
assert.deepEqual({ ...SEVERITY_THRESHOLDS }, { high: 1, medium: 2, low: 3 });
assert.equal(DEFAULT_THRESHOLD, 3);

// 2 — severity classification (content-blind: symbolic fields only).
assert.equal(severityOf({ severity: "critical" }), "high", "explicit critical → high");
assert.equal(severityOf({ subsystem: "no-internet" }), "high", "whole-machine offline → high");
assert.equal(severityOf({ family: "BSOD" }), "high", "BSOD family → high");
assert.equal(severityOf({ signalCode: "SECURITY.RANSOMWARE" }), "high", "data-at-risk → high");
assert.equal(severityOf({ subsystem: "printer-issues" }), "medium", "degraded core subsystem → medium");
assert.equal(severityOf({ subsystems: ["audio"] }), "medium");
assert.equal(severityOf({ symptomId: "some-app-glitch" }), "low", "single-app → low");
assert.equal(severityOf({}), "low", "unknown → low (flat-3 default, no regression)");
// explicit severity beats subsystem inference.
assert.equal(severityOf({ severity: "low", subsystem: "no-internet" }), "low");
// 🔒 R11 — an off-limits blob is never inspected; classified low, nothing leaks.
assert.equal(severityOf({ subsystem: "no-internet", note: "C:\\Private pics and Vids" }), "low");

// 3 — threshold mapping + unknown fallback.
assert.equal(escalationThreshold("high"), 1);
assert.equal(escalationThreshold("medium"), 2);
assert.equal(escalationThreshold("low"), 3);
assert.equal(escalationThreshold("nonsense"), DEFAULT_THRESHOLD, "unknown → flat default");
assert.equal(escalationThresholdFor({ subsystem: "no-internet" }), 1);

// 4 — shouldEscalate: high escalates after 1; low needs 3.
{
  const hi = shouldEscalate({ issue: { subsystem: "no-internet" }, attempts: [{ recipeId: "flush-dns", outcome: "no-change" }] });
  assert.equal(hi.severity, "high");
  assert.equal(hi.threshold, 1);
  assert.equal(hi.escalate, true, "one failed attempt on a high-impact issue → escalate");

  const lo1 = shouldEscalate({ issue: {}, attempts: [{}, {}] });
  assert.equal(lo1.escalate, false, "2 failed attempts on a low issue → keep trying (flat-3 preserved)");
  const lo3 = shouldEscalate({ issue: {}, attempts: [{}, {}, {}] });
  assert.equal(lo3.escalate, true, "3rd failed attempt on a low issue → escalate (unchanged behavior)");

  const med = shouldEscalate({ severity: "medium", attempts: [{}, {}] });
  assert.equal(med.escalate, true);
  const med1 = shouldEscalate({ severity: "medium", attempts: [{}] });
  assert.equal(med1.escalate, false);
  // count-as-number accepted too.
  assert.equal(shouldEscalate({ severity: "high", attempts: 1 }).escalate, true);
  assert.equal(shouldEscalate({ severity: "high", attempts: 0 }).escalate, false);
}

// 5 — composes with the REAL buildEscalationDraft: the same 1 attempt that a flat-3 would ignore now drafts
//     an escalation when the severity threshold is supplied — and buildEscalationDraft is UNCHANGED.
{
  const attempts = [{ recipeId: "flush-dns", outcome: "no-change" }];
  const issue = { symptomTitle: "No internet", subsystem: "no-internet" };
  // flat default (3) → not yet (unchanged legacy behavior).
  assert.equal(buildEscalationDraft({ symptomTitle: issue.symptomTitle, attempts }), null);
  // severity-weighted (high → 1) → drafts now.
  const draft = buildEscalationDraft({ symptomTitle: issue.symptomTitle, attempts }, escalationThresholdFor(issue));
  assert.ok(draft && draft.escalate === true, "high-impact issue escalates after the first failed attempt");
  assert.equal(draft.contentBlind, true, "still content-blind (Rule 14)");
}

console.log("escalation-severity test passed (high→1 · medium→2 · low→3 · content-blind+R11 classify · flat-3 default preserved · composes with unchanged buildEscalationDraft).");
