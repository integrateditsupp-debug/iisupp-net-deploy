// RUN 21 §2 — opportunity-window decision tree: prefer 17:00, fall back to 12:00 after 2 weeks,
// last-resort install on next launch.
import assert from "node:assert/strict";
import { nextOpportunity } from "../src/main/update-orchestrator.mjs";

const now = Date.parse("2026-07-05T00:00:00.000Z");
const auto = (firstSeenDaysAgo) => ({ phase: "AUTO", firstSeenAt: new Date(now - firstSeenDaysAgo * 24 * 60 * 60 * 1000).toISOString() });

// PREFERRED: machine on + app running + local time ≥ 17:00 → install now.
assert.deepEqual(
  pick(nextOpportunity(auto(1), { on: true, running: true, localHour: 18, now })),
  ["install", "preferred-evening-window"]
);
assert.equal(nextOpportunity(auto(1), { on: true, running: true, localHour: 17, now }).action, "install", "5pm boundary installs");

// Before 5pm and <2 weeks → defer (wait for the evening window).
assert.deepEqual(
  pick(nextOpportunity(auto(1), { on: true, running: true, localHour: 10, now })),
  ["defer", "awaiting-evening-window"]
);

// FALLBACK: ≥2 weeks elapsed → install at noon; before noon that day → defer until noon.
assert.equal(nextOpportunity(auto(15), { on: true, running: true, localHour: 12, now }).action, "install");
assert.equal(nextOpportunity(auto(15), { on: true, running: true, localHour: 12, now }).reason, "fallback-2week-noon");
assert.deepEqual(pick(nextOpportunity(auto(15), { on: true, running: true, localHour: 9, now })), ["defer", "fallback-awaiting-noon"]);

// LAST RESORT: outside both windows but flagged on-launch → install the moment the app is running.
assert.equal(nextOpportunity(auto(3), { on: true, running: true, localHour: 9, lastResortOnLaunch: true, now }).action, "install");
assert.equal(nextOpportunity(auto(3), { on: true, running: true, localHour: 9, lastResortOnLaunch: true, now }).reason, "last-resort-on-launch");

// Machine off / app not running → never install.
assert.equal(nextOpportunity(auto(1), { on: false, running: true, localHour: 18, now }).action, "defer");
assert.equal(nextOpportunity(auto(1), { on: true, running: false, localHour: 18, now }).action, "defer");

// Only consulted in AUTO.
assert.equal(nextOpportunity({ phase: "STRIKE2", firstSeenAt: new Date(now).toISOString() }, { on: true, running: true, localHour: 18, now }).reason, "not-in-auto");

function pick(r) { return [r.action, r.reason]; }
console.log("Update-orchestrator-time-windows test passed (5pm prefer · noon after 2w · on-launch last resort).");
