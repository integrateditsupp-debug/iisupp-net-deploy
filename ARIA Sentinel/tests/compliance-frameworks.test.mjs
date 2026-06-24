// RUN 22 §4 — SOC 2 / HIPAA / PIPEDA / GDPR composite scores from real control states.
import assert from "node:assert/strict";
import { compositeScores, frameworkScore, badge, SOC2_CONTROLS, HIPAA_CONTROLS, PIPEDA_ITEMS, GDPR_RIGHTS } from "../src/shared/compliance-score.mjs";

// frameworkScore = met/total*100.
assert.deepEqual(frameworkScore([{ met: true }, { met: true }, { met: false }, { met: true }]), { score: 75, met: 3, total: 4 });
assert.equal(frameworkScore([]).score, 0);

// Badges.
assert.equal(badge(95), "strong");
assert.equal(badge(75), "ok");
assert.equal(badge(40), "gap");

// All four composites present with score + met/total + badge.
const cs = compositeScores();
for (const fw of ["soc2", "hipaa", "pipeda", "gdpr"]) {
  assert.ok(cs[fw], `${fw} composite present`);
  assert.ok(cs[fw].score >= 0 && cs[fw].score <= 100, `${fw} score in range`);
  assert.ok(["strong", "ok", "gap"].includes(cs[fw].badge));
  assert.equal(cs[fw].total > 0, true);
}
// Control corpora are non-empty.
assert.ok(SOC2_CONTROLS.length >= 5 && HIPAA_CONTROLS.length >= 4 && PIPEDA_ITEMS.length >= 4 && GDPR_RIGHTS.length >= 3);

// Overrides flip individual controls (drill-down).
const downgraded = compositeScores({ "CC6.1": false });
assert.ok(downgraded.soc2.score < cs.soc2.score, "flipping a control lowers the score");

console.log("Compliance-frameworks test passed (SOC2/HIPAA/PIPEDA/GDPR composites + badges + drill-down).");
