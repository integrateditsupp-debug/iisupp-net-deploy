// RUN-B B1 - real "Was this fixed?" feedback loop and deflection math.
import assert from "node:assert/strict";
import { recordOutcome, deflectionStats, pilotProofMetrics } from "../src/shared/resolution-outcome.mjs";

let events = [];
let r = recordOutcome(events, { id: "s1", outcome: "resolved" }, { now: 1000 });
assert.equal(r.ok, true);
events = r.events;
r = recordOutcome(events, { id: "s2", outcome: "escalated" }, { now: 2000 });
events = r.events;
r = recordOutcome(events, { id: "s1", outcome: "resolved" }, { now: 3000 });
assert.equal(r.deduped, true, "same outcome id is deduped");

const stats = deflectionStats(events);
assert.equal(stats.conversations, 2);
assert.equal(stats.resolved, 1);
assert.equal(stats.deflectionPct, 50);

const bad = recordOutcome(events, { id: "x", outcome: "fixed maybe" });
assert.equal(bad.ok, false);
assert.ok(bad.errors.includes("outcome-invalid"));

const proof = pilotProofMetrics(events, { fixes: 2 });
assert.equal(proof.fixes, 2);
assert.equal(proof.hours_saved, 1.6);

console.log("Resolution-outcome test passed (record, dedupe, real deflection %, pilot proof metrics).");
