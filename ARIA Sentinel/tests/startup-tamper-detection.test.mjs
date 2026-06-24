// RUN 21 §4 — startup-tamper detection: classify the removal method, warn the user, and write a
// hash-chain-ready audit entry. main probes + records the tamper.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { classifyRemoval, buildTamperAudit, warningModel, disabledBanner, REMOVAL_METHODS } from "../src/main/startup-watchdog.mjs";

// Classify by evidence.
assert.equal(classifyRemoval({ source: "task-manager" }), "task-manager");
assert.equal(classifyRemoval({ registryMissing: true, taskMissing: false }), "registry");
assert.equal(classifyRemoval({ taskMissing: true, registryMissing: false }), "task-scheduler");
assert.equal(classifyRemoval({ viaTaskManager: true }), "task-manager");
assert.equal(classifyRemoval({}), "unknown");
for (const m of ["task-manager", "registry", "task-scheduler", "unknown"]) assert.ok(REMOVAL_METHODS.includes(m));

// Audit entry shape (joins the RUN 17 hash-chained transparencyLog).
const now = Date.parse("2026-07-05T08:00:00.000Z");
const audit = buildTamperAudit({ method: "task-manager", now, userConfirmed: true });
assert.equal(audit.event, "startup-disabled");
assert.equal(audit.method, "task-manager");
assert.equal(audit.userConfirmed, true);
assert.equal(audit.timestamp, new Date(now).toISOString());
// Unknown method coerced safely.
assert.equal(buildTamperAudit({ method: "hacker", now }).method, "unknown");

// Non-blocking warning model + the persistent About banner copy.
const w = warningModel();
assert.match(w.title, /removed from startup/i);
assert.deepEqual(w.actions, ["Re-enable", "Keep off"]);
assert.match(disabledBanner(new Date(now).toISOString()), /Auto-start disabled on .+\. ARIA only runs when manually launched\./);

// main probes startup + records the tamper (detection path) + persists the audit.
const main = fs.readFileSync(path.join(path.resolve(import.meta.dirname, ".."), "src", "main", "main.mjs"), "utf8");
assert.match(main, /function probeStartup\(/, "main probes startup presence");
assert.match(main, /recordStartupTamper\(/, "main records the tamper");
assert.match(main, /classifyRemoval\(/, "main classifies the removal method");
assert.match(main, /startup:tamper/, "main notifies the renderer of tamper");
assert.match(main, /buildTamperAudit\(/, "main builds the audit entry");

console.log("Startup-tamper-detection test passed (method classified · audit entry · warning model · wired in main).");
