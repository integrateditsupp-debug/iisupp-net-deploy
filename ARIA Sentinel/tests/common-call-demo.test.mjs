// 2026-07-04 - ad/demo proof battery: 100+ common corporate calls across all three modes.
import assert from "node:assert/strict";
import {
  COMMON_CALL_DEMO_MODES,
  COMMON_CALL_DEMO_SCENARIOS,
  demoDisposition,
  summarizeCommonCallDemo
} from "../src/shared/common-call-demo.mjs";

assert.ok(COMMON_CALL_DEMO_SCENARIOS.length >= 100, "demo library has at least 100 calls");
assert.deepEqual(COMMON_CALL_DEMO_MODES, ["manual", "confirmed", "autonomous"], "three demo modes");

const ids = new Set(COMMON_CALL_DEMO_SCENARIOS.map((s) => s.id));
assert.equal(ids.size, COMMON_CALL_DEMO_SCENARIOS.length, "scenario ids are unique");

const categories = new Set(COMMON_CALL_DEMO_SCENARIOS.map((s) => s.category));
assert.ok(categories.size >= 12, "broad corporate coverage");

for (const scenario of COMMON_CALL_DEMO_SCENARIOS) {
  assert.ok(scenario.title && scenario.prompt && scenario.visualSymptom, `${scenario.id} has visible call context`);
  assert.ok(scenario.detector && scenario.safeDemoAction && scenario.proofPoint, `${scenario.id} has proof/safety metadata`);
  for (const mode of COMMON_CALL_DEMO_MODES) {
    assert.ok(scenario.modeOutcomes[mode], `${scenario.id} has ${mode} outcome`);
    const disposition = demoDisposition(scenario, mode);
    assert.equal(disposition.mode, mode, `${scenario.id} disposition mode preserved`);
    assert.match(disposition.summary, /ARIA|No bypass|dry-run|walkthrough|countdown|approval/i, `${scenario.id} ${mode} is explainable`);
  }
  const auto = demoDisposition(scenario, "autonomous");
  assert.match(auto.summary, /safe-demo|dry-run|approval|No bypass|No real OS change/i, `${scenario.id} autonomous path is safe`);
  assert.doesNotMatch(auto.summary, /delete files|disable security|bypass policy|store credential/i, `${scenario.id} autonomous path avoids unsafe promises`);
}

const autoSummary = summarizeCommonCallDemo("autonomous");
assert.equal(autoSummary.count, COMMON_CALL_DEMO_SCENARIOS.length, "summary count matches library");
assert.match(autoSummary.safety, /read-only|dry-runs|approval/i, "autonomous summary states safety boundary");

console.log(`common-call-demo passed (${COMMON_CALL_DEMO_SCENARIOS.length} scenarios, ${categories.size} categories, 3 modes).`);
