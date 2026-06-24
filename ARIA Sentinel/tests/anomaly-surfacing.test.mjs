// RUN 20 §5 — edge-case handling: the reasoner notices high error counts in subsystems UNRELATED to the
// reported symptom and surfaces them ("I also notice X — might be related. Want to investigate?").
import assert from "node:assert/strict";
import { surfaceAnomalies, diagnose } from "../src/shared/diagnostic-reasoner.mjs";

// "Internet slow" but the logs are actually full of GPU driver crashes → surface the GPU anomaly.
const context = { eventLog: { errorsBySubsystem: { gpu: 47, network: 2, audio: 1 } } };
const anomalies = surfaceAnomalies(context, { relatedSubsystems: ["network"], threshold: 10 });
assert.equal(anomalies.length, 1, "one unrelated anomaly surfaced");
assert.equal(anomalies[0].subsystem, "gpu");
assert.equal(anomalies[0].count, 47);
assert.match(anomalies[0].note, /unrelated/i, "framed as an incidental finding");

// Subsystems related to the symptom are NOT surfaced as anomalies (they're expected to be involved).
const none = surfaceAnomalies({ eventLog: { errorsBySubsystem: { network: 50 } } }, { relatedSubsystems: ["network"], threshold: 10 });
assert.equal(none.length, 0, "related subsystem is not flagged as an anomaly");

// Below threshold → nothing surfaced (no noise).
assert.equal(surfaceAnomalies({ eventLog: { errorsBySubsystem: { gpu: 3 } } }, { relatedSubsystems: [], threshold: 10 }).length, 0);

// End-to-end through diagnose(): a "no-internet" symptom (related=network) surfaces the GPU spike.
const kb = [{ id: "no-internet", title: "No Internet", phrasings: ["no internet"], symptoms: ["No internet"], causes: [{ name: "DNS", probability: 30, detection: "network dns" }] }];
const result = diagnose("no internet", kb, context);
assert.ok(result.anomalies.some((a) => a.subsystem === "gpu"), "diagnose() surfaces the unrelated GPU anomaly");

console.log("Anomaly-surfacing test passed (unrelated high-error subsystem flagged; related/low-count ignored).");
