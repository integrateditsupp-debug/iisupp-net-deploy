// RUN 15 §6 — Start/Stop ARIA run-state + monitoring order.
import assert from "node:assert/strict";
import { applyRunState, nextMonitorStep, isActivelyMonitoring, MONITOR_ORDER } from "../src/shared/start-stop.mjs";
import fs from "node:fs";
import path from "node:path";

const NOW = Date.parse("2026-06-20T00:00:00.000Z");

// Stop → watchers off + globe hidden.
const stopped = applyRunState({ running: true, globeVisible: true, watchers: true }, "stop", NOW);
assert.equal(stopped.running, false);
assert.equal(stopped.globeVisible, false, "Stop hides the globe");
assert.equal(stopped.watchers, false);
assert.equal(stopped.monitoring, false);

// Start → watchers on + globe shown + monitoring.
const started = applyRunState(stopped, "start", NOW);
assert.equal(started.running, true);
assert.equal(started.globeVisible, true, "Start re-shows the globe");
assert.equal(started.watchers, true);
assert.equal(started.monitoring, true);

// Pause 1h → watchers off temporarily, still running.
const paused = applyRunState(started, "pause-1h", NOW);
assert.equal(paused.running, true);
assert.equal(paused.watchers, false);
assert.equal(paused.pausedUntil, NOW + 60 * 60 * 1000);
assert.equal(isActivelyMonitoring(paused, NOW), false, "paused = not actively monitoring");
assert.equal(isActivelyMonitoring(paused, NOW + 61 * 60 * 1000), false, "still running but watchers off until Start");
assert.equal(isActivelyMonitoring(started, NOW), true);

// Monitoring order: screen-errors → event-log → kb → research → escalate.
assert.deepEqual(MONITOR_ORDER, ["screen-errors", "event-log", "kb", "research", "escalate"]);
assert.equal(nextMonitorStep("screen-errors"), "event-log");
assert.equal(nextMonitorStep("research"), "escalate");
assert.equal(nextMonitorStep("escalate"), null);

// UI wiring: Control Center has Start/Stop ARIA buttons (not "Resume Watching").
const root = path.resolve(import.meta.dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "src", "renderer", "index.html"), "utf8");
assert.match(indexHtml, /id="startAria"/, "Start ARIA button present");
assert.match(indexHtml, /id="stopAria"/, "Stop ARIA button present");
assert.ok(!/Resume watching/i.test(indexHtml), "old 'Resume watching' label removed");

console.log("Start-stop-aria test passed (stop hides globe · start monitors · pause · monitor order · UI renamed).");
