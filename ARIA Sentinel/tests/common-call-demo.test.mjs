// 2026-07-04 - ad/demo proof battery: 100+ common corporate calls across all three modes.
import assert from "node:assert/strict";
import {
  AUTONOMOUS_TAKEOVER_DEMO,
  COMMON_CALL_DEMO_MODES,
  COMMON_CALL_DEMO_SCENARIOS,
  LIVE_CAPTURE_DEMO_STEPS,
  buildAutonomousTakeoverDemo,
  buildLiveCaptureDemo,
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

const live = buildLiveCaptureDemo();
assert.equal(live.steps.length, 7, "live capture has a complete troubleshooting chain");
assert.equal(live.steps, LIVE_CAPTURE_DEMO_STEPS, "live capture returns canonical steps");
for (const label of ["Capture symptom", "Collect evidence", "Diagnose cause", "Choose safe action", "Run safe remediation", "Verify result", "Write proof report"]) {
  assert.ok(live.steps.some((step) => step.label === label), `live capture includes ${label}`);
}
assert.match(live.case.reportId, /^ARIA-CAPTURE-DEMO-/, "live capture report id");
assert.match(live.safety, /read-only|dry-run|without changing Windows/i, "live capture safety boundary");
assert.match(live.completedText, /symptom -> evidence -> diagnosis -> dry-run fix -> verification -> report/, "live capture completion chain is explicit");
assert.ok(live.case.before.length >= 4 && live.case.after.length >= 4, "live capture has before/after evidence");

const visibleAuto = buildAutonomousTakeoverDemo("frontend");
const backgroundAuto = buildAutonomousTakeoverDemo("backend");
assert.equal(visibleAuto.reportId, AUTONOMOUS_TAKEOVER_DEMO.reportId, "autonomous report id is canonical");
assert.equal(visibleAuto.visibleFrame, true, "front-end mode shows the visible control frame");
assert.equal(backgroundAuto.visibleFrame, false, "back-end mode does not show the visible control frame");
assert.match(visibleAuto.prompt, /front end|back end/i, "autonomous prompt offers front/back choice");
assert.ok(visibleAuto.steps.some((step) => /golden|ARIA using computer/i.test(`${step.detail} ${step.proof}`)), "front-end path includes golden ARIA using computer proof");
assert.ok(backgroundAuto.steps.some((step) => /background|quietly/i.test(`${step.detail} ${step.proof}`)), "back-end path explains background remediation");
assert.equal(visibleAuto.rebootPolicy.forceEnabled, false, "forced reboot is disabled without admin policy");
assert.equal(visibleAuto.rebootPolicy.attempts.length, 3, "reboot reminders have three attempts");
assert.ok(visibleAuto.rebootPolicy.postponeOptions.includes("1 hour"), "one-hour postpone option exists");
for (const demo of [visibleAuto, backgroundAuto]) {
  assert.doesNotMatch(JSON.stringify(demo), /shutdown\.exe|Restart-Computer|forced reboot now|store credential|silently grants/i, "autonomous demo avoids unsafe OS promises");
}

console.log(`common-call-demo passed (${COMMON_CALL_DEMO_SCENARIOS.length} scenarios, ${categories.size} categories, 3 modes).`);
