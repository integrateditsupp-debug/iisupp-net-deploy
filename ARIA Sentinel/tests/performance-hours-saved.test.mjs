// RUN 22 §2 — the ROI number: hours of human L1 work avoided (cumulative) vs the 47-min L1 baseline.
import assert from "node:assert/strict";
import { hoursSavedCumulative, timeSavedPerIncident, costPerIncident, L1_BASELINE_MINUTES, L1_COST_LOW } from "../src/shared/metrics.mjs";

assert.equal(L1_BASELINE_MINUTES, 47, "L1 baseline is 47 min/incident");

// 3 incidents ARIA resolved in 2/10/5 minutes → saved (47-2)+(47-10)+(47-5)=45+37+42=124 min = 2.07h.
const events = [
  { resolved: true, resolveMs: 120000 }, { resolved: true, resolveMs: 600000 }, { resolved: true, resolveMs: 300000 }
];
assert.equal(hoursSavedCumulative(events), 2.07);

// Unresolved incidents don't count toward savings.
assert.equal(hoursSavedCumulative([{ resolved: false, resolveMs: 0 }]), 0);

// An incident that took LONGER than the baseline saves 0 (never negative).
assert.equal(hoursSavedCumulative([{ resolved: true, resolveMs: 60 * 60000 }]), 0);

// Per-incident time saved (avg minutes).
assert.ok(timeSavedPerIncident(events) > 40 && timeSavedPerIncident(events) < 47);

// Cost saved vs the $50 L1 floor for auto-resolved incidents.
const cost = costPerIncident([{ resolved: true, escalated: false }, { resolved: true, escalated: false }, { resolved: true, escalated: true }]);
assert.equal(cost.ariaPerIncident, 0, "ARIA marginal cost ~$0 (local, no LLM)");
assert.equal(cost.autoResolved, 2);
assert.equal(cost.savedLow, 2 * L1_COST_LOW);

console.log("Performance-hours-saved test passed (cumulative hours saved vs 47-min L1 baseline; never negative).");
