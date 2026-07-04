// RUN-B B2 - real ROI/hours + deflection on every surface; empty stays empty.
import assert from "node:assert/strict";
import { valueProof, valueProofKpis } from "../src/shared/value-proof.mjs";

let proof = valueProof({ fixes: 0, outcomeEvents: [] });
assert.equal(proof.hoursSaved, null);
assert.equal(proof.dollarsSaved, null);
assert.equal(proof.deflectionPct, null);
assert.match(proof.note, /No measured/);

proof = valueProof({ fixes: 3, outcomeEvents: [{ outcome: "resolved", resolved: true }, { outcome: "escalated", escalated: true }] });
assert.equal(proof.hoursSaved, 2.4);
assert.equal(proof.dollarsSaved, 150);
assert.equal(proof.deflectionPct, 50);

const kpis = valueProofKpis({ fixes: 1, outcomeEvents: [{ outcome: "resolved", resolved: true }] });
assert.deepEqual(kpis, { hoursSaved: 0.8, dollarsSaved: 50, deflectionPct: 100, resolved: 1, conversations: 1 });

console.log("Value-proof test passed (empty-safe ROI, measured hours/dollars, deflection KPIs).");
