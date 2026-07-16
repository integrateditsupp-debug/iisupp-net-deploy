// SERVICE IDLE-NORMAL GATE (2026-07-16) — the SYSTEM.SERVICE.STOPPED detector must NOT raise the under-globe card
// for a service whose designed state is Manual/Trigger-Start (stopped-when-idle is HEALTHY). This kills the
// "Windows Update stuck — fix it?" false positive that fired on essentially every idle Windows machine (wuauserv
// is Manual/Trigger Start and sits stopped the vast majority of the time). The detector is NOT removed (Rule 15):
// genuinely-down Automatic services still fire, and corroborating failure evidence overrides the gate.
import assert from "node:assert/strict";
import { evaluateServices, normalizeStartType, IDLE_NORMAL_SERVICES, shouldAlertOnStop } from "../src/sub-agents/detection/service-watcher.mjs";

let n = 0; const t = () => { n++; };
const run = (name, status, row) => evaluateServices({ [name]: "Running" }, [{ Name: name, Status: status, ...(row || {}) }]).signals;

// 1 — the false positive is gone: wuauserv is Manual/Trigger Start, so a plain "stopped" raises NO card.
assert.deepEqual(run("wuauserv", "Stopped", { StartType: "Manual" }), [], "Manual wuauserv stopped ⇒ no card");
// and even with NO StartType in the row, the idle-normal name list suppresses it (the live-observed case).
assert.deepEqual(run("wuauserv", "Stopped"), [], "idle-normal wuauserv stopped (no StartType) ⇒ no card");
// StartType can arrive as the ServiceStartMode enum integer (3 = Manual) — still suppressed.
assert.deepEqual(run("wuauserv", "Stopped", { StartType: 3 }), [], "enum-int Manual (3) wuauserv stopped ⇒ no card");
t();

// 2 — coverage KEPT: a genuinely-down Automatic service still fires (never lost). wuauserv set to Automatic (2)
// AND stopped is a real problem → the card fires.
assert.deepEqual(
  run("wuauserv", "Stopped", { StartType: "Automatic" }).map((s) => s.signal),
  ["SYSTEM.SERVICE.STOPPED.WUAUSERV"], "Automatic wuauserv stopped ⇒ card still fires"
);
// Spooler (not on the idle-normal list, unknown StartType) still fires — preserves the pre-gate behavior + the
// existing watchers.test.mjs assertion.
assert.deepEqual(
  run("Spooler", "Stopped").map((s) => s.signal),
  ["SYSTEM.SERVICE.STOPPED.SPOOLER"], "Spooler stopped (unknown mode, not idle-normal) ⇒ card fires"
);
// Automatic Dnscache stopped fires; a Manual-mode Spooler is treated as designed-idle → suppressed.
assert.deepEqual(run("Dnscache", "Stopped", { StartType: 2 }).length, 1, "Automatic Dnscache stopped ⇒ fires");
assert.deepEqual(run("Spooler", "Stopped", { StartType: "Manual" }), [], "Manual Spooler stopped ⇒ suppressed (designed idle)");
t();

// 3 — corroborating failure evidence OVERRIDES the idle-normal suppression (a Windows Update that is genuinely
// failing must still surface, even though wuauserv is Manual). Findings §2: "OR corroborating failure evidence".
assert.deepEqual(
  run("wuauserv", "Stopped", { StartType: "Manual", Failing: true }).map((s) => s.signal),
  ["SYSTEM.SERVICE.STOPPED.WUAUSERV"], "failing wuauserv fires despite Manual startup mode"
);
t();

// 4 — Disabled services are never nagged about (stopped is the whole point of Disabled).
assert.deepEqual(run("BITS", "Stopped", { StartType: "Disabled" }), [], "Disabled service stopped ⇒ no card");
t();

// 5 — startup-mode normaliser handles enum ints, registry ints, and names (incl. Trigger-Start → Manual).
assert.equal(normalizeStartType(2), "Automatic");
assert.equal(normalizeStartType("Automatic"), "Automatic");
assert.equal(normalizeStartType(3), "Manual");
assert.equal(normalizeStartType("Manual"), "Manual");
assert.equal(normalizeStartType("Manual (Trigger Start)"), "Manual");
assert.equal(normalizeStartType(4), "Disabled");
assert.equal(normalizeStartType(undefined), "Unknown");
assert.ok(IDLE_NORMAL_SERVICES.includes("wuauserv") && IDLE_NORMAL_SERVICES.includes("bits"), "idle-normal list covers wuauserv + BITS");
assert.equal(shouldAlertOnStop("wuauserv", { StartType: "Manual" }), false, "shouldAlertOnStop suppresses Manual wuauserv");
assert.equal(shouldAlertOnStop("wuauserv", { StartType: "Automatic" }), true, "shouldAlertOnStop keeps Automatic wuauserv");
t();

assert.equal(n, 5, "5 service-idle-normal groups");
console.log(`service-idle-normal test passed (${n} groups · Manual/Trigger wuauserv stopped ⇒ no card · Automatic-down still fires · failure evidence overrides · Disabled suppressed · startup-mode normaliser).`);
